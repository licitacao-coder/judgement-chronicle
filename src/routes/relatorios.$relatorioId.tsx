import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useAuth, registrarAuditoria } from "@/lib/useAuth";

export const Route = createFileRoute("/relatorios/$relatorioId")({
  head: () => ({
    meta: [
      { title: "Visualização do relatório | Relatório de Ocorrência em Sessão Pública" },
      {
        name: "description",
        content:
          "Visualize o relatório de ocorrência em sessão pública, imprima, baixe o documento oficial em Word e registre a versão final.",
      },
      { property: "og:title", content: "Visualização do relatório de ocorrência" },
      {
        property: "og:description",
        content: "Documento preliminar e informativo, com opções de impressão e download em Word.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaVisualizacao,
});

const ROTULO_STATUS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  EM_REVISAO: "Em revisão",
  GERADO: "Word gerado",
  FINAL: "Documento oficial",
};

const SECOES: { titulo: string; campos: [string, string][] }[] = [
  {
    titulo: "1. Identificação do procedimento",
    campos: [
      ["PROCESSO_SEI", "Processo SEI"],
      ["PROCESSO_ADMINISTRATIVO", "Processo administrativo"],
      ["ORGAO", "Órgão"],
      ["MODALIDADE_NUMERO", "Modalidade e número do certame"],
      ["OBJETO", "Objeto"],
      ["PLATAFORMA", "Plataforma"],
      ["DATA_SESSAO", "Data da sessão"],
      ["HORARIO_SESSAO", "Horário da sessão"],
      ["GRUPO_LOTE", "Grupo/Lote"],
      ["AGENTE", "Agente de contratação"],
    ],
  },
  {
    titulo: "2. Identificação do licitante",
    campos: [
      ["RAZAO_SOCIAL", "Razão social"],
      ["CNPJ", "CNPJ/CPF"],
      ["REPRESENTANTE", "Representante"],
      ["EMAIL", "E-mail"],
      ["TELEFONE", "Telefone"],
      ["SITUACAO", "Situação"],
    ],
  },
];

const BLOCOS: [string, string][] = [
  ["RELATO", "3. Relato dos fatos"],
  ["MANIFESTACAO", "4. Manifestação do licitante"],
  ["PROVIDENCIAS", "5. Providências adotadas"],
  ["REPERCUSSAO", "6. Repercussão no certame"],
  ["ELEMENTOS", "7. Elementos de convicção"],
  ["INCISO", "8. Enquadramento preliminar – dispositivo"],
  ["HIPOTESE_LEGAL", "9. Enquadramento preliminar – hipótese legal"],
  ["ITEM_EDITAL", "10. Item do edital"],
  ["DOCUMENTOS", "11. Documentos comprobatórios"],
];

function PaginaVisualizacao() {
  const { relatorioId } = Route.useParams();
  const { podeAprovar } = useAuth();
  const queryClient = useQueryClient();
  const [ocupado, setOcupado] = useState(false);

  const { data: relatorio, isLoading } = useQuery({
    queryKey: ["relatorio", relatorioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relatorios")
        .select("*")
        .eq("id", relatorioId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const campos = (relatorio?.dados_json ?? {}) as Record<string, string>;
  const valor = (chave: string) => (campos[chave] ?? "").trim();

  async function baixarWord() {
    if (!relatorio?.arquivo_word) {
      toast.error("Documento Word ainda não gerado", {
        description: "Conclua a revisão e gere o Word na tela do processo.",
      });
      return;
    }
    setOcupado(true);
    const { data, error } = await supabase.storage
      .from("relatorios")
      .createSignedUrl(relatorio.arquivo_word, 120);
    setOcupado(false);
    if (error || !data) {
      toast.error("Não foi possível gerar o link", { description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function marcarFinal() {
    if (!relatorio) return;
    setOcupado(true);
    const { data: sessao } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("relatorios")
      .update({
        status: "FINAL",
        data_validacao: new Date().toISOString(),
        usuario_validacao: sessao.user?.id ?? null,
      })
      .eq("id", relatorioId);
    setOcupado(false);
    if (error) {
      toast.error("Não foi possível registrar a versão final", { description: error.message });
      return;
    }
    await registrarAuditoria({
      acao: "VERSAO_FINAL",
      entidade: "relatorios",
      entidade_id: relatorioId,
    });
    await queryClient.invalidateQueries({ queryKey: ["relatorio", relatorioId] });
    await queryClient.invalidateQueries({ queryKey: ["relatorios"] });
    toast.success("Versão final registrada como documento oficial.");
  }

  if (isLoading) {
    return (
      <AppShell titulo="Visualização do relatório">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </AppShell>
    );
  }

  if (!relatorio) {
    return (
      <AppShell titulo="Visualização do relatório">
        <p className="text-sm text-muted-foreground">Relatório não encontrado.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo={`Relatório nº ${relatorio.numero_relatorio ?? "___"}/${relatorio.ano ?? "____"}`}
      descricao="Documento preliminar e informativo: não conclui responsabilidade nem aplica sanção administrativa."
      acoes={
        <div className="flex flex-wrap items-center gap-2" data-print-hide>
          <Badge>{ROTULO_STATUS[relatorio.status] ?? relatorio.status}</Badge>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void baixarWord()}>
            Baixar Word
          </Button>
          {relatorio.processo_id ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/processos/$processoId" params={{ processoId: relatorio.processo_id }}>
                Editar revisão
              </Link>
            </Button>
          ) : null}
          {podeAprovar && relatorio.status !== "FINAL" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={ocupado}>
                  Registrar versão final
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Registrar a versão final?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A versão atual passa a constar como documento oficial do relatório, com registro
                    de data e responsável na auditoria. O conteúdo permanece preliminar e
                    informativo, sem conclusão de responsabilidade ou sanção.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void marcarFinal()}>
                    Registrar versão final
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      }
    >
      <Card className="panel print:border-0 print:shadow-none">
        <CardContent className="documento space-y-6 py-8">
          <header className="space-y-1 text-center">
            <p className="label-field">{valor("ORGAO") || "Órgão não informado"}</p>
            <h2 className="text-lg font-semibold uppercase">
              Relatório de Ocorrência em Sessão Pública
            </h2>
            <p className="text-sm">
              nº {relatorio.numero_relatorio ?? "___"}/{relatorio.ano ?? "____"}
              {relatorio.status === "FINAL" ? " · versão final (documento oficial)" : ""}
            </p>
          </header>

          {SECOES.map((secao) => (
            <section key={secao.titulo} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase">{secao.titulo}</h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                {secao.campos.map(([chave, rotulo]) => (
                  <div key={chave}>
                    <dt className="label-field">{rotulo}</dt>
                    <dd className="text-sm">{valor(chave) || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          {BLOCOS.map(([chave, titulo]) => (
            <section key={chave} className="space-y-1">
              <h3 className="text-sm font-semibold uppercase">{titulo}</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{valor(chave) || "—"}</p>
            </section>
          ))}

          <footer className="space-y-6 pt-6 text-center text-sm">
            <p>
              {valor("MUNICIPIO") || "Município"}, {valor("DATA_ASSINATURA") || "data"}
            </p>
            <div className="mx-auto w-72 border-t border-foreground pt-1">
              <p>{valor("AGENTE") || "Agente de contratação"}</p>
              <p className="text-xs text-muted-foreground">
                {valor("CARGO") || "Cargo"}
                {valor("MATRICULA") ? ` · Matrícula ${valor("MATRICULA")}` : ""}
              </p>
            </div>
          </footer>
        </CardContent>
      </Card>
    </AppShell>
  );
}
