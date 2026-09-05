import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listarUsuarios, criarUsuario, atualizarUsuario } from "@/lib/admin.functions";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e permissões | Relatório de Ocorrência em Sessão Pública" },
      {
        name: "description",
        content:
          "Cadastro de servidores, definição de perfis de acesso e permissões do gerador de relatório de ocorrência.",
      },
      { property: "og:title", content: "Usuários e permissões" },
      {
        property: "og:description",
        content: "Gestão de servidores, perfis e permissões do sistema.",
      },
    ],
  }),
  component: Usuarios,
});

const PAPEIS = ["ADMIN", "ANALISTA", "REVISOR", "CONSULTA"] as const;
type Papel = (typeof PAPEIS)[number];

const ROTULO_PAPEL: Record<Papel, string> = {
  ADMIN: "Administrador",
  ANALISTA: "Analista",
  REVISOR: "Revisor",
  CONSULTA: "Consulta",
};

const PERMISSOES: { acao: string; papeis: Papel[] }[] = [
  { acao: "Enviar documentos e executar a análise", papeis: ["ADMIN", "ANALISTA"] },
  { acao: "Editar o formulário de revisão", papeis: ["ADMIN", "ANALISTA", "REVISOR"] },
  { acao: "Confirmar checklist e gerar o Word oficial", papeis: ["ADMIN", "ANALISTA", "REVISOR"] },
  { acao: "Consultar processos, relatórios e evidências", papeis: ["ADMIN", "ANALISTA", "REVISOR", "CONSULTA"] },
  { acao: "Cadastrar usuários e definir perfis", papeis: ["ADMIN"] },
  { acao: "Configurar a estrutura do template Word", papeis: ["ADMIN"] },
];

type Usuario = Awaited<ReturnType<typeof listarUsuarios>>[number];

type DadosAtualizacao = {
  usuarioId: string;
  nome: string;
  matricula: string;
  cargo: string;
  orgao: string;
  ativo: boolean;
  papel: Papel;
};

function papelDe(u: Usuario): Papel {
  const p = u.papeis;
  return (["ADMIN", "REVISOR", "ANALISTA", "CONSULTA"] as Papel[]).find((x) => p.includes(x)) ??
    "CONSULTA";
}

