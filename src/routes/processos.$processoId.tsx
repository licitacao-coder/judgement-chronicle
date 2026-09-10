import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CHECKLIST_REVISAO,
  DOCUMENTOS_COMPROBATORIOS,
  ORIGEM_DISPOSITIVO,
  ROTULO_TIPO_EVENTO,
  ROTULO_TIPO_OCORRENCIA,
  dataBrasileiraHoje,
  formatarDocumento,
  rotuloConfianca,
} from "@/lib/dominio";
import { redigirRelato } from "@/lib/pipeline.functions";
import { gerarRelatorioWord, reservarNumeroRelatorio } from "@/lib/relatorio.functions";
import { useAuth, registrarAuditoria } from "@/lib/useAuth";
import { useMotorGlobal } from "@/lib/useMotorGlobal";

export const Route = createFileRoute("/processos/$processoId")({
  head: () => ({
    meta: [
      { title: "Revisão da ocorrência | Relatório de Ocorrência em Sessão Pública" },
      {
        name: "description",
        content:
          "Conferência humana dos dados extraídos, linha do tempo, enquadramento preliminar e geração do documento oficial.",
      },
      { property: "og:title", content: "Revisão e emissão do relatório de ocorrência" },
      {
        property: "og:description",
        content: "Formulário inteligente com evidências, cronologia e geração do Word oficial.",
      },
    ],
  }),
  component: PaginaProcesso,
});

type Campos = Record<string, string>;
type Registro = Record<string, string | number | null | undefined>;

