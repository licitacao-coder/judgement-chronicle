import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { obterConfigMotor } from "@/lib/motores.functions";
import { processarDocumento } from "@/lib/pipeline.functions";
import {
  extrairItensAceitos,
  salvarImportacaoPainel,
  type ItemPainel,
} from "@/lib/painel.functions";

export const Route = createFileRoute("/painel")({
  validateSearch: (search: Record<string, unknown>): { processo?: string } =>
    typeof search["processo"] === "string" && search["processo"]
      ? { processo: search["processo"] }
      : {},
  head: () => ({
    meta: [
      { title: "Painel de Itens Aceitos e Habilitados | Sessão Pública" },
      {
        name: "description",
        content:
          "Extraia do Termo de Julgamento os itens aceitos e habilitados, com licitante, CNPJ, melhor lance unitário e total, conferência e exportação para Excel.",
      },
      { property: "og:title", content: "Painel de Itens Aceitos e Habilitados" },
      {
        property: "og:description",
        content:
          "Itens efetivamente aceitos e habilitados, vencedores, melhores lances e auditoria da extração.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaPainel,
});

const ROTULO_STATUS: Record<string, string> = {
  EXTRAIDO_VALIDADO: "Extraído e validado",
  NECESSITA_CONFERENCIA: "Necessita conferência",
  ERRO_EXTRACAO: "Erro de extração",
};

const brl = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "Não localizado"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const texto = (v: string | null | undefined) => (v && v.trim() ? v : "Não localizado");

const pct = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "Não localizado"
    : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const ROTULO_ORIGEM: Record<string, string> = {
  VALOR_NEGOCIADO: "Valor negociado",
  MELHOR_LANCE: "Melhor lance",
};

async function sha256(arquivo: File): Promise<string> {
  const buf = await arquivo.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Registro = ItemPainel & { id?: string };

function PaginaPainel() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { processo: processoDaUrl } = Route.useSearch();

  const [documentoId, setDocumentoId] = useState<string>("");
  const [processoId, setProcessoId] = useState<string>(processoDaUrl ?? "");
  const [previa, setPrevia] = useState<Registro[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [detalhe, setDetalhe] = useState<Registro | null>(null);
  const [motor, setMotor] = useState<"INTERNO" | "PYTHON">("INTERNO");
  const [leitura, setLeitura] = useState<{
    motor: "INTERNO" | "PYTHON";
    versao: string | null;
    duracao: number | null;
  } | null>(null);

  const { data: configMotor } = useQuery({
    queryKey: ["configuracao_motor"],
    queryFn: () => obterConfigMotor(),
  });
  const pythonDisponivel =
    !!configMotor?.endereco_servico && configMotor.situacao === "ATIVO";

  useEffect(() => {
    if (configMotor?.motor_padrao === "PYTHON" && pythonDisponivel) setMotor("PYTHON");
  }, [configMotor?.motor_padrao, pythonDisponivel]);



  const [busca, setBusca] = useState("");
  const [filtroItem, setFiltroItem] = useState("");
  const [filtroLicitante, setFiltroLicitante] = useState("");
  const [filtroCnpj, setFiltroCnpj] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("TODAS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [ordem, setOrdem] = useState("item");

  const { data: documentos } = useQuery({
    queryKey: ["documentos", "painel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("id, nome_original, categoria, status_processamento, quantidade_paginas")
        .order("data_upload", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: processos } = useQuery({
    queryKey: ["processos", "painel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("id, modalidade, numero_certame, ano_certame, orgao, uasg, objeto, documento_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: importacoes } = useQuery({
    queryKey: ["painel_importacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("painel_importacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const importacaoAtual = useMemo(() => {
    const lista = importacoes ?? [];
    // Cada painel exibe apenas a análise mais recente do processo selecionado.
    if (processoId) return lista.find((i) => i.processo_id === processoId) ?? null;
    return lista.find((i) => !i.processo_id) ?? null;
  }, [importacoes, processoId]);

  const { data: itensSalvos } = useQuery({
    queryKey: ["painel_itens", importacaoAtual?.id],
    enabled: !!importacaoAtual?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("painel_itens")
        .select("*")
        .eq("importacao_id", importacaoAtual!.id)
        .order("numero_item", { ascending: true });
      if (error) throw error;
      return data as unknown as Registro[];
    },
  });

  const registros: Registro[] = previa ?? itensSalvos ?? [];

  const situacoes = useMemo(
    () => [...new Set(registros.map((r) => r.situacao).filter(Boolean))] as string[],
    [registros],
  );

  const filtrados = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    const lista = registros.filter((r) => {
      if (filtroItem && String(r.numero_item ?? "") !== filtroItem.trim()) return false;
      if (
        filtroLicitante &&
        !(r.licitante ?? "").toLowerCase().includes(filtroLicitante.trim().toLowerCase())
      )
        return false;
      if (filtroCnpj && !(r.cnpj ?? "").includes(filtroCnpj.trim())) return false;
      if (filtroSituacao !== "TODAS" && r.situacao !== filtroSituacao) return false;
      if (filtroStatus !== "TODOS" && r.status_conferencia !== filtroStatus) return false;
      if (alvo) {
        const bruto = [
          r.numero_item,
          r.especificacao,
          r.licitante,
          r.cnpj,
          r.situacao,
          r.unidade,
          r.observacoes,
        ]
          .join(" ")
          .toLowerCase();
        if (!bruto.includes(alvo)) return false;
      }
      return true;
    });
    const dir = (a: number, b: number) => a - b;
    return [...lista].sort((a, b) => {
      switch (ordem) {
        case "unitario":
          return dir(a.valor_unitario ?? 0, b.valor_unitario ?? 0);
        case "total":
          return dir(b.valor_total ?? 0, a.valor_total ?? 0);
        case "licitante":
          return (a.licitante ?? "").localeCompare(b.licitante ?? "", "pt-BR");
        case "cnpj":
          return (a.cnpj ?? "").localeCompare(b.cnpj ?? "");
        default:
          return dir(a.numero_item ?? 0, b.numero_item ?? 0);
      }
    });
  }, [registros, busca, filtroItem, filtroLicitante, filtroCnpj, filtroSituacao, filtroStatus, ordem]);

  const resumo = useMemo(() => {
    const total = registros.reduce((s, r) => s + (r.valor_total ?? 0), 0);
    const empresas = new Set(registros.map((r) => r.cnpj ?? r.licitante ?? "").filter(Boolean));
    return {
      itens: registros.length,
      licitantes: empresas.size,
      total,
      medio: registros.length ? total / registros.length : 0,
      conferencia: registros.filter((r) => r.status_conferencia === "NECESSITA_CONFERENCIA").length,
      erros: registros.filter((r) => r.status_conferencia === "ERRO_EXTRACAO").length,
    };
  }, [registros]);

  const porLicitante = useMemo(() => {
    const mapa = new Map<
      string,
      { licitante: string; cnpj: string; itens: number[]; total: number }
    >();
    for (const r of registros) {
      const chave = r.cnpj ?? r.licitante ?? "sem identificação";
      const atual = mapa.get(chave) ?? {
        licitante: r.licitante ?? "Não localizado",
        cnpj: r.cnpj ?? "Não localizado",
        itens: [],
        total: 0,
      };
      if (r.numero_item !== null) atual.itens.push(r.numero_item);
      atual.total += r.valor_total ?? 0;
      mapa.set(chave, atual);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [registros]);

  const identificacaoProcesso = useMemo(() => {
    const p = (processos ?? []).find((x) => x.id === processoId);
    if (!p) return "";
    const numero = (p.numero_certame ?? "").replace(/\/\d{4}$/, "");
    return [p.modalidade ?? "Pregão", numero, p.ano_certame ? `/${p.ano_certame}` : ""]
      .join(" ")
      .replace(/\s+\//, "/")
      .trim();
  }, [processos, processoId]);

  async function enviarArquivo(arquivo: File) {
    setOcupado(true);
    try {
      const extensao = (arquivo.name.split(".").pop() ?? "").toLowerCase();
      if (!["pdf", "docx", "txt"].includes(extensao)) {
        throw new Error("Formatos aceitos: PDF, DOCX ou TXT.");
      }
      const hash = await sha256(arquivo);
      const { data: sessao } = await supabase.auth.getUser();
      const usuarioId = sessao.user!.id;
      const nomeArmazenado = `${crypto.randomUUID()}.${extensao}`;
      const caminho = `${usuarioId}/${nomeArmazenado}`;
      const { error: erroUpload } = await supabase.storage
        .from("documentos")
        .upload(caminho, arquivo, {
          contentType: arquivo.type || "application/octet-stream",
        });
      if (erroUpload) throw new Error(erroUpload.message);

      const { data: doc, error: erroDoc } = await supabase
        .from("documentos")
        .insert({
          nome_original: arquivo.name,
          nome_armazenado: nomeArmazenado,
          caminho_arquivo: caminho,
          categoria: "TERMO_JULGAMENTO",
          extensao,
          tipo_arquivo: arquivo.type || null,
          tamanho: arquivo.size,
          hash_documento: hash,
          status_processamento: "RECEBIDO",
          usuario_upload: usuarioId,
        })
        .select()
        .single();
      if (erroDoc || !doc) throw new Error(erroDoc?.message ?? "Falha ao registrar o documento.");

      const leitura = await processarDocumento({ data: { documentoId: doc.id } });
      toast.success(`Leitura concluída: ${leitura.paginas} página(s).`);
      await queryClient.invalidateQueries({ queryKey: ["documentos"] });
      setDocumentoId(doc.id);
      await extrair(doc.id);
    } catch (e) {
      toast.error("Falha no envio do Termo de Julgamento", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setOcupado(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function extrair(idDocumento?: string, motorForcado?: "INTERNO" | "PYTHON") {
    const alvo = idDocumento ?? documentoId;
    if (!alvo) {
      toast.error("Selecione o Termo de Julgamento.");
      return;
    }
    const motorUsado = motorForcado ?? motor;
    setOcupado(true);
    try {
      const resultado = await extrairItensAceitos({
        data: { documentoId: alvo, motor: motorUsado },
      });
      setPrevia(resultado.itens);
      setLeitura({
        motor: resultado.motor,
        versao: resultado.motorVersao ?? null,
        duracao: resultado.duracaoMs ?? null,
      });
      toast.success(
        `${resultado.itens.length} item(ns) aceitos e habilitados localizados em ${resultado.totalBlocos} item(ns) analisados.`,
      );
    } catch (e) {
      const descricao = e instanceof Error ? e.message : String(e);
      if (motorUsado === "PYTHON") {
        toast.error("O serviço Python não concluiu a leitura", {
          description: descricao,
          action: {
            label: "Refazer no motor interno",
            onClick: () => void extrair(alvo, "INTERNO"),
          },
          duration: 12000,
        });
      } else {
        toast.error("Falha na extração", { description: descricao });
      }
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!previa?.length) return;
    setOcupado(true);
    try {
      const r = await salvarImportacaoPainel({
        data: {
          documentoId,
          processoId: processoId || null,
          identificacaoProcesso: identificacaoProcesso || null,
          motor: leitura?.motor ?? "INTERNO",
          motorVersao: leitura?.versao ?? null,
          duracaoMs: leitura?.duracao ?? null,
          itens: previa as unknown as Record<string, unknown>[],
        },
      });
      setPrevia(null);
      await queryClient.invalidateQueries({ queryKey: ["painel_importacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["painel_itens"] });
      toast.success(`Importação gravada (versão ${r.versao}) com ${r.total} item(ns).`);
    } catch (e) {
      toast.error("Não foi possível gravar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setOcupado(false);
    }
  }

  function exportarExcel() {
    if (!registros.length) return;
    const identificacao = identificacaoProcesso || importacaoAtual?.identificacao_processo || "";
    const principal = registros.map((r) => ({
      "Processo/Pregão": identificacao,
      Item: r.numero_item,
      Especificação: r.especificacao ?? "",
      Quantidade: r.quantidade ?? "",
      Unidade: r.unidade ?? "",
      "Valor Unitário Considerado": r.valor_unitario ?? "",
      "Valor Total Considerado": r.valor_total ?? "",
      "Origem do Valor": ROTULO_ORIGEM[r.origem_valor ?? ""] ?? "",
      "Valor Negociado Unitário": r.valor_negociado_unitario ?? "",
      "Valor Negociado Total": r.valor_negociado_total ?? "",
      "Valor de Referência Unitário": r.valor_referencia_unitario ?? "",
      "Valor de Referência Total": r.valor_referencia_total ?? "",
      "% Diferença x Referência": r.percentual_diferenca ?? "",
      Licitante: r.licitante ?? "",
      CNPJ: r.cnpj ?? "",
      Situação: r.situacao ?? "",
      "Página de Origem": r.pagina ?? "",
      "Status da Conferência": ROTULO_STATUS[r.status_conferencia] ?? r.status_conferencia,
      "Validação do Total": r.validacao_total ?? "",
      Diferença: r.diferenca ?? "",
      Observações: r.observacoes ?? "",
    }));
    const resumoEmpresas = porLicitante.map((l) => ({
      Licitante: l.licitante,
      CNPJ: l.cnpj,
      "Quantidade de Itens": l.itens.length,
      "Valor Total": l.total,
      Itens: l.itens.sort((a, b) => a - b).join(", "),
    }));
    const auditoria = registros.map((r) => ({
      Item: r.numero_item,
      "Página de Origem": r.pagina ?? "",
      "Trecho Utilizado": r.trecho_origem ?? "",
      "Data da Extração": new Date(
        (importacaoAtual?.created_at as string) ?? Date.now(),
      ).toLocaleString("pt-BR"),
      "Status da Conferência": ROTULO_STATUS[r.status_conferencia] ?? r.status_conferencia,
    }));

    const livro = XLSX.utils.book_new();
    const aba1 = XLSX.utils.json_to_sheet(principal);
    aba1["!autofilter"] = { ref: (aba1["!ref"] as string) ?? "A1" };
    XLSX.utils.book_append_sheet(livro, aba1, "Itens Aceitos e Habilitados");
    XLSX.utils.book_append_sheet(
      livro,
      XLSX.utils.json_to_sheet(resumoEmpresas),
      "Resumo por Licitante",
    );
    XLSX.utils.book_append_sheet(
      livro,
      XLSX.utils.json_to_sheet(auditoria),
      "Auditoria da Extração",
    );
    XLSX.writeFile(livro, `itens-aceitos-habilitados-${Date.now()}.xlsx`);
  }

  function exportarCsv() {
    if (!registros.length) return;
    const cabecalho = [
      "Item",
      "Especificação",
      "Quantidade",
      "Unidade",
      "Valor Unitário Considerado",
      "Valor Total Considerado",
      "Origem do Valor",
      "Valor de Referência Total",
      "% Diferença x Referência",
      "Licitante",
      "CNPJ",
      "Situação",
      "Página",
      "Status da Conferência",
    ];
    const linhas = registros.map((r) =>
      [
        r.numero_item,
        r.especificacao,
        r.quantidade,
        r.unidade,
        r.valor_unitario,
        r.valor_total,
        ROTULO_ORIGEM[r.origem_valor ?? ""] ?? "",
        r.valor_referencia_total,
        r.percentual_diferenca,
        r.licitante,
        r.cnpj,
        r.situacao,
        r.pagina,
        ROTULO_STATUS[r.status_conferencia] ?? r.status_conferencia,
      ]
        .map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`)
        .join(";"),
    );
    const blob = new Blob(["\uFEFF" + [cabecalho.join(";"), ...linhas].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `itens-aceitos-habilitados-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function abrirDocumento(idDocumento: string | null) {
    if (!idDocumento) return;
    const { data: doc } = await supabase
      .from("documentos")
      .select("caminho_arquivo")
      .eq("id", idDocumento)
      .single();
    if (!doc?.caminho_arquivo) {
      toast.error("Arquivo indisponível.");
      return;
    }
    const { data, error } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.caminho_arquivo, 300);
    if (error || !data) {
      toast.error("Não foi possível abrir o documento", { description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <AppShell
      titulo="Painel de Itens Aceitos e Habilitados"
      descricao="Extrai do Termo de Julgamento apenas os itens com evidência expressa de aceitação e habilitação, com o licitante, CNPJ e o melhor lance indicados no próprio documento."
    >
      <div className="space-y-6">
        <Card className="panel">
          <CardHeader>
            <CardTitle className="text-base">Termo de Julgamento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <span className="label-field">Documento já recebido</span>
              <Select value={documentoId} onValueChange={setDocumentoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o documento" />
                </SelectTrigger>
                <SelectContent>
                  {(documentos ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome_original}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <span className="label-field">Processo licitatório vinculado</span>
              <Select value={processoId} onValueChange={setProcessoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o processo" />
                </SelectTrigger>
                <SelectContent>
                  {(processos ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {[p.modalidade, p.numero_certame, p.orgao].filter(Boolean).join(" · ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <span className="label-field">Como analisar o documento</span>
              <Select value={motor} onValueChange={(v) => setMotor(v as "INTERNO" | "PYTHON")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERNO">Usar IA</SelectItem>
                  <SelectItem value="PYTHON" disabled={!pythonDisponivel}>
                    {pythonDisponivel
                      ? `Usar Local${configMotor?.versao_servico ? ` · ${configMotor.versao_servico}` : ""}`
                      : "Usar Local · indisponível"}
                  </SelectItem>
                </SelectContent>
              </Select>
              {!pythonDisponivel ? (
                <p className="text-xs text-muted-foreground">
                  A opção “Usar Local” fica disponível depois que o administrador informa o endereço
                  do serviço em Configurações e a conexão é confirmada.
                </p>
              ) : null}

              {leitura ? (
                <p className="text-xs text-muted-foreground">
                  Última leitura: {leitura.motor === "PYTHON" ? "Local" : "IA"}

                  {leitura.versao ? ` (${leitura.versao})` : ""}
                  {leitura.duracao ? ` em ${(leitura.duracao / 1000).toFixed(1)}s` : ""}.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button disabled={ocupado || !documentoId} onClick={() => void extrair()}>
                {ocupado ? "Processando..." : "Extrair itens"}
              </Button>
              <Button variant="outline" disabled={ocupado} onClick={() => inputRef.current?.click()}>
                Enviar novo PDF
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void enviarArquivo(f);
                }}
              />
            </div>
          </CardContent>
        </Card>

        {previa ? (
          <Card className="panel border-accent">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                Prévia da extração · {previa.length} item(ns)
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setPrevia(null)}>
                  Descartar
                </Button>
                <Button disabled={ocupado} onClick={() => void confirmar()}>
                  Confirmar gravação
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Confira os registros abaixo antes de gravar. Campos não localizados permanecem em
              branco e o registro é marcado para conferência manual.
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { rotulo: "Itens aceitos e habilitados", valor: String(resumo.itens) },
            { rotulo: "Licitantes vencedores", valor: String(resumo.licitantes) },
            { rotulo: "Valor total dos melhores lances", valor: brl(resumo.total) },
            { rotulo: "Valor médio por item", valor: brl(resumo.medio) },
          ].map((c) => (
            <Card key={c.rotulo} className="panel">
              <CardContent className="pt-6">
                <p className="label-field text-muted-foreground">{c.rotulo}</p>
                <p className="mt-1 text-xl font-medium">{c.valor}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="panel">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Itens</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportarCsv} disabled={!registros.length}>
                Exportar CSV
              </Button>
              <Button size="sm" onClick={exportarExcel} disabled={!registros.length}>
                Exportar Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Input placeholder="Pesquisa geral" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <Input placeholder="Item" value={filtroItem} onChange={(e) => setFiltroItem(e.target.value)} />
              <Input
                placeholder="Licitante"
                value={filtroLicitante}
                onChange={(e) => setFiltroLicitante(e.target.value)}
              />
              <Input placeholder="CNPJ" value={filtroCnpj} onChange={(e) => setFiltroCnpj(e.target.value)} />
              <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas as situações</SelectItem>
                  {situacoes.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos os status</SelectItem>
                  {Object.entries(ROTULO_STATUS).map(([v, r]) => (
                    <SelectItem key={v} value={v}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Ordenar por</span>
              {[
                ["item", "Item"],
                ["unitario", "Lance unitário"],
                ["total", "Lance total"],
                ["licitante", "Licitante"],
                ["cnpj", "CNPJ"],
              ].map(([v, r]) => (
                <Button
                  key={v}
                  size="sm"
                  variant={ordem === v ? "secondary" : "ghost"}
                  onClick={() => setOrdem(v!)}
                >
                  {r}
                </Button>
              ))}
            </div>

            {filtrados.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum item aceito e habilitado para exibir. Selecione o Termo de Julgamento e
                execute a extração.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="p-2">Item</th>
                      <th className="p-2">Especificação</th>
                      <th className="p-2">Qtd.</th>
                      <th className="p-2">Un.</th>
                      <th className="p-2">Unitário</th>
                      <th className="p-2">Total</th>
                      <th className="p-2">Referência</th>
                      <th className="p-2">% x referência</th>
                      <th className="p-2">Licitante</th>
                      <th className="p-2">CNPJ</th>
                      <th className="p-2">Situação</th>
                      <th className="p-2">Pág.</th>
                      <th className="p-2">Conferência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((r, i) => (
                      <tr
                        key={r.id ?? `${r.numero_item}-${i}`}
                        className="cursor-pointer border-b border-border/60 hover:bg-muted/50"
                        onClick={() => setDetalhe(r)}
                      >
                        <td className="p-2 font-medium">{r.numero_item ?? "—"}</td>
                        <td className="max-w-[24rem] p-2">
                          <span className="line-clamp-2">{texto(r.especificacao)}</span>
                        </td>
                        <td className="p-2">{r.quantidade ?? "—"}</td>
                        <td className="p-2">{r.unidade ?? "—"}</td>
                        <td className="p-2 whitespace-nowrap">{brl(r.valor_unitario)}</td>
                        <td className="p-2 whitespace-nowrap">{brl(r.valor_total)}</td>
                        <td className="p-2 whitespace-nowrap">
                          {brl(r.valor_referencia_total ?? r.valor_referencia_unitario)}
                        </td>
                        <td
                          className={`p-2 whitespace-nowrap ${
                            r.percentual_diferenca === null || r.percentual_diferenca === undefined
                              ? "text-muted-foreground"
                              : r.percentual_diferenca <= 0
                                ? "text-emerald-600"
                                : "text-destructive"
                          }`}
                        >
                          {pct(r.percentual_diferenca)}
                        </td>
                        <td className="max-w-[16rem] p-2">
                          <span className="line-clamp-2">{texto(r.licitante)}</span>
                        </td>
                        <td className="p-2 whitespace-nowrap">{texto(r.cnpj)}</td>
                        <td className="p-2">{texto(r.situacao)}</td>
                        <td className="p-2">{r.pagina ?? "—"}</td>
                        <td className="p-2">
                          <Badge
                            variant={
                              r.status_conferencia === "EXTRAIDO_VALIDADO"
                                ? "secondary"
                                : r.status_conferencia === "ERRO_EXTRACAO"
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            {ROTULO_STATUS[r.status_conferencia] ?? r.status_conferencia}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {resumo.conferencia || resumo.erros ? (
              <p className="text-xs text-muted-foreground">
                {resumo.conferencia} registro(s) necessitam conferência e {resumo.erros} com erro de
                extração.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="panel">
            <CardHeader>
              <CardTitle className="text-base">Resumo por licitante</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {porLicitante.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                porLicitante.map((l) => (
                  <div key={l.cnpj + l.licitante} className="rounded-md border border-border p-3">
                    <p className="font-medium">{l.licitante}</p>
                    <p className="text-xs text-muted-foreground">CNPJ {l.cnpj}</p>
                    <p className="mt-1 text-sm">
                      {l.itens.length} item(ns) · {brl(l.total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Itens: {l.itens.sort((a, b) => a - b).join(", ") || "—"}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="panel">
            <CardHeader>
              <CardTitle className="text-base">Histórico de importações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(importacoes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma importação registrada.</p>
              ) : (
                (importacoes ?? []).map((imp) => (
                  <div
                    key={imp.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{imp.nome_documento ?? "Documento"}</p>
                      <p className="text-xs text-muted-foreground">
                        Versão {imp.versao} · {imp.total_itens} item(ns) ·{" "}
                        {new Date(imp.created_at).toLocaleString("pt-BR")}
                        {imp.atual ? " · vigente" : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void abrirDocumento(imp.documento_id)}
                    >
                      Ver documento
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!detalhe} onOpenChange={(aberto) => !aberto && setDetalhe(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Item {detalhe?.numero_item ?? "—"}</DialogTitle>
            <DialogDescription>
              Dados extraídos do bloco “Aceito e Habilitado” do Termo de Julgamento.
            </DialogDescription>
          </DialogHeader>
          {detalhe ? (
            <div className="space-y-3 text-sm">
              <div>
                <p className="label-field text-muted-foreground">Especificação</p>
                <p className="whitespace-pre-wrap">{texto(detalhe.especificacao)}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <p>
                  <span className="label-field text-muted-foreground">Quantidade</span>
                  <br />
                  {detalhe.quantidade ?? "Não localizado"} {detalhe.unidade ?? ""}
                </p>
                <p>
                  <span className="label-field text-muted-foreground">Situação</span>
                  <br />
                  {texto(detalhe.situacao)}
                </p>
                <p>
                  <span className="label-field text-muted-foreground">
                    Valor unitário considerado
                  </span>
                  <br />
                  {brl(detalhe.valor_unitario)}
                </p>
                <p>
                  <span className="label-field text-muted-foreground">Valor total considerado</span>
                  <br />
                  {brl(detalhe.valor_total)}
                </p>
                <p>
                  <span className="label-field text-muted-foreground">Origem do valor</span>
                  <br />
                  {ROTULO_ORIGEM[detalhe.origem_valor ?? ""] ?? "Não localizado"}
                </p>
                <p>
                  <span className="label-field text-muted-foreground">Valor negociado</span>
                  <br />
                  {detalhe.valor_negociado_total ?? detalhe.valor_negociado_unitario
                    ? `${brl(detalhe.valor_negociado_unitario)} (unitário) · ${brl(detalhe.valor_negociado_total)} (total)`
                    : "Não informado no documento"}
                </p>
                <p>
                  <span className="label-field text-muted-foreground">Valor de referência</span>
                  <br />
                  {brl(detalhe.valor_referencia_unitario)} (unitário) ·{" "}
                  {brl(detalhe.valor_referencia_total)} (total)
                </p>
                <p>
                  <span className="label-field text-muted-foreground">
                    Diferença em relação à referência
                  </span>
                  <br />
                  {pct(detalhe.percentual_diferenca)}
                </p>
                <p>
                  <span className="label-field text-muted-foreground">Licitante</span>
                  <br />
                  {texto(detalhe.licitante)}
                </p>
                <p>
                  <span className="label-field text-muted-foreground">CNPJ</span>
                  <br />
                  {texto(detalhe.cnpj)}
                </p>
                <p>
                  <span className="label-field text-muted-foreground">Conferência do total</span>
                  <br />
                  {detalhe.validacao_total ?? "Não aplicável"}
                  {detalhe.diferenca !== null && detalhe.diferenca !== undefined
                    ? ` (diferença ${brl(detalhe.diferenca)})`
                    : ""}
                </p>
                <p>
                  <span className="label-field text-muted-foreground">Página de origem</span>
                  <br />
                  {detalhe.pagina ?? "Não localizado"}
                </p>
              </div>
              {detalhe.observacoes ? (
                <p className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                  {detalhe.observacoes}
                </p>
              ) : null}
              <div>
                <p className="label-field text-muted-foreground">Trecho utilizado na extração</p>
                <p className="whitespace-pre-wrap rounded-md border border-border p-3 text-xs">
                  {texto(detalhe.trecho_origem)}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  void abrirDocumento(documentoId || (importacaoAtual?.documento_id ?? null))
                }
              >
                Abrir documento de origem
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