function Usuarios() {
  const { ehAdministrador, carregando } = useAuth();
  const queryClient = useQueryClient();

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => listarUsuarios({ data: undefined as never }),
    enabled: ehAdministrador,
  });

  const [novo, setNovo] = useState({
    email: "",
    senha: "",
    nome: "",
    matricula: "",
    cargo: "",
    orgao: "",
    papel: "ANALISTA" as Papel,
  });

  const criar = useMutation({
    mutationFn: () => criarUsuario({ data: novo }),
    onSuccess: () => {
      toast.success("Usuário cadastrado.");
      setNovo({ ...novo, email: "", senha: "", nome: "", matricula: "", cargo: "" });
      void queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e: unknown) =>
      toast.error("Não foi possível cadastrar", {
        description: e instanceof Error ? e.message : String(e),
      }),
  });

  const atualizar = useMutation({
    mutationFn: (dados: DadosAtualizacao) => atualizarUsuario({ data: dados }),
    onSuccess: () => {
      toast.success("Cadastro atualizado.");
      void queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e: unknown) =>
      toast.error("Não foi possível atualizar", {
        description: e instanceof Error ? e.message : String(e),
      }),
  });

  return (
    <AppShell
      titulo="Usuários, perfis e permissões"
      descricao="Cadastre servidores, defina o perfil de acesso e consulte o que cada perfil pode fazer no sistema."
    >
      {!carregando && !ehAdministrador ? (
        <Card className="panel">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Esta área é restrita a administradores. Solicite acesso ao administrador do sistema.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="lista" className="space-y-6">
          <TabsList>
            <TabsTrigger value="lista">Usuários cadastrados</TabsTrigger>
            <TabsTrigger value="novo">Novo cadastro</TabsTrigger>
            <TabsTrigger value="permissoes">Perfis e permissões</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando usuários...</p>
            ) : (
              (usuarios ?? []).map((u) => (
                <LinhaUsuario
                  key={u.id}
                  usuario={u}
                  salvando={atualizar.isPending}
                  onSalvar={(dados) => atualizar.mutate(dados)}
                />
              ))
            )}
            {!isLoading && !(usuarios ?? []).length ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
            ) : null}
          </TabsContent>

          <TabsContent value="novo">
            <Card className="panel">
              <CardHeader>
                <CardTitle className="text-base">Cadastrar servidor</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Campo label="Nome completo">
                  <Input
                    value={novo.nome}
                    onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                  />
                </Campo>
                <Campo label="E-mail institucional">
                  <Input
                    type="email"
                    value={novo.email}
                    onChange={(e) => setNovo({ ...novo, email: e.target.value })}
                  />
                </Campo>
                <Campo label="Senha provisória (mín. 8 caracteres)">
                  <Input
                    type="password"
                    value={novo.senha}
                    onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
                  />
                </Campo>
                <Campo label="Matrícula">
                  <Input
                    value={novo.matricula}
                    onChange={(e) => setNovo({ ...novo, matricula: e.target.value })}
                  />
                </Campo>
                <Campo label="Cargo/função">
                  <Input
                    value={novo.cargo}
                    onChange={(e) => setNovo({ ...novo, cargo: e.target.value })}
                  />
                </Campo>
                <Campo label="Órgão/setor">
                  <Input
                    value={novo.orgao}
                    onChange={(e) => setNovo({ ...novo, orgao: e.target.value })}
                  />
                </Campo>
                <Campo label="Perfil de acesso">
                  <Select
                    value={novo.papel}
                    onValueChange={(v) => setNovo({ ...novo, papel: v as Papel })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAPEIS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {ROTULO_PAPEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <div className="flex items-end">
                  <Button
                    disabled={criar.isPending || !novo.nome || !novo.email || novo.senha.length < 8}
                    onClick={() => criar.mutate()}
                  >
                    {criar.isPending ? "Cadastrando..." : "Cadastrar usuário"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissoes">
            <Card className="panel">
              <CardHeader>
                <CardTitle className="text-base">Matriz de permissões por perfil</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-4 font-medium">Ação no sistema</th>
                      {PAPEIS.map((p) => (
                        <th key={p} className="py-2 px-2 font-medium">
                          {ROTULO_PAPEL[p]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSOES.map((linha) => (
                      <tr key={linha.acao} className="border-b border-border/60">
                        <td className="py-2 pr-4">{linha.acao}</td>
                        {PAPEIS.map((p) => (
                          <td key={p} className="py-2 px-2">
                            {linha.papeis.includes(p) ? (
                              <Badge variant="secondary">Sim</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-4 text-xs text-muted-foreground">
                  Nenhum perfil está autorizado a converter uma ocorrência em conclusão de
                  responsabilidade, penalidade ou sanção administrativa.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

function LinhaUsuario({
  usuario,
  salvando,
  onSalvar,
}: {
  usuario: Usuario;
  salvando: boolean;
  onSalvar: (dados: {
    usuarioId: string;
    nome: string;
    matricula: string;
    cargo: string;
    orgao: string;
    ativo: boolean;
    papel: Papel;
  }) => void;
}) {
  const [form, setForm] = useState({
    nome: usuario.nome,
    matricula: usuario.matricula,
    cargo: usuario.cargo,
    orgao: usuario.orgao,
    ativo: usuario.ativo,
    papel: papelDe(usuario),
  });

  return (
    <Card className="panel">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">{usuario.nome || usuario.email}</CardTitle>
          <p className="text-xs text-muted-foreground">{usuario.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={form.ativo ? "secondary" : "outline"}>
            {form.ativo ? "Ativo" : "Inativo"}
          </Badge>
          <Badge>{ROTULO_PAPEL[form.papel]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <Campo label="Nome">
          <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </Campo>
        <Campo label="Matrícula">
          <Input
            value={form.matricula}
            onChange={(e) => setForm({ ...form, matricula: e.target.value })}
          />
        </Campo>
        <Campo label="Cargo/função">
          <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
        </Campo>
        <Campo label="Órgão/setor">
          <Input value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} />
        </Campo>
        <Campo label="Perfil de acesso">
          <Select
            value={form.papel}
            onValueChange={(v) => setForm({ ...form, papel: v as Papel })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAPEIS.map((p) => (
                <SelectItem key={p} value={p}>
                  {ROTULO_PAPEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <div className="flex flex-col justify-end gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              id={`ativo-${usuario.id}`}
            />
            <Label htmlFor={`ativo-${usuario.id}`} className="text-sm">
              Acesso ativo
            </Label>
          </div>
          <Button
            size="sm"
            disabled={salvando}
            onClick={() => onSalvar({ usuarioId: usuario.id, ...form })}
          >
            Salvar alterações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="label-field text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
