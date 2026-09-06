import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { AlterarSenha } from "@/components/AlterarSenha";

export function AppShell({
  children,
  titulo,
  descricao,
  acoes,
}: {
  children: ReactNode;
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  const { user, perfil, papel, carregando, sair, ehAdministrador } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!carregando && !user) void navigate({ to: "/auth" });
  }, [carregando, user, navigate]);

  if (carregando || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link to="/" className="leading-tight">
            <p className="label-field text-sidebar-foreground/60">
              Relatório de Ocorrência em Sessão Pública
            </p>
            <p className="text-lg">Painel de análise</p>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-3 text-sm">
              <Link to="/" className="hover:underline">
                Processos
              </Link>
              <Link to="/documentos" className="hover:underline">
                Documentos
              </Link>
              <Link to="/relatorios" className="hover:underline">
                Relatórios
              </Link>

              {ehAdministrador ? (
                <>
                  <Link to="/usuarios" className="hover:underline">
                    Usuários
                  </Link>
                  <Link to="/configuracoes" className="hover:underline">
                    Configurações
                  </Link>
                </>
              ) : null}
            </nav>

            <div className="text-right text-xs text-sidebar-foreground/80">
              <p>{perfil?.nome ?? user.email}</p>
              <p className="text-sidebar-foreground/60">{papel}</p>
            </div>
            <AlterarSenha />
            <Button size="sm" variant="secondary" onClick={() => void sair()}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl">{titulo}</h1>
            {descricao ? (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{descricao}</p>
            ) : null}
          </div>
          {acoes}
        </div>
        {children}
      </main>

      <footer className="border-t border-border py-6">
        <p className="mx-auto max-w-6xl px-6 text-xs text-muted-foreground">
          Registro preliminar e informativo de fatos ocorridos em sessão pública. Não constitui
          juízo de responsabilidade, penalidade ou sanção administrativa.
        </p>
      </footer>
    </div>
  );
}
