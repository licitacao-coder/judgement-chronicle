import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/relatorios/")({
  head: () => ({
    meta: [
      { title: "Relatórios gerados | Relatório de Ocorrência em Sessão Pública" },
      {
        name: "description",
        content:
          "Relação dos relatórios de ocorrência gerados, com situação de revisão, numeração e acesso ao documento oficial em Word.",
      },
      { property: "og:title", content: "Relatórios de ocorrência gerados" },
      {
        property: "og:description",
        content: "Consulte, imprima e baixe o documento oficial em Word de cada relatório.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaRelatorios,
});

export const ROTULO_STATUS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  EM_REVISAO: "Em revisão",
  GERADO: "Word gerado",
  FINAL: "Documento oficial",
};

function PaginaRelatorios() {
  const { data: relatorios, isLoading } = useQuery({
    queryKey: ["relatorios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relatorios")
        .select(
          "id, numero_relatorio, ano, status, versao, updated_at, arquivo_word, dados_json, processo_id",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell
      titulo="Relatórios gerados"
      descricao="Relação dos relatórios de ocorrência. Abra um relatório para visualizar, imprimir, baixar o Word e registrar a versão final como documento oficial."
    >
      <Card className="panel">
        <CardHeader>
          <CardTitle className="text-base">Relatórios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (relatorios ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum relatório gerado até o momento.
            </p>
          ) : (
            (relatorios ?? []).map((r) => {
              const campos = (r.dados_json ?? {}) as Record<string, string>;
              return (
                <Link
                  key={r.id}
                  to="/relatorios/$relatorioId"
                  params={{ relatorioId: r.id }}
                  className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:border-accent"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      Relatório nº {r.numero_relatorio ?? "___"}/{r.ano ?? "____"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {campos["RAZAO_SOCIAL"] ?? "Licitante não informado"}
                      {campos["MODALIDADE_NUMERO"] ? ` · ${campos["MODALIDADE_NUMERO"]}` : ""}
                      {r.updated_at
                        ? ` · atualizado em ${new Date(r.updated_at).toLocaleString("pt-BR")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary">versão {r.versao}</Badge>
                    <Badge>{ROTULO_STATUS[r.status] ?? r.status}</Badge>
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
