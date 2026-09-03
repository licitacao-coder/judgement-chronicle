import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAPEIS = ["ADMIN", "ANALISTA", "REVISOR", "CONSULTA"] as const;

async function exigirAdministrador(context: {
  supabase: { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "ADMIN",
  });
  if (!data) throw new Error("Apenas administradores podem gerenciar usuários.");
}

export const listarUsuarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdministrador(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: perfis }, { data: papeis }, { data: contas }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: true }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);

    const porId = new Map(
      (contas?.users ?? []).map((u) => [
        u.id,
        {
          email: u.email ?? null,
          ultimo_login: u.last_sign_in_at ?? null,
          confirmado: Boolean(u.email_confirmed_at),
        },
      ]),
    );

    return (perfis ?? []).map((p) => ({
      id: p.id,
      nome: p.nome ?? "",
      email: p.email ?? porId.get(p.id)?.email ?? "",
      cargo: p.cargo ?? "",
      matricula: p.matricula ?? "",
      orgao: p.orgao ?? "",
      ativo: p.ativo,
      ultimo_login: porId.get(p.id)?.ultimo_login ?? null,
      confirmado: porId.get(p.id)?.confirmado ?? false,
      papeis: (papeis ?? []).filter((r) => r.user_id === p.id).map((r) => String(r.role)),
    }));
  });

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        senha: z.string().min(8),
        nome: z.string().min(3),
        matricula: z.string().optional().default(""),
        cargo: z.string().optional().default(""),
        orgao: z.string().optional().default(""),
        papel: z.enum(PAPEIS),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirAdministrador(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome, matricula: data.matricula, cargo: data.cargo },
    });
    if (error || !criado.user) throw new Error(error?.message ?? "Falha ao criar o usuário.");

    await supabaseAdmin.from("profiles").upsert({
      id: criado.user.id,
      nome: data.nome,
      email: data.email,
      matricula: data.matricula || null,
      cargo: data.cargo || null,
      orgao: data.orgao || null,
      ativo: true,
    });

    await supabaseAdmin.from("user_roles").delete().eq("user_id", criado.user.id);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: criado.user.id, role: data.papel });

    await supabaseAdmin.from("auditoria").insert({
      usuario_id: context.userId,
      entidade: "usuarios",
      entidade_id: criado.user.id,
      acao: "CRIAR_USUARIO",
      campo_alterado: "papel",
      valor_novo: data.papel,
    });

    return { id: criado.user.id };
  });

export const atualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        usuarioId: z.string().uuid(),
        nome: z.string().min(3),
        matricula: z.string().optional().default(""),
        cargo: z.string().optional().default(""),
        orgao: z.string().optional().default(""),
        ativo: z.boolean(),
        papel: z.enum(PAPEIS),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirAdministrador(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.usuarioId === context.userId && data.papel !== "ADMIN") {
      throw new Error("Você não pode remover o seu próprio perfil de administrador.");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        nome: data.nome,
        matricula: data.matricula || null,
        cargo: data.cargo || null,
        orgao: data.orgao || null,
        ativo: data.ativo,
      })
      .eq("id", data.usuarioId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.usuarioId);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.usuarioId, role: data.papel });

    await supabaseAdmin.from("auditoria").insert({
      usuario_id: context.userId,
      entidade: "usuarios",
      entidade_id: data.usuarioId,
      acao: "ATUALIZAR_USUARIO",
      campo_alterado: "papel/situacao",
      valor_novo: `${data.papel}/${data.ativo ? "ATIVO" : "INATIVO"}`,
    });

    return { ok: true };
  });

export const placeholdersTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listarPlaceholders } = await import("./docx.server");
    return listarPlaceholders();
  });
