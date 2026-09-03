import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { preencherTemplate, bytesParaBase64 } from "./docx.server";

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

    const bytes = preencherTemplate(data.campos);
    const base64 = bytesParaBase64(bytes);

    const numero = data.campos["NUMERO_RELATORIO"] || "SN";
    const ano = data.campos["ANO_RELATORIO"] || String(new Date().getFullYear());
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

    return { nome, caminho, base64 };
  });
