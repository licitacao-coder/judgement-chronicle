import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ETAPAS_PROCESSAMENTO } from "@/lib/dominio";
import { processarDocumento, analisarDocumento } from "@/lib/pipeline.functions";
import { excluirProcesso } from "@/lib/exclusao.functions";
import { useMotorGlobal } from "@/lib/useMotorGlobal";
import { useAuth } from "@/lib/useAuth";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel de análise | Relatório de Ocorrência em Sessão Pública" },
      {
        name: "description",
        content:
          "Envie o termo de julgamento, ata ou relatório da sessão pública e gere o relatório oficial de ocorrência em Word.",
      },
      { property: "og:title", content: "Gerador de Relatório de Ocorrência em Sessão Pública" },
      {
        property: "og:description",
        content:
          "Leitura do documento, identificação de licitantes e ocorrências e emissão do Word oficial.",
      },
    ],
  }),
  component: Painel,
});

const ROTULO_CATEGORIA: Record<string, string> = {
  TERMO_JULGAMENTO: "Termo de Julgamento",
  RELATORIO_JULGAMENTO: "Relatório de Julgamento",
  ATA_SESSAO: "Ata da Sessão",
  RELATORIO_DILIGENCIA: "Relatório de Diligências",
  CHAT_MENSAGENS: "Chat/Mensagens da sessão",
  OUTRO: "Outro documento equivalente",
};

