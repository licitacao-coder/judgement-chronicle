import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { placeholdersTemplate } from "@/lib/admin.functions";
import {
  obterConfigIA,
  salvarConfigIA,
  obterConfigMotor,
  salvarConfigMotor,
  testarConexaoMotor,
} from "@/lib/motores.functions";

const SITUACAO_MOTOR: Record<string, string> = {
  NAO_CONFIGURADO: "Não configurado",
  NAO_VERIFICADO: "Não verificado",
  ATIVO: "Ativo",
  INDISPONIVEL: "Indisponível",
};

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações do template | Relatório de Ocorrência em Sessão Pública" },
      {
        name: "description",
        content:
          "Defina as seções, os campos e os placeholders da estrutura do template Word do relatório de ocorrência.",
      },
      { property: "og:title", content: "Configurações do template Word" },
      {
        property: "og:description",
        content: "Estrutura de seções, campos e placeholders do documento oficial.",
      },
    ],
  }),
  component: Configuracoes,
});

type Secao = {
  chave: string;
  titulo: string;
  ordem: number;
  obrigatoria: boolean;
  texto_padrao: string;
};

type Campo = {
  chave: string;
  rotulo: string;
  origem: string;
  obrigatorio: boolean;
};

const ORIGENS: Record<string, string> = {
  EXTRACAO: "Extraído do documento",
  IA_REVISADO: "Redigido pela IA e revisado",
  MANUAL: "Preenchimento manual",
  AUTOMATICO: "Gerado pelo sistema",
};

