import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/lib/useAuth";
import { excluirDocumento } from "@/lib/exclusao.functions";


export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos recebidos | Relatório de Ocorrência em Sessão Pública" },
      {
        name: "description",
        content:
          "Relação dos termos de julgamento, atas e relatórios enviados para leitura e análise da sessão pública.",
      },
      { property: "og:title", content: "Documentos recebidos para análise" },
      {
        property: "og:description",
        content: "Consulte os arquivos enviados, situação de leitura e páginas extraídas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaDocumentos,
});

const ROTULO_CATEGORIA: Record<string, string> = {
  TERMO_JULGAMENTO: "Termo de Julgamento",
  RELATORIO_JULGAMENTO: "Relatório de Julgamento",
  ATA_SESSAO: "Ata da Sessão",
  RELATORIO_DILIGENCIA: "Relatório de Diligências",
  CHAT_MENSAGENS: "Chat/Mensagens da sessão",
  PRINCIPAL: "Documento principal",
  OUTRO: "Outro documento equivalente",
};

function PaginaDocumentos() {
  const { data: documentos, isLoading } = useQuery({
    queryKey: ["documentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select(
          "id, nome_original, categoria, extensao, tamanho, quantidade_paginas, status_processamento, data_upload, caminho_arquivo",
        )
        .order("data_upload", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function baixar(caminho: string | null) {
    if (!caminho) {
      toast.error("Arquivo indisponível para download.");
      return;
    }
    const { data, error } = await supabase.storage
      .from("documentos")
      .createSignedUrl(caminho, 120);
    if (error || !data) {
      toast.error("Não foi possível gerar o link", { description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <AppShell
      titulo="Documentos recebidos"
      descricao="Arquivos enviados para leitura integral e análise. O conteúdo é usado apenas como base factual: nenhuma ocorrência é convertida em responsabilidade, penalidade ou sanção."
    >
      <Card className="panel">
        <CardHeader>
          <CardTitle className="text-base">Arquivos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (documentos ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum documento enviado até o momento.
            </p>
          ) : (
            (documentos ?? []).map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.nome_original}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ROTULO_CATEGORIA[d.categoria] ?? d.categoria} ·{" "}
                    {(d.extensao ?? "").toUpperCase()} ·{" "}
                    {d.tamanho ? `${Math.round(Number(d.tamanho) / 1024)} KB` : "tamanho não informado"}
                    {d.quantidade_paginas ? ` · ${d.quantidade_paginas} página(s)` : ""}
                    {d.data_upload
                      ? ` · ${new Date(d.data_upload).toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{d.status_processamento}</Badge>
                  <Button size="sm" variant="outline" onClick={() => void baixar(d.caminho_arquivo)}>
                    Baixar
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
