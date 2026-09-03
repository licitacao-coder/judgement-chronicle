/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import appCss from "@/styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gerador de Relatório de Ocorrência em Sessão Pública" },
      {
        name: "description",
        content:
          "Sistema para leitura de documentos de sessão pública, identificação de ocorrências e emissão do relatório oficial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Libre+Baskerville:wght@400;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <Documento>
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="text-2xl">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground">
          O endereço acessado não existe neste sistema.
        </p>
        <a className="text-sm text-accent underline" href="/">
          Voltar ao painel
        </a>
      </div>
    </Documento>
  ),
});

function RootComponent() {
  return (
    <Documento>
      <Outlet />
      <Toaster position="top-right" richColors />
    </Documento>
  );
}

function Documento({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