function Configuracoes() {
  const { ehAdministrador, carregando } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["configuracao-template"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracao_template")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: placeholders } = useQuery({
    queryKey: ["placeholders-template"],
    queryFn: () => placeholdersTemplate({ data: undefined as never }),
    enabled: ehAdministrador,
  });

  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [observacoes, setObservacoes] = useState("");
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [salvando, setSalvando] = useState(false);

  const [endereco, setEndereco] = useState("");
  const [motorPadrao, setMotorPadrao] = useState<"INTERNO" | "PYTHON">("INTERNO");
  const [obsMotor, setObsMotor] = useState("");
  const [ocupadoMotor, setOcupadoMotor] = useState(false);
  const [chaveIA, setChaveIA] = useState("");
  const [modeloIA, setModeloIA] = useState("");
  const [ocupadoIA, setOcupadoIA] = useState(false);

  const { data: configIA } = useQuery({
    queryKey: ["configuracao_ia"],
    queryFn: () => obterConfigIA(),
  });

  async function salvarIA() {
    setOcupadoIA(true);
    try {
      await salvarConfigIA({
        data: { chave: chaveIA.trim() || null, modelo: modeloIA.trim() || null },
      });
      setChaveIA("");
      toast.success("Configuração da IA salva.");
      await queryClient.invalidateQueries({ queryKey: ["configuracao_ia"] });
    } catch (e) {
      toast.error("Não foi possível salvar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setOcupadoIA(false);
    }
  }

  const { data: configMotor } = useQuery({
    queryKey: ["configuracao_motor"],
    queryFn: () => obterConfigMotor(),
  });

  useEffect(() => {
    if (!configMotor) return;
    setEndereco(configMotor.endereco_servico ?? "");
    setMotorPadrao(configMotor.motor_padrao);
    setObsMotor(configMotor.observacoes ?? "");
  }, [configMotor]);

  async function salvarMotores() {
    setOcupadoMotor(true);
    try {
      await salvarConfigMotor({
        data: { endereco: endereco.trim() || null, motorPadrao, observacoes: obsMotor || null },
      });
      toast.success("Configuração dos motores salva.");
      await queryClient.invalidateQueries({ queryKey: ["configuracao_motor"] });
    } catch (e) {
      toast.error("Não foi possível salvar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setOcupadoMotor(false);
    }
  }

  async function testarMotor() {
    setOcupadoMotor(true);
    try {
      const r = await testarConexaoMotor();
      await queryClient.invalidateQueries({ queryKey: ["configuracao_motor"] });
      if (r.ok) toast.success("O serviço do órgão respondeu normalmente.");
      else toast.error("O serviço não respondeu", { description: r.mensagem });
    } catch (e) {
      toast.error("Não foi possível testar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setOcupadoMotor(false);
    }
  }

  useEffect(() => {
    if (!config) return;
    setNome(config.nome);
    setAtivo(config.ativo);
    setObservacoes(config.observacoes ?? "");
    setSecoes(((config.secoes ?? []) as unknown as Secao[]).slice().sort((a, b) => a.ordem - b.ordem));
    setCampos((config.campos ?? []) as unknown as Campo[]);
  }, [config]);

  async function salvar() {
    if (!config) return;
    setSalvando(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("configuracao_template")
        .update({
          nome,
          ativo,
          observacoes,
          secoes: secoes.map((s, i) => ({ ...s, ordem: i + 1 })) as never,
          campos: campos as never,
          usuario_atualizacao: sessao.user?.id ?? null,
        })
        .eq("id", config.id);
      if (error) throw error;
      toast.success("Estrutura do template atualizada.");
      void queryClient.invalidateQueries({ queryKey: ["configuracao-template"] });
    } catch (e) {
      toast.error("Não foi possível salvar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSalvando(false);
    }
  }

  const chavesTemplate = new Set(placeholders ?? []);
  const camposSemPlaceholder = campos.filter((c) => placeholders && !chavesTemplate.has(c.chave));
  const placeholdersSemCampo = (placeholders ?? []).filter(
    (p) => !campos.some((c) => c.chave === p),
  );

  return (
    <AppShell
      titulo="Configurações do template Word"
      descricao="Defina a estrutura do documento oficial: seções, ordem, campos e origem de cada informação. O arquivo modelo continua sendo a fonte da formatação, margens, cabeçalhos e rodapés."
      acoes={
        ehAdministrador ? (
          <Button onClick={() => void salvar()} disabled={salvando || !config}>
            {salvando ? "Salvando..." : "Salvar configuração"}
          </Button>
        ) : undefined
      }
    >
      {!carregando && !ehAdministrador ? (
        <Card className="panel">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Somente administradores podem alterar a estrutura do template. Você pode visualizar a
            configuração vigente com um perfil administrador.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando configuração...</p>
      ) : (
        <Tabs defaultValue="secoes" className="space-y-6">
          <TabsList>
            <TabsTrigger value="secoes">Seções do documento</TabsTrigger>
            <TabsTrigger value="campos">Campos e placeholders</TabsTrigger>
            <TabsTrigger value="modelo">Modelo e validação</TabsTrigger>
            <TabsTrigger value="motores">Motores de análise</TabsTrigger>
          </TabsList>

          <TabsContent value="motores" className="space-y-4">
            <Card className="panel">
              <CardHeader>
                <CardTitle className="text-base">Chave da inteligência artificial</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="text-sm text-muted-foreground">
                  Guarde aqui a chave usada nas análises por IA. No aplicativo publicado ela já vem
                  configurada; na cópia executada no seu computador é preciso cadastrá-la.
                </p>
                <div className="grid gap-2 sm:max-w-md">
                  <Label>Chave da IA</Label>
                  <Input
                    type="password"
                    value={chaveIA}
                    onChange={(e) => setChaveIA(e.target.value)}
                    placeholder={
                      configIA?.chaveConfigurada
                        ? "Chave guardada — preencha só para substituir"
                        : "Cole a chave aqui"
                    }
                  />
                </div>
                <div className="grid gap-2 sm:max-w-md">
                  <Label>Modelo (opcional)</Label>
                  <Input
                    value={modeloIA}
                    onChange={(e) => setModeloIA(e.target.value)}
                    placeholder="google/gemini-3.1-pro-preview"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void salvarIA()} disabled={ocupadoIA}>
                    {ocupadoIA ? "Salvando..." : "Salvar chave da IA"}
                  </Button>
                  <Badge variant={configIA?.chaveConfigurada ? "default" : "secondary"}>
                    {configIA?.origem === "AMBIENTE"
                      ? "Configurada no aplicativo"
                      : configIA?.chaveConfigurada
                        ? "Chave cadastrada"
                        : "Sem chave"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  A chave nunca é exibida de volta. Para apagá-la, digite REMOVER no campo e salve.
                </p>
              </CardContent>
            </Card>

            <Card className="panel">
              <CardHeader>
                <CardTitle className="text-base">Motores de leitura dos documentos</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="text-sm text-muted-foreground">
                  Esta aba serve apenas para cadastrar o serviço próprio do órgão (leitura local).
                  Nenhuma configuração é necessária para usar a IA: ela já está pronta e é a opção
                  padrão.
                </p>
                <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
                  <p className="font-medium">Onde escolher entre IA e leitura local</p>
                  <p className="mt-1 text-muted-foreground">
                    Na tela <span className="font-medium">Itens aceitos</span>, antes de enviar o
                    Termo de Julgamento, existe um seletor com duas opções:{" "}
                    <span className="font-medium">Usar IA</span> (funciona sempre, sem instalação) e{" "}
                    <span className="font-medium">Usar Local</span> (só fica disponível depois que o
                    endereço abaixo estiver salvo e respondendo ao teste de conexão).
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  O passo a passo de instalação no Windows está no arquivo
                  {" "}
                  <span className="font-medium">servico-python/INSTALAR-WINDOWS.md</span> do
                  projeto.
                </p>
                <div className="grid gap-2">
                  <Label>Endereço do serviço do órgão</Label>
                  <Input
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="https://leitura.orgao.gov.br"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={obsMotor}
                    onChange={(e) => setObsMotor(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void salvarMotores()} disabled={ocupadoMotor}>
                    {ocupadoMotor ? "Salvando..." : "Salvar motores"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void testarMotor()}
                    disabled={ocupadoMotor || !endereco}
                  >
                    Testar conexão
                  </Button>
                  <Badge variant={configMotor?.situacao === "ATIVO" ? "default" : "secondary"}>
                    {SITUACAO_MOTOR[configMotor?.situacao ?? "NAO_CONFIGURADO"] ??
                      configMotor?.situacao}
                  </Badge>
                  {configMotor?.versao_servico ? (
                    <span className="text-xs text-muted-foreground">
                      Versão {configMotor.versao_servico}
                    </span>
                  ) : null}
                </div>
                {configMotor?.mensagem_verificacao ? (
                  <p className="text-xs text-muted-foreground">
                    {configMotor.mensagem_verificacao}
                    {configMotor.ultima_verificacao
                      ? ` · verificado em ${new Date(configMotor.ultima_verificacao).toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                ) : null}
                {!configMotor?.chaveConfigurada ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma chave de acesso ao serviço do órgão está guardada. Se o serviço exigir
                    chave, peça o cadastro dela antes de usar o motor.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="secoes" className="space-y-4">
            {secoes.map((s, i) => (
              <Card key={`${s.chave}-${i}`} className="panel">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    {i + 1}. {s.titulo || s.chave}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={i === 0}
                      onClick={() => {
                        const copia = [...secoes];
                        const anterior = copia[i - 1]!;
                        copia[i - 1] = copia[i]!;
                        copia[i] = anterior;
                        setSecoes(copia);
                      }}
                    >
                      Subir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={i === secoes.length - 1}
                      onClick={() => {
                        const copia = [...secoes];
                        const proxima = copia[i + 1]!;
                        copia[i + 1] = copia[i]!;
                        copia[i] = proxima;
                        setSecoes(copia);
                      }}
                    >
                      Descer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSecoes(secoes.filter((_, x) => x !== i))}
                    >
                      Remover
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="label-field text-muted-foreground">Chave</p>
                    <Input
                      value={s.chave}
                      onChange={(e) =>
                        setSecoes(
                          secoes.map((x, xi) =>
                            xi === i ? { ...x, chave: e.target.value.toUpperCase() } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="label-field text-muted-foreground">Título da seção</p>
                    <Input
                      value={s.titulo}
                      onChange={(e) =>
                        setSecoes(secoes.map((x, xi) => (xi === i ? { ...x, titulo: e.target.value } : x)))
                      }
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <p className="label-field text-muted-foreground">
                      Texto padrão / orientação de preenchimento
                    </p>
                    <Textarea
                      rows={2}
                      value={s.texto_padrao}
                      onChange={(e) =>
                        setSecoes(
                          secoes.map((x, xi) =>
                            xi === i ? { ...x, texto_padrao: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`obrig-${i}`}
                      checked={s.obrigatoria}
                      onCheckedChange={(v) =>
                        setSecoes(secoes.map((x, xi) => (xi === i ? { ...x, obrigatoria: v } : x)))
                      }
                    />
                    <Label htmlFor={`obrig-${i}`} className="text-sm">
                      Seção obrigatória
                    </Label>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                setSecoes([
                  ...secoes,
                  {
                    chave: "NOVA_SECAO",
                    titulo: "Nova seção",
                    ordem: secoes.length + 1,
                    obrigatoria: false,
                    texto_padrao: "",
                  },
                ])
              }
            >
              Adicionar seção
            </Button>
          </TabsContent>

          <TabsContent value="campos" className="space-y-4">
            <Card className="panel">
              <CardHeader>
                <CardTitle className="text-base">Campos do template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {campos.map((c, i) => (
                  <div key={`${c.chave}-${i}`} className="grid gap-3 border-b border-border/60 pb-4 md:grid-cols-4">
                    <div className="space-y-1.5">
                      <p className="label-field text-muted-foreground">Placeholder</p>
                      <Input
                        value={c.chave}
                        onChange={(e) =>
                          setCampos(
                            campos.map((x, xi) =>
                              xi === i ? { ...x, chave: e.target.value.toUpperCase() } : x,
                            ),
                          )
                        }
                      />
                      <p className="font-mono text-xs text-muted-foreground">
                        {`{{${c.chave}}}`}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="label-field text-muted-foreground">Rótulo</p>
                      <Input
                        value={c.rotulo}
                        onChange={(e) =>
                          setCampos(campos.map((x, xi) => (xi === i ? { ...x, rotulo: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="label-field text-muted-foreground">Origem do dado</p>
                      <Select
                        value={c.origem}
                        onValueChange={(v) =>
                          setCampos(campos.map((x, xi) => (xi === i ? { ...x, origem: v } : x)))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ORIGENS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`campo-obrig-${i}`}
                          checked={c.obrigatorio}
                          onCheckedChange={(v) =>
                            setCampos(campos.map((x, xi) => (xi === i ? { ...x, obrigatorio: v } : x)))
                          }
                        />
                        <Label htmlFor={`campo-obrig-${i}`} className="text-sm">
                          Obrigatório
                        </Label>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCampos(campos.filter((_, x) => x !== i))}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() =>
                    setCampos([
                      ...campos,
                      { chave: "NOVO_CAMPO", rotulo: "Novo campo", origem: "MANUAL", obrigatorio: false },
                    ])
                  }
                >
                  Adicionar campo
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modelo" className="space-y-4">
            <Card className="panel">
              <CardHeader>
                <CardTitle className="text-base">Modelo em uso</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="label-field text-muted-foreground">Nome da configuração</p>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="config-ativo" checked={ativo} onCheckedChange={setAtivo} />
                  <Label htmlFor="config-ativo" className="text-sm">
                    Configuração ativa
                  </Label>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <p className="label-field text-muted-foreground">Observações internas</p>
                  <Textarea
                    rows={3}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="panel">
              <CardHeader>
                <CardTitle className="text-base">
                  Validação com os placeholders do arquivo modelo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="label-field text-muted-foreground">Placeholders no arquivo Word</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(placeholders ?? []).map((p) => (
                      <Badge key={p} variant="secondary" className="font-mono">
                        {p}
                      </Badge>
                    ))}
                    {!(placeholders ?? []).length ? (
                      <span className="text-muted-foreground">Não foi possível ler o modelo.</span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <p className="label-field text-muted-foreground">
                    Campos configurados que não existem no modelo
                  </p>
                  <p className="mt-1">
                    {camposSemPlaceholder.length
                      ? camposSemPlaceholder.map((c) => c.chave).join(", ")
                      : "Nenhum. Todos os campos possuem placeholder correspondente."}
                  </p>
                </div>
                <div>
                  <p className="label-field text-muted-foreground">
                    Placeholders do modelo ainda não configurados
                  </p>
                  <p className="mt-1">
                    {placeholdersSemCampo.length
                      ? placeholdersSemCampo.join(", ")
                      : "Nenhum. O modelo está totalmente mapeado."}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  A formatação, margens, cabeçalhos, rodapés, tabelas e campos de assinatura vêm do
                  arquivo modelo oficial e não são alterados por esta tela.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
