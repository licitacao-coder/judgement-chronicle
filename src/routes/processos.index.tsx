import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/processos/")({
  head: () => ({
    meta: [
      { title: "Processos licitatórios | Relatório de Ocorrência em Sessão Pública" },
      {
        name: "description",
        content:
          "Cadastre cada processo licitatório e acesse o painel de itens aceitos e habilitados vinculado exclusivamente a ele.",
      },
      { property: "og:title", content: "Processos licitatórios" },
      {
        property: "og:description",
        content:
          "Cadastro de processos licitatórios com painel de itens vinculado, sem mistura entre análises.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaProcessos,
});

const MODALIDADES = [
  "Pregão Eletrônico",
  "Concorrência",
  "Dispensa Eletrônica",
  "Inexigibilidade",
  "Concurso",
  "Leilão",
  "Diálogo Competitivo",
];

const vazio = {
  modalidade: "Pregão Eletrônico",
  numero_certame: "",
  ano_certame: String(new Date().getFullYear()),
  processo_sei: "",
  numero_processo: "",
  uasg: "",
  orgao: "",
  secretaria_demandante: "",
  plataforma: "",
  data_sessao: "",
  horario_sessao: "",
  agente: "",
  objeto: "",
};

function PaginaProcessos() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState(vazio);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  const campo = (chave: keyof typeof vazio) => ({
    value: form[chave],
    onChange: (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [chave]: e.target.value })),
  });

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

  const { data: importacoes } = useQuery({
    queryKey: ["painel_importacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("painel_importacoes")
        .select("id, processo_id, total_itens, valor_total, versao, created_at, atual")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const painelPorProcesso = useMemo(() => {
    const mapa = new Map<string, { total_itens: number; valor_total: number | null }>();
    for (const i of importacoes ?? []) {
      if (!i.processo_id || mapa.has(i.processo_id)) continue;
      mapa.set(i.processo_id, { total_itens: i.total_itens, valor_total: i.valor_total });
    }
    return mapa;
  }, [importacoes]);

  const lista = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    const todos = (processos ?? []) as unknown as {
      id: string;
      modalidade: string | null;
      numero_certame: string | null;
      ano_certame: string | null;
      orgao: string | null;
      processo_sei: string | null;
      objeto: string | null;
      data_sessao: string | null;
      licitantes: unknown[];
      ocorrencias: unknown[];
      documentos: { nome_original: string } | null;
    }[];
    if (!alvo) return todos;
    return todos.filter((p) =>
      [p.modalidade, p.numero_certame, p.ano_certame, p.orgao, p.processo_sei, p.objeto]
        .join(" ")
        .toLowerCase()
        .includes(alvo),
    );
  }, [processos, busca]);

  async function cadastrar() {
    if (!form.numero_certame.trim()) {
      toast.error("Informe o número do certame.");
      return;
    }
    setSalvando(true);
    try {
      const numero = form.numero_certame.trim().replace(/\/\d{4}$/, "");
      const { error } = await supabase.from("processos").insert({
        modalidade: form.modalidade || null,
        numero_certame: numero,
        ano_certame: form.ano_certame.trim() || null,
        processo_sei: form.processo_sei.trim() || null,
        numero_processo: form.numero_processo.trim() || null,
        uasg: form.uasg.trim() || null,
        orgao: form.orgao.trim() || null,
        secretaria_demandante: form.secretaria_demandante.trim() || null,
        plataforma: form.plataforma.trim() || null,
        data_sessao: form.data_sessao.trim() || null,
        horario_sessao: form.horario_sessao.trim() || null,
        agente: form.agente.trim() || null,
        objeto: form.objeto.trim() || null,
        identificacao_completa: [form.modalidade, `nº ${numero}`, form.ano_certame ? `/${form.ano_certame}` : ""]
          .join(" ")
          .replace(/\s+\//, "/")
          .trim(),
        nivel_confianca: "ALTA",
        validado: false,
        usuario_validacao: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: ["processos"] });
      setForm(vazio);
      toast.success("Processo licitatório cadastrado.");
    } catch (e) {
      toast.error("Não foi possível cadastrar o processo", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell
      titulo="Processos licitatórios"
      descricao="Cadastre cada processo licitatório e acompanhe, para cada um deles, o painel de itens aceitos e habilitados. Cada análise fica vinculada a um único processo, sem mistura de itens entre certames."
    >
      <div className="space-y-8">
        <Card className="panel">
          <CardHeader>
            <CardTitle className="text-base">Cadastrar processo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <span className="label-field">Modalidade</span>
              <Select
                value={form.modalidade}
                onValueChange={(v) => setForm((f) => ({ ...f, modalidade: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODALIDADES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <span className="label-field">Número do certame</span>
              <Input placeholder="9" {...campo("numero_certame")} />
            </div>
            <div className="grid gap-2">
              <span className="label-field">Ano</span>
              <Input placeholder="2026" {...campo("ano_certame")} />
            </div>
            <div className="grid gap-2">
              <span className="label-field">Processo SEI</span>
              <Input {...campo("processo_sei")} />
            </div>
            <div className="grid gap-2">
              <span className="label-field">Processo administrativo</span>
              <Input {...campo("numero_processo")} />
            </div>
            <div className="grid gap-2">
              <span className="label-field">UASG</span>
              <Input {...campo("uasg")} />
            </div>
            <div className="grid gap-2">
              <span className="label-field">Órgão</span>
              <Input {...campo("orgao")} />
            </div>
            <div className="grid gap-2">
              <span className="label-field">Secretaria demandante</span>
              <Input {...campo("secretaria_demandante")} />
            </div>
            <div className="grid gap-2">
              <span className="label-field">Plataforma</span>
              <Input placeholder="Compras.gov.br" {...campo("plataforma")} />
            </div>
            <div className="grid gap-2">
              <span className="label-field">Data da sessão</span>
              <Input placeholder="dd/mm/aaaa" {...campo("data_sessao")} />
            </div>
            <div className="grid gap-2">
              <span className="label-field">Horário da sessão</span>
              <Input placeholder="09:00" {...campo("horario_sessao")} />
            </div>
            <div className="grid gap-2">
              <span className="label-field">Agente de contratação / pregoeiro</span>
              <Input {...campo("agente")} />
            </div>
            <div className="grid gap-2 md:col-span-3">
              <span className="label-field">Objeto</span>
              <Textarea rows={3} {...campo("objeto")} />
            </div>
            <div className="md:col-span-3">
              <Button disabled={salvando} onClick={() => void cadastrar()}>
                {salvando ? "Salvando..." : "Cadastrar processo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg">Processos cadastrados</h2>
            <Input
              className="sm:max-w-xs"
              placeholder="Pesquisar por modalidade, número, órgão ou objeto"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="mt-4 space-y-3">
            {lista.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum processo licitatório cadastrado.
              </p>
            ) : null}
            {lista.map((p) => {
              const painel = painelPorProcesso.get(p.id);
              const numero = (p.numero_certame ?? "").split("/")[0]?.trim() ?? "";
              const ano = (p.numero_certame ?? "").split("/")[1]?.trim() || (p.ano_certame ?? "");
              return (
                <div key={p.id} className="panel space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {p.modalidade ?? "Modalidade não informada"}
                        {numero ? ` nº ${numero}` : ""}
                        {ano ? `/${ano}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[p.orgao, p.processo_sei ? `SEI ${p.processo_sei}` : null, p.data_sessao]
                          .filter(Boolean)
                          .join(" · ") || "Dados complementares não informados"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.objeto ? p.objeto.slice(0, 160) : (p.documentos?.nome_original ?? "Objeto não informado")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="secondary">{p.licitantes?.length ?? 0} licitantes</Badge>
                      <Badge variant="secondary">{p.ocorrencias?.length ?? 0} ocorrências</Badge>
                      <Badge>
                        {painel ? `${painel.total_itens} itens no painel` : "Painel sem itens"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link to="/painel" search={{ processo: p.id }}>
                        Painel de itens deste processo
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/processos/$processoId" params={{ processoId: p.id }}>
                        Abrir análise e relatório
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