/** Monta "MODALIDADE nº 9/2026" sem repetir o ano nem a palavra da modalidade. */
function montarModalidade(
  modalidade?: string | null,
  numeroCertame?: string | null,
  anoCertame?: string | null,
): string {
  const bruto = (numeroCertame ?? "").trim();
  const partes = bruto.split("/").filter(Boolean);
  const numero = (partes[0] ?? "").replace(/^n[ºo°.\s]*/i, "").trim();
  const anoNoNumero = partes.slice(1).find((x) => /^\d{4}$/.test(x.trim()))?.trim();
  const ano = anoNoNumero ?? (anoCertame ?? "").trim();

  let nome = (modalidade ?? "").trim().replace(/\s+/g, " ");
  // remove repetição do tipo "Pregão PREGÃO"
  const palavras = nome.split(" ");
  const semRepeticao: string[] = [];
  for (const palavra of palavras) {
    const anterior = semRepeticao[semRepeticao.length - 1];
    if (anterior && anterior.toLowerCase() === palavra.toLowerCase()) continue;
    semRepeticao.push(palavra);
  }
  nome = semRepeticao.join(" ");
  // remove número/ano já embutidos no nome da modalidade
  nome = nome
    .replace(/n[ºo°.]?\s*\d+\s*(\/\s*\d{4})?/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return [nome, numero ? `nº ${numero}` : "", ano ? `/${ano}` : ""]
    .filter(Boolean)
    .join(" ")
    .replace(" /", "/")
    .trim();
}


function PaginaProcesso() {
  const { processoId } = Route.useParams();
  const { perfil } = useAuth();
  const { motor } = useMotorGlobal();
  const queryClient = useQueryClient();
  const [ocorrenciaId, setOcorrenciaId] = useState<string | null>(null);
  const [campos, setCampos] = useState<Campos>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [docs, setDocs] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["processo", processoId],
    queryFn: async () => {
      const [proc, lic, oco] = await Promise.all([
        supabase.from("processos").select("*, documentos(*)").eq("id", processoId).single(),
        supabase.from("licitantes").select("*").eq("processo_id", processoId),
        supabase
          .from("ocorrencias")
          .select("*, eventos_ocorrencia(*), enquadramentos(*), relatorios(*)")
          .eq("processo_id", processoId),
      ]);
      if (proc.error) throw proc.error;
      return {
        processo: proc.data as unknown as Registro,
        licitantes: (lic.data ?? []) as unknown as Registro[],
        ocorrencias: (oco.data ?? []) as unknown as Record<string, never>[],
      };
    },
  });

  const ocorrencia = useMemo(() => {
    const lista = (data?.ocorrencias ?? []) as unknown as Registro[];
    return lista.find((o) => o["id"] === ocorrenciaId) ?? lista[0] ?? null;
  }, [data, ocorrenciaId]);

  const licitante = useMemo(
    () => data?.licitantes.find((l) => l["id"] === ocorrencia?.["licitante_id"]) ?? null,
    [data, ocorrencia],
  );
  const relatorio = (ocorrencia?.["relatorios"] as unknown as Registro[] | undefined)?.[0] ?? null;
  const enquadramentos = (ocorrencia?.["enquadramentos"] as unknown as Registro[] | undefined) ?? [];
  const eventos = useMemo(() => {
    const lista = (ocorrencia?.["eventos_ocorrencia"] as unknown as Registro[] | undefined) ?? [];
    return [...lista].sort(
      (a, b) => Number(a["ordem_cronologica"] ?? 0) - Number(b["ordem_cronologica"] ?? 0),
    );
  }, [ocorrencia]);

  useEffect(() => {
    if (!data || !ocorrencia) return;
    const p = data.processo;
    const salvos = (relatorio?.["dados_json"] ?? {}) as unknown as Campos;
    const v = (chave: string, alternativa?: string | number | null) =>
      salvos[chave] ?? (alternativa === null || alternativa === undefined ? "" : String(alternativa));

    setCampos({
      NUMERO_RELATORIO: v("NUMERO_RELATORIO", relatorio?.["numero_relatorio"] as string),
      ANO_RELATORIO: v(
        "ANO_RELATORIO",
        (p["ano_certame"] as string) ?? String(new Date().getFullYear()),
      ),
      PROCESSO_SEI: v("PROCESSO_SEI", p["processo_sei"] as string),
      PROCEDIMENTO: v("PROCEDIMENTO", p["modalidade"] as string),
      ORGAO: v("ORGAO", p["orgao"] as string),
      PROCESSO_ADMINISTRATIVO: v("PROCESSO_ADMINISTRATIVO", p["numero_processo"] as string),
      MODALIDADE_NUMERO: v(
        "MODALIDADE_NUMERO",
        montarModalidade(
          p["modalidade"] as string | null,
          p["numero_certame"] as string | null,
          p["ano_certame"] as string | null,
        ),
      ),
      OBJETO: v("OBJETO", p["objeto"] as string),
      PLATAFORMA: v("PLATAFORMA", p["plataforma"] as string),
      DATA_HORARIO_SESSAO: v(
        "DATA_HORARIO_SESSAO",
        [p["data_sessao"], p["horario_sessao"]].filter(Boolean).join(" às "),
      ),
      DATA_SESSAO: v("DATA_SESSAO", p["data_sessao"] as string),
      HORARIO_SESSAO: v("HORARIO_SESSAO", p["horario_sessao"] as string),

      GRUPO_LOTE: v(
        "GRUPO_LOTE",
        (licitante?.["grupo_lote"] as string) ?? (licitante?.["itens"] as string),
      ),
      AGENTE: v("AGENTE", (p["agente"] as string) ?? perfil?.nome),
      RAZAO_SOCIAL: v("RAZAO_SOCIAL", licitante?.["razao_social"] as string),
      CNPJ: v("CNPJ", formatarDocumento(licitante?.["cnpj_cpf"] as string)),
      REPRESENTANTE: v("REPRESENTANTE", licitante?.["representante"] as string),
      EMAIL: v("EMAIL", licitante?.["email"] as string),
      TELEFONE: v("TELEFONE", licitante?.["telefone"] as string),
      SITUACAO: v("SITUACAO", licitante?.["situacao"] as string),
      RELATO: v("RELATO", relatorio?.["relato"] as string),
      MANIFESTACAO: v("MANIFESTACAO", ocorrencia["manifestacao"] as string),
      PROVIDENCIAS: v("PROVIDENCIAS", ocorrencia["providencias"] as string),
      REPERCUSSAO: v("REPERCUSSAO", ocorrencia["repercussao"] as string),
      INCISO: v("INCISO", enquadramentos[0]?.["inciso"] as string),
      HIPOTESE_LEGAL: v("HIPOTESE_LEGAL", enquadramentos[0]?.["dispositivo_texto"] as string),
      ITEM_EDITAL: v("ITEM_EDITAL", enquadramentos[0]?.["item_edital"] as string),
      ELEMENTOS: v("ELEMENTOS", ocorrencia["descricao_resumida"] as string),
      MATRICULA: v("MATRICULA", perfil?.matricula),
      CARGO: v("CARGO", perfil?.cargo),
      MUNICIPIO: v("MUNICIPIO"),
      DATA_ASSINATURA: v("DATA_ASSINATURA", dataBrasileiraHoje()),
    });
    setChecklist((relatorio?.["checklist"] ?? {}) as unknown as Record<string, boolean>);
    setDocs((relatorio?.["documentos_comprobatorios"] ?? []) as unknown as string[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ocorrencia, relatorio, licitante, perfil]);

  function set(chave: string, valor: string) {
    setCampos((c) => ({ ...c, [chave]: valor }));
  }

  async function redigir() {
    if (!ocorrencia) return;
    setOcupado(true);
    try {
      const r = await redigirRelato({
        data: { ocorrenciaId: String(ocorrencia["id"]), motor },
      });
      setCampos((c) => ({
        ...c,
        RELATO: r.relato || (c["RELATO"] ?? ""),
        PROVIDENCIAS: r.providencias || (c["PROVIDENCIAS"] ?? ""),
        REPERCUSSAO: r.repercussao || (c["REPERCUSSAO"] ?? ""),
      }));
      toast.success("Redação gerada a partir das evidências do documento.");
    } catch (e) {
      toast.error("Falha ao redigir", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(false);
    }
  }

  async function numerar() {
    if (!relatorio) return;
    const ano = (campos["ANO_RELATORIO"] || String(new Date().getFullYear())).slice(0, 4);
    setOcupado(true);
    try {
      const r = await reservarNumeroRelatorio({
        data: { relatorioId: String(relatorio["id"]), ano },
      });
      setCampos((c) => ({ ...c, NUMERO_RELATORIO: r.numero, ANO_RELATORIO: r.ano }));
      await queryClient.invalidateQueries({ queryKey: ["processo", processoId] });
      toast.success(
        r.novo
          ? `Número ${r.numero}/${r.ano} reservado para este relatório.`
          : `Este relatório já possui o número ${r.numero}/${r.ano}.`,
      );
    } catch (e) {
      toast.error("Falha ao gerar a numeração", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setOcupado(false);
    }
  }

  async function salvar() {
    if (!relatorio) return;
    const id = String(relatorio["id"]);
    const { error } = await supabase
      .from("relatorios")
      .update({
        dados_json: campos,
        checklist,
        documentos_comprobatorios: docs,
        relato: campos["RELATO"] ?? null,
        providencias: campos["PROVIDENCIAS"] ?? null,
        repercussao: campos["REPERCUSSAO"] ?? null,
        numero_relatorio: campos["NUMERO_RELATORIO"] ?? null,
        ano: campos["ANO_RELATORIO"] ?? null,
        processo_sei: campos["PROCESSO_SEI"] ?? null,
        data_relatorio: campos["DATA_ASSINATURA"] ?? null,
        status: "EM_REVISAO",
      })
      .eq("id", id);
    if (error) {
      toast.error("Falha ao salvar", { description: error.message });
      return;
    }
    await registrarAuditoria({ acao: "SALVAR_REVISAO", entidade: "relatorios", entidade_id: id });
    await queryClient.invalidateQueries({ queryKey: ["processo", processoId] });
    toast.success("Revisão salva.");
  }

  async function gerar() {
    if (!relatorio) return;
    const pendentes = CHECKLIST_REVISAO.filter((i) => !checklist[i]);
    if (pendentes.length) {
      toast.error("Checklist de revisão incompleto", {
        description: `Confirme: ${pendentes.slice(0, 3).join("; ")}${pendentes.length > 3 ? "..." : ""}`,
      });
      return;
    }
    setOcupado(true);
    try {
      await salvar();
      const doc = await gerarRelatorioWord({
        data: {
          relatorioId: String(relatorio["id"]),
          campos: { ...campos, DOCUMENTOS: docs.join("; ") },
        },
      });
      setCampos((c) => ({ ...c, NUMERO_RELATORIO: doc.numero, ANO_RELATORIO: doc.ano }));
      const bin = atob(doc.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.nome;
      a.click();
      URL.revokeObjectURL(url);
      await registrarAuditoria({
        acao: "GERAR_WORD",
        entidade: "relatorios",
        entidade_id: String(relatorio["id"]),
      });
      await queryClient.invalidateQueries({ queryKey: ["processo", processoId] });
      toast.success("Documento Word gerado e baixado.");
    } catch (e) {
      toast.error("Falha ao gerar o documento", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setOcupado(false);
    }
  }

  if (isLoading || !data) {
    return (
      <AppShell titulo="Carregando processo...">
        <p className="text-sm text-muted-foreground">Buscando os dados extraídos.</p>
      </AppShell>
    );
  }

  const p = data.processo;
  const listaOcorrencias = data.ocorrencias as unknown as Registro[];

  const camposIdentificacao: [string, string][] = [
    ["NUMERO_RELATORIO", "Número do relatório"],
    ["ANO_RELATORIO", "Ano"],
    ["PROCESSO_SEI", "Processo SEI"],
    ["PROCESSO_ADMINISTRATIVO", "Processo administrativo"],
    ["PROCEDIMENTO", "Procedimento/Modalidade"],
    ["MODALIDADE_NUMERO", "Modalidade e número do certame"],
    ["ORGAO", "Órgão/Entidade"],
    ["PLATAFORMA", "Plataforma eletrônica"],
    ["DATA_HORARIO_SESSAO", "Data e horário da sessão"],
    ["DATA_SESSAO", "Data da sessão"],
    ["HORARIO_SESSAO", "Horário da sessão"],
    ["GRUPO_LOTE", "Grupo/Lote/Itens"],
    ["AGENTE", "Agente de contratação/Pregoeiro"],
    ["MATRICULA", "Matrícula"],
  ];

  const camposLicitante: [string, string][] = [
    ["RAZAO_SOCIAL", "Razão social"],
    ["CNPJ", "CNPJ/CPF"],
    ["REPRESENTANTE", "Representante"],
    ["EMAIL", "E-mail"],
    ["TELEFONE", "Telefone"],
    ["SITUACAO", "Situação no certame"],
  ];

  const camposRelato: [string, string, number][] = [
    ["RELATO", "Relato cronológico dos fatos", 10],
    ["MANIFESTACAO", "Manifestação/justificativa do licitante", 4],
    ["PROVIDENCIAS", "Providências adotadas pela Administração", 4],
    ["REPERCUSSAO", "Repercussão no certame", 4],
  ];

  return (
    <AppShell
      titulo={`${p["modalidade"] ?? "Certame"}${p["numero_certame"] ? ` nº ${p["numero_certame"]}` : ""}${p["ano_certame"] ? `/${p["ano_certame"]}` : ""}`}
      descricao={(p["objeto"] as string) ?? "Objeto não localizado no documento."}
      acoes={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void salvar()} disabled={ocupado || !relatorio}>
            Salvar revisão
          </Button>
          <Button onClick={() => void gerar()} disabled={ocupado || !relatorio}>
            Gerar Word oficial
          </Button>
        </div>
      }
    >
      {listaOcorrencias.length > 1 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {listaOcorrencias.map((o) => {
            const l = data.licitantes.find((x) => x["id"] === o["licitante_id"]);
            const ativo = o["id"] === ocorrencia?.["id"];
            return (
              <button
                key={String(o["id"])}
                onClick={() => setOcorrenciaId(String(o["id"]))}
                className={`rounded-md border px-3 py-2 text-left text-xs ${ativo ? "border-accent bg-accent/10" : "border-border"}`}
              >
                <span className="block font-medium">
                  {(l?.["razao_social"] as string) ?? "Licitante não identificado"}
                </span>
                <span className="text-muted-foreground">
                  {ROTULO_TIPO_OCORRENCIA[String(o["tipo_ocorrencia"])] ??
                    String(o["tipo_ocorrencia"] ?? "")}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <Tabs defaultValue="dados">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dados">Identificação</TabsTrigger>
          <TabsTrigger value="licitante">Licitante</TabsTrigger>
          <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
          <TabsTrigger value="relato">Relato</TabsTrigger>
          <TabsTrigger value="enquadramento">Enquadramento</TabsTrigger>
          <TabsTrigger value="revisao">Revisão e emissão</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card className="panel">
            <CardHeader>
              <CardTitle className="text-base">
                Identificação do procedimento
                <Badge variant="secondary" className="ml-2">
                  Confiança {rotuloConfianca(p["nivel_confianca"] as string)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {camposIdentificacao.map(([chave, rotulo]) =>
                chave === "NUMERO_RELATORIO" ? (
                  <div key={chave} className="space-y-1.5">
                    <Label className="label-field">{rotulo}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={campos[chave] ?? ""}
                        onChange={(e) => set(chave, e.target.value)}
                        placeholder="Gerado automaticamente"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={ocupado || !relatorio}
                        onClick={() => void numerar()}
                      >
                        Gerar número
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Numeração sequencial automática por ano. Se ficar em branco, o número é
                      reservado ao gerar o Word.
                    </p>
                  </div>
                ) : (
                  <div key={chave} className="space-y-1.5">
                    <Label className="label-field">{rotulo}</Label>
                    <Input
                      value={campos[chave] ?? ""}
                      onChange={(e) => set(chave, e.target.value)}
                      placeholder="Não localizado – preencher manualmente"
                    />
                  </div>
                ),
              )}
              <div className="space-y-1.5 md:col-span-2">
                <Label className="label-field">Objeto</Label>
                <Textarea
                  rows={3}
                  value={campos["OBJETO"] ?? ""}
                  onChange={(e) => set("OBJETO", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="licitante">
          <Card className="panel">
            <CardHeader>
              <CardTitle className="text-base">Licitante envolvido</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {camposLicitante.map(([chave, rotulo]) => (
                <div key={chave} className="space-y-1.5">
                  <Label className="label-field">{rotulo}</Label>
                  <Input
                    value={campos[chave] ?? ""}
                    onChange={(e) => set(chave, e.target.value)}
                    placeholder="Não localizado – preencher manualmente"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="panel">
            <CardHeader>
              <CardTitle className="text-base">
                Reconstrução cronológica dos fatos ({eventos.length} eventos)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {eventos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum evento identificado no documento.
                </p>
              ) : null}
              {eventos.map((ev) => (
                <div key={String(ev["id"])} className="border-l-2 border-accent/60 pl-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono">
                      {(ev["data_evento"] as string) ?? "data não localizada"}
                      {ev["hora_evento"] ? ` ${ev["hora_evento"]}` : ""}
                    </span>
                    <Badge variant="secondary">
                      {ROTULO_TIPO_EVENTO[String(ev["tipo_evento"])] ?? String(ev["tipo_evento"])}
                    </Badge>
                    <span className="text-muted-foreground">
                      Confiança {rotuloConfianca(ev["nivel_confianca"] as string)}
                      {ev["pagina_documento"] ? ` · pág. ${ev["pagina_documento"]}` : ""}
                    </span>
                  </div>
                  {ev["autor"] || ev["destinatario"] ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(ev["autor"] as string) ?? "—"} → {(ev["destinatario"] as string) ?? "—"}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm">
                    {(ev["mensagem_normalizada"] as string) ??
                      (ev["mensagem_original"] as string) ??
                      ""}
                  </p>
                  {ev["mensagem_original"] ? (
                    <p className="mt-1 rounded bg-muted/60 p-2 font-mono text-xs text-muted-foreground">
                      Evidência: “{String(ev["mensagem_original"])}”
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relato">
          <Card className="panel">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                Relato dos fatos
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void redigir()}
                  disabled={ocupado}
                >
                  Redigir a partir das evidências
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {camposRelato.map(([chave, rotulo, linhas]) => (
                <div key={chave} className="space-y-1.5">
                  <Label className="label-field">{rotulo}</Label>
                  <Textarea
                    rows={linhas}
                    value={campos[chave] ?? ""}
                    onChange={(e) => set(chave, e.target.value)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enquadramento">
          <Card className="panel">
            <CardHeader>
              <CardTitle className="text-base">Enquadramento preliminar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                Enquadramento meramente preliminar e informativo. Não constitui juízo de
                responsabilidade nem aplicação de sanção administrativa.
              </p>
              {enquadramentos.map((e) => (
                <div key={String(e["id"])} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary">
                      {ORIGEM_DISPOSITIVO[String(e["origem_dispositivo"])] ??
                        String(e["origem_dispositivo"] ?? "")}
                    </Badge>
                    <span className="font-mono">
                      {[
                        e["lei"],
                        e["artigo"] ? `art. ${e["artigo"]}` : null,
                        e["inciso"] ? `inc. ${e["inciso"]}` : null,
                        e["item_edital"] ? `item ${e["item_edital"]}` : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                  {e["dispositivo_texto"] ? (
                    <p className="mt-2">{String(e["dispositivo_texto"])}</p>
                  ) : null}
                  {e["justificativa"] ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {String(e["justificativa"])}
                    </p>
                  ) : null}
                </div>
              ))}
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="label-field">Inciso indicado no relatório</Label>
                  <Input
                    value={campos["INCISO"] ?? ""}
                    onChange={(e) => set("INCISO", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="label-field">Item/subitem do edital</Label>
                  <Input
                    value={campos["ITEM_EDITAL"] ?? ""}
                    onChange={(e) => set("ITEM_EDITAL", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="label-field">Hipótese legal transcrita</Label>
                  <Textarea
                    rows={3}
                    value={campos["HIPOTESE_LEGAL"] ?? ""}
                    onChange={(e) => set("HIPOTESE_LEGAL", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="label-field">Elementos objetivos identificados</Label>
                  <Textarea
                    rows={3}
                    value={campos["ELEMENTOS"] ?? ""}
                    onChange={(e) => set("ELEMENTOS", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revisao">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="panel">
              <CardHeader>
                <CardTitle className="text-base">Checklist de revisão humana</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {CHECKLIST_REVISAO.map((item) => (
                  <label key={item} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={!!checklist[item]}
                      onCheckedChange={(valor) =>
                        setChecklist((c) => ({ ...c, [item]: valor === true }))
                      }
                    />
                    {item}
                  </label>
                ))}
              </CardContent>
            </Card>

            <Card className="panel">
              <CardHeader>
                <CardTitle className="text-base">Documentos comprobatórios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {DOCUMENTOS_COMPROBATORIOS.map((d) => (
                  <label key={d} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={docs.includes(d)}
                      onCheckedChange={(valor) =>
                        setDocs((atual) =>
                          valor === true ? [...atual, d] : atual.filter((x) => x !== d),
                        )
                      }
                    />
                    {d}
                  </label>
                ))}
                <Separator className="my-3" />
                <div className="space-y-1.5">
                  <Label className="label-field">Município e data</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={campos["MUNICIPIO"] ?? ""}
                      onChange={(e) => set("MUNICIPIO", e.target.value)}
                      placeholder="Município"
                    />
                    <Input
                      value={campos["DATA_ASSINATURA"] ?? ""}
                      onChange={(e) => set("DATA_ASSINATURA", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="panel lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Pré-visualização do relatório</CardTitle>
              </CardHeader>
              <CardContent>
                <article className="doc-page">
                  <h2 className="mb-6 text-center text-base font-bold uppercase">
                    Relatório de Ocorrência em Sessão Pública nº{" "}
                    {campos["NUMERO_RELATORIO"] || "___"}/{campos["ANO_RELATORIO"] || "____"}
                  </h2>
                  <p>
                    <strong>Processo:</strong> {campos["PROCESSO_ADMINISTRATIVO"] || "—"} ·{" "}
                    <strong>SEI:</strong> {campos["PROCESSO_SEI"] || "—"}
                  </p>
                  <p>
                    <strong>Certame:</strong> {campos["MODALIDADE_NUMERO"] || "—"} ·{" "}
                    <strong>Plataforma:</strong> {campos["PLATAFORMA"] || "—"}
                  </p>
                  <p>
                    <strong>Objeto:</strong> {campos["OBJETO"] || "—"}
                  </p>
                  <p>
                    <strong>Licitante:</strong> {campos["RAZAO_SOCIAL"] || "—"} (
                    {campos["CNPJ"] || "—"})
                  </p>
                  <p className="mt-4 whitespace-pre-line">{campos["RELATO"] || "—"}</p>
                  {campos["PROVIDENCIAS"] ? (
                    <p className="mt-3 whitespace-pre-line">{campos["PROVIDENCIAS"]}</p>
                  ) : null}
                  {campos["REPERCUSSAO"] ? (
                    <p className="mt-3 whitespace-pre-line">{campos["REPERCUSSAO"]}</p>
                  ) : null}
                  <p className="mt-8 text-center">
                    {campos["MUNICIPIO"] || "—"}, {campos["DATA_ASSINATURA"] || "—"}
                  </p>
                  <p className="mt-8 text-center">
                    {campos["AGENTE"] || "—"}
                    <br />
                    Matrícula {campos["MATRICULA"] || "—"}
                  </p>
                </article>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
