import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { preencherTemplate, bytesParaBase64 } from "./docx.server";

function formatarNumero(n: number): string {
  return String(n).padStart(3, "0");
}

/** Reserva (uma única vez por relatório) o próximo número sequencial do ano. */
export const reservarNumeroRelatorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        relatorioId: z.string().uuid(),
        ano: z.string().min(4).max(4),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: relatorio, error } = await supabase
      .from("relatorios")
      .select("id, numero_relatorio, ano")
      .eq("id", data.relatorioId)
      .single();
    if (error || !relatorio) throw new Error("Relatório não encontrado.");

    if (relatorio.numero_relatorio && relatorio.ano === data.ano) {
      return { numero: relatorio.numero_relatorio, ano: data.ano, novo: false };
    }

    const { data: proximo, error: erroRpc } = await supabase.rpc("proximo_numero_relatorio", {
      _ano: data.ano,
    });
    if (erroRpc || proximo === null) {
      throw new Error(`Não foi possível reservar o número: ${erroRpc?.message ?? "sem retorno"}`);
    }

    const numero = formatarNumero(Number(proximo));
    await supabase
      .from("relatorios")
      .update({ numero_relatorio: numero, ano: data.ano })
      .eq("id", relatorio.id);

    return { numero, ano: data.ano, novo: true };
  });

export const gerarRelatorioWord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        relatorioId: z.string().uuid(),
        campos: z.record(z.string(), z.string()),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    const { data: relatorio } = await supabase
      .from("relatorios")
      .select("*")
      .eq("id", data.relatorioId)
      .single();
    if (!relatorio) throw new Error("Relatório não encontrado.");

    const ano = data.campos["ANO_RELATORIO"] || String(new Date().getFullYear());

    // Numeração sequencial automática: garante um número antes de emitir o Word.
    let numero = data.campos["NUMERO_RELATORIO"]?.trim() || "";
    if (!numero) {
      numero = relatorio.numero_relatorio?.trim() || "";
    }
    if (!numero) {
      const { data: proximo, error: erroRpc } = await supabase.rpc("proximo_numero_relatorio", {
        _ano: ano,
      });
      if (erroRpc || proximo === null) {
        throw new Error(
          `Não foi possível reservar o número sequencial: ${erroRpc?.message ?? "sem retorno"}`,
        );
      }
      numero = formatarNumero(Number(proximo));
    }
    data.campos["NUMERO_RELATORIO"] = numero;
    data.campos["ANO_RELATORIO"] = ano;

    const bytes = preencherTemplate(data.campos);
    const base64 = bytesParaBase64(bytes);
    const nome = `Relatorio-de-Ocorrencia-${numero}-${ano}.docx`.replace(/[^\w.-]/g, "_");
    const caminho = `${userId}/${relatorio.id}/${Date.now()}-${nome}`;

    const { error: erroUpload } = await supabase.storage
      .from("relatorios")
      .upload(caminho, bytes, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
    if (erroUpload) throw new Error(`Falha ao armazenar o documento: ${erroUpload.message}`);

    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
    const hash = [...new Uint8Array(hashBuffer)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const versao = (relatorio.versao ?? 0) + 1;
    await supabase
      .from("relatorios")
      .update({
        arquivo_word: caminho,
        hash_arquivo: hash,
        versao,
        status: "GERADO",
        dados_json: data.campos,
        numero_relatorio: numero,
        ano,
      })
      .eq("id", relatorio.id);

    await supabase.from("relatorio_versoes").insert({
      relatorio_id: relatorio.id,
      numero_versao: versao,
      conteudo_json: data.campos,
      arquivo_word: caminho,
      usuario: userId,
      rotulo: `Versão ${versao}`,
    });

    return { nome, caminho, base64, numero, ano };
  });
