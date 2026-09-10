const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODELO_PADRAO = "google/gemini-3.1-pro-preview";

export type Mensagem = { role: "system" | "user"; content: string };

/** Chave da IA: primeiro a do ambiente, depois a cadastrada em Configurações. */
export async function obterChaveIA(): Promise<{ chave: string | null; modelo: string | null }> {
  const doAmbiente = process.env["LOVABLE_API_KEY"];
  if (doAmbiente) return { chave: doAmbiente, modelo: null };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("configuracao_ia")
    .select("chave, modelo")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const chave = data?.chave?.trim();
  return { chave: chave && chave.length > 0 ? chave : null, modelo: data?.modelo ?? null };
}

export async function chamarIA(
  mensagens: Mensagem[],
  opcoes?: { json?: boolean; modelo?: string },
): Promise<string> {
  const { chave, modelo } = await obterChaveIA();
  if (!chave) {
    throw new Error(
      "A chave da inteligência artificial não está cadastrada. Em Configurações → Motores de análise, informe a chave da IA, ou escolha “Usar Local” para ler o documento pelo serviço do órgão.",
    );
  }


  const resposta = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opcoes?.modelo ?? modelo ?? MODELO_PADRAO,
      messages: mensagens,
      ...(opcoes?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    console.error(`[IA] Falha ${resposta.status}: ${corpo}`);
    if (resposta.status === 429) {
      throw new Error(
        "Limite de requisições atingido. Aguarde alguns instantes e tente novamente.",
      );
    }
    if (resposta.status === 402) {
      throw new Error(
        "Os créditos de inteligência artificial do espaço de trabalho foram esgotados. Adicione créditos para continuar.",
      );
    }
    if (resposta.status === 403) {
      throw new Error(
        "O uso de inteligência artificial está bloqueado pelas configurações do espaço de trabalho.",
      );
    }
    throw new Error(`Falha na análise automática [${resposta.status}]: ${corpo}`);
  }

  const dados = (await resposta.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const conteudo = dados.choices?.[0]?.message?.content;
  if (!conteudo) throw new Error("A análise automática retornou resposta vazia.");
  return conteudo;
}

export function extrairJson<T>(texto: string): T {
  const limpo = texto
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(limpo) as T;
  } catch {
    const inicio = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    if (inicio >= 0 && fim > inicio) {
      return JSON.parse(limpo.slice(inicio, fim + 1)) as T;
    }
    throw new Error("Não foi possível interpretar a resposta da análise automática.");
  }
}
