const ENDPOINT_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const ENDPOINT_ANTHROPIC = "https://api.anthropic.com/v1/messages";
const MODELO_PADRAO = "google/gemini-3.1-pro-preview";
const MODELO_PADRAO_CLAUDE = "claude-sonnet-5";

export type Mensagem = { role: "system" | "user"; content: string };
export type ProvedorIA = "LOVABLE" | "ANTHROPIC";

function normalizarModeloClaude(modelo: string | null): string {
  const limpo = (modelo ?? "").trim();
  if (!limpo) return MODELO_PADRAO_CLAUDE;
  return limpo.replace(/^anthropic\//i, "");
}

/** Chave da IA: primeiro a cadastrada em Configurações; se for uma chave do
 *  Claude (começa por "sk-ant-"), o motor passa a usar a API do Anthropic
 *  diretamente. Caso contrário, vale a chave do ambiente com o gateway padrão.
 *  Quando a chave administrativa do banco não está disponível (por exemplo em
 *  execução no computador do usuário), a leitura é tentada com o próprio acesso
 *  do usuário, sem interromper a análise com erro técnico. */
export async function obterChaveIA(): Promise<{
  chave: string | null;
  modelo: string | null;
  provedor: ProvedorIA;
}> {
  const doAmbiente = process.env["LOVABLE_API_KEY"];

  let data: { chave?: string | null; modelo?: string | null } | null = null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const resposta = await supabaseAdmin
      .from("configuracao_ia")
      .select("chave, modelo")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    data = resposta.data;
  } catch {
    data = null;
  }

  const cadastrada = data?.chave?.trim() || null;

  // Chave do Claude cadastrada pelo administrador tem prioridade sobre a chave
  // do ambiente: é a forma de trocar o motor de análise pelo Anthropic.
  if (cadastrada && cadastrada.startsWith("sk-ant-")) {
    return {
      chave: cadastrada,
      modelo: normalizarModeloClaude(data?.modelo ?? null),
      provedor: "ANTHROPIC",
    };
  }

  if (doAmbiente) return { chave: doAmbiente, modelo: null, provedor: "LOVABLE" };

  const chave = cadastrada && cadastrada.length > 0 ? cadastrada : null;
  return { chave, modelo: data?.modelo ?? null, provedor: "LOVABLE" };
}

function resumirErro(corpo: string): string {
  try {
    const dados = JSON.parse(corpo) as { error?: { message?: string }; message?: string };
    const mensagem = dados.error?.message ?? dados.message ?? corpo;
    return mensagem.length > 300 ? `${mensagem.slice(0, 300)}…` : mensagem;
  } catch {
    return corpo.length > 300 ? `${corpo.slice(0, 300)}…` : corpo;
  }
}

/** Chamada direta à API de mensagens do Anthropic (Claude). */
async function chamarClaude(
  chave: string,
  modelo: string,
  mensagens: Mensagem[],
): Promise<string> {
  const sistema = mensagens
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const mensagensApi = mensagens
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: "user" as const, content: m.content }));

  const resposta = await fetch(ENDPOINT_ANTHROPIC, {
    method: "POST",
    headers: {
      "x-api-key": chave,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 16000,
      ...(sistema ? { system: sistema } : {}),
      messages: mensagensApi,
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    console.error(`[Claude] Falha ${resposta.status}: ${corpo}`);
    if (resposta.status === 401) {
      throw new Error(
        "A chave do Claude foi rejeitada. Confira a chave cadastrada em Configurações → Motores de análise.",
      );
    }
    if (resposta.status === 403) {
      throw new Error(`O acesso ao Claude foi negado pela Anthropic: ${resumirErro(corpo)}`);
    }
    if (resposta.status === 429) {
      throw new Error(
        "Limite de requisições do Claude atingido. Aguarde alguns instantes e tente novamente.",
      );
    }
    if (resposta.status === 400) {
      throw new Error(`O Claude recusou a análise: ${resumirErro(corpo)}`);
    }
    throw new Error(`Falha na análise pelo Claude [${resposta.status}]: ${resumirErro(corpo)}`);
  }

  const dados = (await resposta.json()) as {
    content?: { type: string; text?: string }[];
  };
  const texto = (dados.content ?? [])
    .filter((bloco) => bloco.type === "text")
    .map((bloco) => bloco.text ?? "")
    .join("");
  if (!texto) throw new Error("A análise pelo Claude retornou resposta vazia.");
  return texto;
}

export async function chamarIA(
  mensagens: Mensagem[],
  opcoes?: { json?: boolean; modelo?: string },
): Promise<string> {
  const { chave, modelo, provedor } = await obterChaveIA();
  if (!chave) {
    throw new Error(
      "A chave da inteligência artificial não está cadastrada. Em Configurações → Motores de análise, informe a chave da IA (ou a chave do Claude, que começa por “sk-ant-”), ou escolha “Usar Local” para ler o documento pelo serviço do órgão.",
    );
  }

  if (provedor === "ANTHROPIC") {
    const pedido = opcoes?.modelo
      ? normalizarModeloClaude(opcoes.modelo)
      : (modelo ?? MODELO_PADRAO_CLAUDE);
    return chamarClaude(chave, pedido, mensagens);
  }

  const resposta = await fetch(ENDPOINT_GATEWAY, {
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
