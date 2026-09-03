import { createFileRoute } from "@tanstack/react-router";

const CONTAS = [
  {
    email: "admin@ocorrencias.gov.br",
    senha: "Admin@2026",
    nome: "Administrador do Sistema",
    cargo: "Agente de Contratação",
    papel: "ADMIN" as const,
  },
  {
    email: "analista@ocorrencias.gov.br",
    senha: "Analista@2026",
    nome: "Analista de Processos",
    cargo: "Analista Administrativo",
    papel: "ANALISTA" as const,
  },
];

export const Route = createFileRoute("/api/public/seed-usuarios")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { count } = await supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true });
        if ((count ?? 0) > 0) {
          return Response.json({ ok: true, skipped: true });
        }

        const criados: string[] = [];
        for (const conta of CONTAS) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: conta.email,
            password: conta.senha,
            email_confirm: true,
            user_metadata: { nome: conta.nome, cargo: conta.cargo },
          });
          if (error || !data.user) {
            return Response.json({ ok: false, error: error?.message }, { status: 500 });
          }
          await supabaseAdmin.from("profiles").upsert({
            id: data.user.id,
            nome: conta.nome,
            email: conta.email,
            cargo: conta.cargo,
            ativo: true,
          });
          await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user.id);
          await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: data.user.id, role: conta.papel });
          criados.push(`${conta.email}:${conta.papel}`);
        }

        return Response.json({ ok: true, criados });
      },
    },
  },
});
