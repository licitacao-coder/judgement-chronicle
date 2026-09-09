import { z } from "zod";
import type { ItemPainel } from "@/lib/painel.functions";

export type MotorAnalise = "INTERNO" | "PYTHON";

export type ConfigMotor = {
  id: string | null;
  endereco_servico: string | null;
  motor_padrao: MotorAnalise;
  situacao: string;
  versao_servico: string | null;
  ultima_verificacao: string | null;
  mensagem_verificacao: string | null;
};

const TEMPO_LIMITE_MS = 120_000;

function normalizarEndereco(endereco: string): string {
  return endereco.replace(/\/+$/, "");
}

function cabecalhos(): Record<string, string> {
  const chave = process.env["MOTOR_PYTHON_CHAVE"];
  return {
    "Content-Type": "application/json",
    ...(chave ? { "X-Chave-Servico": chave } : {}),
  };
}

/** Chamada HTTP autenticada ao serviço Python, sempre a partir do servidor. */
export async function chamarServicoPython<T>(
  endereco: string,
  rota: string,
  corpo: unknown,
  esquema: z.ZodType<T>,
): Promise<T> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await fetch(`${normalizarEndereco(endereco)}${rota}`, {
      method: "POST",
      headers: cabecalhos(),
      body: JSON.stringify(corpo),
      signal: controle.signal,
    });
    if (!resposta.ok) {
      const texto = await resposta.text();
      throw new Error(
        `O serviço Python respondeu com erro ${resposta.status}: ${texto.slice(0, 400)}`,
      );
    }
    const json = (await resposta.json()) as unknown;
    const validado = esquema.safeParse(json);
    if (!validado.success) {
      throw new Error(
        "A resposta do serviço Python não está no formato esperado. Verifique a versão do serviço.",
      );
    }
    return validado.data;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("O serviço Python não respondeu no tempo limite (2 minutos).");
    }
    throw e;
  } finally {
    clearTimeout(relogio);
  }
}

export const esquemaSituacao = z.object({
  servico: z.string(),
  versao: z.string(),
  ocr: z.boolean().optional(),
});

export async function verificarServicoPython(
  endereco: string,
): Promise<{ ok: true; versao: string; ocr: boolean } | { ok: false; mensagem: string }> {
  try {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), 15_000);
    const resposta = await fetch(`${normalizarEndereco(endereco)}/situacao`, {
      headers: cabecalhos(),
      signal: controle.signal,
    });
    clearTimeout(relogio);
    if (!resposta.ok) {
      return { ok: false, mensagem: `O serviço respondeu com erro ${resposta.status}.` };
    }
    const dados = esquemaSituacao.parse(await resposta.json());
    return { ok: true, versao: dados.versao, ocr: dados.ocr ?? false };
  } catch (e) {
    return {
      ok: false,
      mensagem:
        e instanceof Error ? e.message : "Não foi possível falar com o serviço Python informado.",
    };
  }
}

const numeroOuNulo = z.union([z.number(), z.null()]).optional();
const textoOuNulo = z.union([z.string(), z.null()]).optional();

export const esquemaItensPython = z.object({
  versao: z.string(),
  ocr_utilizado: z.boolean().optional(),
  total_blocos: z.number().optional(),
  itens: z.array(
    z.object({
      numero_item: numeroOuNulo,
      especificacao: textoOuNulo,
      quantidade: numeroOuNulo,
      unidade: textoOuNulo,
      valor_unitario: numeroOuNulo,
      valor_total: numeroOuNulo,
      valor_negociado_unitario: numeroOuNulo,
      valor_negociado_total: numeroOuNulo,
      origem_valor: textoOuNulo,
      valor_referencia_unitario: numeroOuNulo,
      valor_referencia_total: numeroOuNulo,
      percentual_diferenca: numeroOuNulo,
      licitante: textoOuNulo,
      cnpj: textoOuNulo,
      situacao: textoOuNulo,
      pagina: numeroOuNulo,
      trecho_origem: textoOuNulo,
      status_conferencia: textoOuNulo,
      validacao_total: textoOuNulo,
      diferenca: numeroOuNulo,
      observacoes: textoOuNulo,
    }),
  ),
});

const statusValido = (v: string | null | undefined): ItemPainel["status_conferencia"] =>
  v === "EXTRAIDO_VALIDADO" || v === "ERRO_EXTRACAO" ? v : "NECESSITA_CONFERENCIA";

const origemValida = (v: string | null | undefined): ItemPainel["origem_valor"] =>
  v === "VALOR_NEGOCIADO" || v === "MELHOR_LANCE" ? v : null;

/** Converte a resposta do serviço Python no mesmo formato do motor interno. */
export function converterItensPython(
  resposta: z.infer<typeof esquemaItensPython>,
): ItemPainel[] {
  return resposta.itens.map((i) => ({
    numero_item: i.numero_item ?? null,
    especificacao: i.especificacao ?? null,
    quantidade: i.quantidade ?? null,
    unidade: i.unidade ?? null,
    valor_unitario: i.valor_unitario ?? null,
    valor_total: i.valor_total ?? null,
    valor_negociado_unitario: i.valor_negociado_unitario ?? null,
    valor_negociado_total: i.valor_negociado_total ?? null,
    origem_valor: origemValida(i.origem_valor),
    valor_referencia_unitario: i.valor_referencia_unitario ?? null,
    valor_referencia_total: i.valor_referencia_total ?? null,
    percentual_diferenca: i.percentual_diferenca ?? null,
    licitante: i.licitante ?? null,
    cnpj: i.cnpj ?? null,
    situacao: i.situacao ?? null,
    pagina: i.pagina ?? null,
    trecho_origem: i.trecho_origem ?? null,
    status_conferencia: statusValido(i.status_conferencia),
    validacao_total: i.validacao_total ?? null,
    diferenca: i.diferenca ?? null,
    observacoes: i.observacoes ?? null,
  }));
}
