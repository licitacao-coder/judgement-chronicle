import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];


async function exigirAdministrador(context: {
  supabase: { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "ADMIN",
  });
  if (!data) throw new Error("Apenas administradores podem excluir registros.");
}

async function excluirProcessoEmCascata(admin: Admin, processoId: string) {
  const { data: ocorrencias } = await admin
    .from("ocorrencias")
    .select("id")
    .eq("processo_id", processoId);
  const idsOcorrencias = (ocorrencias ?? []).map((o) => o.id);

  const { data: relatorios } = await admin
    .from("relatorios")
    .select("id, arquivo_word, arquivo_pdf")
    .eq("processo_id", processoId);
  const idsRelatorios = (relatorios ?? []).map((r) => r.id);

  const arquivos = (relatorios ?? [])
    .flatMap((r) => [r.arquivo_word, r.arquivo_pdf])
    .filter((c): c is string => Boolean(c));
  if (arquivos.length > 0) {
    await admin.storage.from("relatorios").remove(arquivos);
  }

  if (idsRelatorios.length > 0) {
    await admin.from("relatorio_versoes").delete().in("relatorio_id", idsRelatorios);
  }
  await admin.from("relatorios").delete().eq("processo_id", processoId);

  if (idsOcorrencias.length > 0) {
    await admin.from("enquadramentos").delete().in("ocorrencia_id", idsOcorrencias);
    await admin.from("eventos_ocorrencia").delete().in("ocorrencia_id", idsOcorrencias);
    await admin.from("dados_extraidos").delete().in("ocorrencia_id", idsOcorrencias);
  }
  await admin.from("dados_extraidos").delete().eq("processo_id", processoId);
  await admin.from("ocorrencias").delete().eq("processo_id", processoId);
  await admin.from("licitantes").delete().eq("processo_id", processoId);

  const { error } = await admin.from("processos").delete().eq("id", processoId);
  if (error) throw new Error(error.message);
}

export const excluirProcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ processoId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await exigirAdministrador(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await excluirProcessoEmCascata(supabaseAdmin, data.processoId);

    await supabaseAdmin.from("auditoria").insert({
      usuario_id: context.userId,
      entidade: "processos",
      entidade_id: data.processoId,
      acao: "EXCLUIR_PROCESSO",
    });

    return { ok: true };
  });

export const excluirDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ documentoId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await exigirAdministrador(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: documento, error: erroDoc } = await supabaseAdmin
      .from("documentos")
      .select("id, caminho_arquivo")
      .eq("id", data.documentoId)
      .maybeSingle();
    if (erroDoc) throw new Error(erroDoc.message);
    if (!documento) throw new Error("Documento não encontrado.");

    const { data: processos } = await supabaseAdmin
      .from("processos")
      .select("id")
      .eq("documento_id", data.documentoId);
    for (const p of processos ?? []) {
      await excluirProcessoEmCascata(supabaseAdmin, p.id);
    }

    const { data: evidencias } = await supabaseAdmin
      .from("evidencias")
      .select("id")
      .eq("documento_id", data.documentoId);
    const idsEvidencias = (evidencias ?? []).map((e) => e.id);
    if (idsEvidencias.length > 0) {
      await supabaseAdmin
        .from("eventos_ocorrencia")
        .update({ evidencia_id: null })
        .in("evidencia_id", idsEvidencias);
      await supabaseAdmin
        .from("dados_extraidos")
        .update({ evidencia_id: null })
        .in("evidencia_id", idsEvidencias);
    }
    await supabaseAdmin.from("dados_extraidos").delete().eq("documento_id", data.documentoId);
    await supabaseAdmin.from("evidencias").delete().eq("documento_id", data.documentoId);

    if (documento.caminho_arquivo) {
      await supabaseAdmin.storage.from("documentos").remove([documento.caminho_arquivo]);
    }

    const { error } = await supabaseAdmin
      .from("documentos")
      .delete()
      .eq("id", data.documentoId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("auditoria").insert({
      usuario_id: context.userId,
      entidade: "documentos",
      entidade_id: data.documentoId,
      acao: "EXCLUIR_DOCUMENTO",
    });

    return { ok: true };
  });
