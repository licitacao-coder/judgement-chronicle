import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verificarServicoPython, type ConfigMotor } from "./motores/motorPython.server";

const vazio: ConfigMotor = {
  id: null,
  endereco_servico: null,
  motor_padrao: "INTERNO",
  situacao: "NAO_CONFIGURADO",
  versao_servico: null,
  ultima_verificacao: null,
  mensagem_verificacao: null,
};

async function garantirAdmin(context: { supabase: unknown; userId: string }) {
  const supabase = context.supabase as {
    rpc: (
      nome: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: boolean | null; error: unknown }>;
  };
  const { data } = await supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "ADMIN",
  });
  if (!data) throw new Error("Somente administradores podem alterar a configuração dos motores.");
}

export const obterConfigMotor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("configuracao_motor")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!data)
      return {
        ...vazio,
        observacoes: null as string | null,
        chaveConfigurada: !!process.env["MOTOR_PYTHON_CHAVE"],
      };
    return {
      id: data.id,
      endereco_servico: data.endereco_servico,
      motor_padrao: (data.motor_padrao === "PYTHON" ? "PYTHON" : "INTERNO") as
        | "PYTHON"
        | "INTERNO",
      situacao: data.situacao,
      versao_servico: data.versao_servico,
      ultima_verificacao: data.ultima_verificacao,
      mensagem_verificacao: data.mensagem_verificacao,
      observacoes: data.observacoes,
      chaveConfigurada: !!process.env["MOTOR_PYTHON_CHAVE"],
    };
  });

export const salvarConfigMotor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        endereco: z.string().trim().max(400).nullable(),
        motorPadrao: z.enum(["INTERNO", "PYTHON"]),
        observacoes: z.string().trim().max(2000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await garantirAdmin(context);
    const supabase = context.supabase;
    // Aceita colagens com espaços, sem prefixo (ex.: meu-tunel.trycloudflare.com) e com barra/caminho final.
    const bruto = (data.endereco ?? "").replace(/\s+/g, "");
    let endereco: string | null = null;
    if (bruto.length > 0) {
      const comPrefixo = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`;
      let url: URL;
      try {
        url = new URL(comPrefixo);
      } catch {
        throw new Error("Endereço inválido. Exemplo: https://meu-servico.trycloudflare.com");
      }
      if (!url.hostname) {
        throw new Error("Endereço inválido. Exemplo: https://meu-servico.trycloudflare.com");
      }
      // Guarda apenas origem + caminho base, sem barra final e sem /situacao.
      const caminho = url.pathname.replace(/\/+$/, "").replace(/\/(situacao|texto|analise|redacao|itens-aceitos)$/i, "");
      endereco = `${url.origin}${caminho}`;
    }

    if (data.motorPadrao === "PYTHON" && !endereco) {
      throw new Error("Informe o endereço do serviço Python antes de torná-lo o motor padrão.");
    }

    const { data: existente } = await supabase
      .from("configuracao_motor")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const registro = {
      endereco_servico: endereco,
      motor_padrao: data.motorPadrao,
      situacao: endereco ? "NAO_VERIFICADO" : "NAO_CONFIGURADO",
      observacoes: data.observacoes ?? null,
      usuario_atualizacao: context.userId,
    };

    if (existente) {
      const { error } = await supabase
        .from("configuracao_motor")
        .update(registro)
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("configuracao_motor").insert(registro);
      if (error) throw new Error(error.message);
    }

    await supabase.from("auditoria").insert({
      usuario_id: context.userId,
      entidade: "configuracao_motor",
      acao: "ATUALIZACAO_CONFIG_MOTOR",
      valor_novo: `motor padrão ${data.motorPadrao}${endereco ? ` | serviço ${endereco}` : ""}`,
    });

    return { ok: true };
  });

export const testarConexaoMotor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const supabase = context.supabase;
    const { data: config } = await supabase
      .from("configuracao_motor")
      .select("id, endereco_servico")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!config?.endereco_servico) {
      throw new Error("Nenhum endereço de serviço Python está configurado.");
    }

    const resultado = await verificarServicoPython(config.endereco_servico);
    await supabase
      .from("configuracao_motor")
      .update({
        situacao: resultado.ok ? "ATIVO" : "INDISPONIVEL",
        versao_servico: resultado.ok ? resultado.versao : null,
        ultima_verificacao: new Date().toISOString(),
        mensagem_verificacao: resultado.ok
          ? `Serviço respondendo${resultado.ocr ? " com leitura de documentos digitalizados (OCR)" : ""}.`
          : resultado.mensagem,
      })
      .eq("id", config.id);

    return resultado;
  });

/** Situação da chave da IA — nunca devolve o segredo, apenas se existe. */
export const obterConfigIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { obterChaveIA } = await import("./ia.server");
    const { chave, modelo } = await obterChaveIA();
    return {
      chaveConfigurada: !!chave,
      origem: process.env["LOVABLE_API_KEY"] ? "AMBIENTE" : chave ? "CADASTRADA" : "AUSENTE",
      modelo,
    };
  });

export const salvarConfigIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        chave: z.string().trim().max(400).nullable(),
        modelo: z.string().trim().max(120).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await garantirAdmin(context);
    const supabase = context.supabase;
    const { data: existente } = await supabase
      .from("configuracao_ia")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const registro: { modelo: string | null; usuario_atualizacao: string; updated_at: string; chave?: string | null } = {
      modelo: data.modelo && data.modelo.length > 0 ? data.modelo : null,
      usuario_atualizacao: context.userId,
      updated_at: new Date().toISOString(),
    };
    // Chave vazia mantém a chave atual; use "REMOVER" para apagar.
    if (data.chave && data.chave.length > 0) {
      registro.chave = data.chave === "REMOVER" ? null : data.chave;
    }

    if (existente) {
      const { error } = await supabase
        .from("configuracao_ia")
        .update(registro)
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("configuracao_ia").insert(registro);
      if (error) throw new Error(error.message);
    }

    await supabase.from("auditoria").insert({
      usuario_id: context.userId,
      entidade: "configuracao_ia",
      acao: "ATUALIZACAO_CHAVE_IA",
      valor_novo: data.chave ? "chave atualizada" : "modelo atualizado",
    });

    return { ok: true };
  });
