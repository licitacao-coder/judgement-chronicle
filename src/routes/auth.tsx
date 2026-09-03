import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso restrito | Relatório de Ocorrência em Sessão Pública" },
      {
        name: "description",
        content:
          "Área de acesso para servidores responsáveis pela análise de processos licitatórios.",
      },
      { property: "og:title", content: "Acesso ao sistema de relatórios de ocorrência" },
      {
        property: "og:description",
        content: "Autenticação de servidores para análise de sessões públicas de licitação.",
      },
    ],
  }),
  component: PaginaAuth,
});

function PaginaAuth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [cargo, setCargo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
  }, [navigate]);

  async function entrar() {
    setOcupado(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setOcupado(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    void navigate({ to: "/" });
  }

  async function cadastrar() {
    setOcupado(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { nome, matricula, cargo },
      },
    });
    setOcupado(false);
    if (error) {
      toast.error("Não foi possível cadastrar", { description: error.message });
      return;
    }
    toast.success("Cadastro realizado", {
      description: "Confirme o e-mail, se solicitado, e faça o acesso.",
    });
  }

  async function entrarComGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) toast.error("Falha no acesso com Google", { description: error.message });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div>
          <p className="label-field text-sidebar-foreground/60">Órgão público</p>
          <h1 className="mt-3 text-3xl leading-tight">
            Gerador de Relatório de Ocorrência em Sessão Pública
          </h1>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/80">
            Leitura integral do Termo de Julgamento, Relatório de Julgamento ou Ata da Sessão,
            identificação de licitantes e ocorrências, reconstrução cronológica dos fatos e emissão
            do documento oficial em Microsoft Word.
          </p>
        </div>
        <p className="max-w-md text-xs text-sidebar-foreground/60">
          O sistema produz registro preliminar e informativo dos fatos. Não emite juízo de
          responsabilidade nem aplica sanção administrativa.
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="panel w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">Acesso restrito a servidores</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="entrar">
              <TabsList className="w-full">
                <TabsTrigger className="flex-1" value="entrar">
                  Entrar
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="cadastrar">
                  Criar acesso
                </TabsTrigger>
              </TabsList>

              <TabsContent value="entrar" className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label className="label-field">E-mail institucional</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                </div>
                <div className="space-y-1.5">
                  <Label className="label-field">Senha</Label>
                  <Input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" />
                </div>
                <Button className="w-full" onClick={() => void entrar()} disabled={ocupado}>
                  Entrar
                </Button>
              </TabsContent>

              <TabsContent value="cadastrar" className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label className="label-field">Nome completo</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="label-field">Matrícula</Label>
                    <Input value={matricula} onChange={(e) => setMatricula(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="label-field">Cargo/Função</Label>
                    <Input value={cargo} onChange={(e) => setCargo(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="label-field">E-mail institucional</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                </div>
                <div className="space-y-1.5">
                  <Label className="label-field">Senha</Label>
                  <Input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" />
                </div>
                <Button className="w-full" onClick={() => void cadastrar()} disabled={ocupado}>
                  Criar acesso
                </Button>
              </TabsContent>
            </Tabs>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={() => void entrarComGoogle()}>
              Continuar com Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