async function sha256(arquivo: File): Promise<string> {
  const buf = await arquivo.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function Painel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ehAdministrador } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState("TERMO_JULGAMENTO");
  const { motor, localDisponivel } = useMotorGlobal();
  const [etapa, setEtapa] = useState(-1);
  const [processando, setProcessando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  async function removerProcesso(processoId: string) {
    setExcluindo(processoId);
    try {
      await excluirProcesso({ data: { processoId } });
      await queryClient.invalidateQueries({ queryKey: ["processos"] });
      toast.success("Processo analisado excluído.");
    } catch (e) {
      toast.error("Não foi possível excluir o processo", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setExcluindo(null);
    }
  }


  const { data: processos } = useQuery({
    queryKey: ["processos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("*, licitantes(id), ocorrencias(id), documentos(nome_original)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });




  async function enviar(arquivo: File) {
    setProcessando(true);
    setEtapa(0);
    try {
      const extensao = (arquivo.name.split(".").pop() ?? "").toLowerCase();
      if (!["pdf", "docx", "txt"].includes(extensao)) {
        throw new Error("Formatos aceitos: PDF, DOCX ou TXT.");
      }
      const hash = await sha256(arquivo);
      const { data: existente } = await supabase
        .from("documentos")
        .select("id")
        .eq("hash_documento", hash)
        .maybeSingle();
      if (existente) {
        toast.warning("Documento já enviado anteriormente", {
          description: "Prosseguindo com nova análise do mesmo arquivo.",
        });
      }

      const { data: sessao } = await supabase.auth.getUser();
      const usuarioId = sessao.user!.id;
      const nomeArmazenado = `${crypto.randomUUID()}.${extensao}`;
      const caminho = `${usuarioId}/${nomeArmazenado}`;
      const { error: erroUpload } = await supabase.storage
        .from("documentos")
        .upload(caminho, arquivo, {
          contentType:
            arquivo.type || "application/octet-stream",
        });
      if (erroUpload) throw new Error(erroUpload.message);

      const { data: doc, error: erroDoc } = await supabase
        .from("documentos")
        .insert({
          nome_original: arquivo.name,
          nome_armazenado: nomeArmazenado,
          caminho_arquivo: caminho,
          categoria,
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

      setEtapa(1);
      const leitura = await processarDocumento({ data: { documentoId: doc.id, motor } });
      setEtapa(2);
      toast.info(`Texto extraído: ${leitura.paginas} página(s).`);

      setEtapa(3);
      const analise = await analisarDocumento({ data: { documentoId: doc.id, motor } });
      setEtapa(6);

      await queryClient.invalidateQueries({ queryKey: ["processos"] });
      toast.success(
        `Análise concluída: ${analise.licitantes} licitante(s) e ${analise.ocorrencias} ocorrência(s).`,
      );
      void navigate({ to: "/processos/$processoId", params: { processoId: analise.processoId } });
    } catch (e) {
      toast.error("Falha no processamento", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setProcessando(false);
      setEtapa(-1);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <AppShell
      titulo="Análise de sessão pública"
      descricao="Envie o Termo de Julgamento, Relatório de Julgamento, Ata da Sessão ou documento equivalente. O sistema realiza a leitura integral, identifica licitantes e ocorrências e reconstrói a cronologia dos fatos para conferência humana."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="panel">
          <CardHeader>
            <CardTitle className="text-base">Novo documento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Esta análise será feita {motor === "PYTHON" ? "pelo serviço local do órgão" : "pela inteligência artificial"}.
              A escolha fica no alto da tela e vale para todo o sistema.
              {!localDisponivel
                ? " O serviço local só fica disponível depois que o administrador informa o endereço em Configurações."
                : ""}
            </p>


            <div className="grid gap-2 sm:max-w-xs">
              <span className="label-field">Categoria do documento</span>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTULO_CATEGORIA).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/40 px-6 py-12 text-center transition-colors hover:border-accent"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f && !processando) void enviar(f);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                disabled={processando}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void enviar(f);
                }}
              />
              <p className="text-sm font-medium">
                Arraste o arquivo aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">PDF com texto, DOCX ou TXT</p>
            </label>

            {processando ? (
              <div className="space-y-3 rounded-md border border-border p-4">
                <Progress value={((etapa + 1) / ETAPAS_PROCESSAMENTO.length) * 100} />
                <ul className="space-y-1 text-xs">
                  {ETAPAS_PROCESSAMENTO.map((nome, i) => (
                    <li key={nome} className={i <= etapa ? "" : "text-muted-foreground/60"}>
                      {i < etapa ? "✓ " : i === etapa ? "• " : "○ "}
                      {nome}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader>
            <CardTitle className="text-base">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              A extração é feita exclusivamente a partir do conteúdo do arquivo. Campos não
              localizados permanecem em branco para preenchimento manual.
            </p>
            <p>
              Cada licitante recebe sua própria linha do tempo e sua própria ocorrência, vinculadas
              ao CNPJ identificado.
            </p>
            <p className="text-foreground">
              O relatório gerado é preliminar e informativo: não conclui responsabilidade nem aplica
              sanção.
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="text-lg">Processos analisados</h2>
        <div className="mt-4 space-y-3">
          {(processos ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum processo analisado até o momento.
            </p>
          ) : null}
          {(processos ?? []).map((p) => {
            const item = p as unknown as {
              id: string;
              modalidade: string | null;
              numero_certame: string | null;
              ano_certame: string | null;
              objeto: string | null;
              licitantes: unknown[];
              ocorrencias: unknown[];
              documentos: { nome_original: string } | null;
            };
            const numero = (item.numero_certame ?? "").split("/")[0]?.trim() ?? "";
            const ano =
              (item.numero_certame ?? "").split("/")[1]?.trim() || (item.ano_certame ?? "");
            return (
              <div
                key={item.id}
                className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <Link
                  to="/processos/$processoId"
                  params={{ processoId: item.id }}
                  className="min-w-0 flex-1"
                >
                  <p className="font-medium">
                    {item.modalidade ?? "Modalidade não localizada"}
                    {numero ? ` nº ${numero}` : ""}
                    {ano ? `/${ano}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.objeto
                      ? item.objeto.slice(0, 140)
                      : (item.documentos?.nome_original ?? "Objeto não localizado")}
                  </p>
                </Link>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary">{item.licitantes?.length ?? 0} licitantes</Badge>
                  <Badge>{item.ocorrencias?.length ?? 0} ocorrências</Badge>
                  {ehAdministrador ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" disabled={excluindo === item.id}>
                          {excluindo === item.id ? "Excluindo..." : "Excluir"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir processo analisado?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Serão excluídos definitivamente os licitantes, ocorrências, linha do
                            tempo, enquadramentos e relatórios deste processo, inclusive os arquivos
                            Word já emitidos. A operação é registrada na auditoria.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void removerProcesso(item.id)}>
                            Excluir definitivamente
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </div>
            );

          })}
        </div>
      </section>
    </AppShell>
  );
}
