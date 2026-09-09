import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chamarIA, extrairJson } from "./ia.server";
import {
  chamarServicoPython,
  converterItensPython,
  esquemaItensPython,
} from "./motores/motorPython.server";
import { REGRAS_GERAIS } from "./prompts.server";

export type ItemPainel = {
  numero_item: number | null;
  especificacao: string | null;
  quantidade: number | null;
  unidade: string | null;
  valor_unitario: number | null;
  valor_total: number | null;
  valor_negociado_unitario: number | null;
  valor_negociado_total: number | null;
  origem_valor: "VALOR_NEGOCIADO" | "MELHOR_LANCE" | null;
  valor_referencia_unitario: number | null;
  valor_referencia_total: number | null;
  percentual_diferenca: number | null;
  licitante: string | null;
  cnpj: string | null;
  situacao: string | null;
  pagina: number | null;
  trecho_origem: string | null;
  status_conferencia: "EXTRAIDO_VALIDADO" | "NECESSITA_CONFERENCIA" | "ERRO_EXTRACAO";
  validacao_total: string | null;
  diferenca: number | null;
  observacoes: string | null;
};

const numeroBr = (texto: string | null | undefined): number | null => {
  if (!texto) return null;
  const limpo = texto.replace(/\s/g, "").replace(/R\$/i, "");
  const semMilhar = limpo.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(semMilhar);
  return Number.isFinite(n) ? n : null;
};

const CNPJ_RE = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;

function validarCnpj(valor: string | null): boolean {
  return !!valor && CNPJ_RE.test(valor);
}

/** Divide o texto em páginas usando os marcadores gravados na leitura do PDF. */
function separarPaginas(texto: string): { pagina: number; conteudo: string }[] {
  const partes = texto.split(/---\s*P[áa]gina\s+(\d+)\s*---/gi);
  if (partes.length < 3) return [{ pagina: 1, conteudo: texto }];
  const paginas: { pagina: number; conteudo: string }[] = [];
  for (let i = 1; i < partes.length; i += 2) {
    paginas.push({ pagina: Number(partes[i]), conteudo: partes[i + 1] ?? "" });
  }
  return paginas;
}

type Bloco = { numero: number; pagina: number; conteudo: string };

/** Único critério de inclusão: item expressamente "Aceito e Habilitado". */
export const RE_EVIDENCIA = /Aceit[oa]s?\s+e\s+Habilitad[oa]s?/i;

export function temEvidenciaVencedor(conteudo: string): boolean {
  return RE_EVIDENCIA.test(conteudo.replace(/\s+/g, " "));
}

/** Localiza cada ocorrência de "Item X" em todas as páginas, mantendo a página de origem. */
function separarItens(texto: string): Bloco[] {
  const paginas = separarPaginas(texto);
  const marcas: { numero: number; pagina: number; inicio: number }[] = [];
  let acumulado = "";
  const mapa: { fim: number; pagina: number }[] = [];
  for (const p of paginas) {
    acumulado += `\n${p.conteudo}`;
    mapa.push({ fim: acumulado.length, pagina: p.pagina });
  }

  const re = /(^|\n)\s*Item\s+(\d{1,4})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(acumulado))) {
    const inicio = m.index;
    const pagina = mapa.find((x) => inicio < x.fim)?.pagina ?? 1;
    marcas.push({ numero: Number(m[2]), pagina, inicio });
  }



  const blocos = new Map<number, Bloco>();
  for (let i = 0; i < marcas.length; i += 1) {
    const atual = marcas[i]!;
    const fim = marcas[i + 1]?.inicio ?? acumulado.length;
    const conteudo = acumulado.slice(atual.inicio, fim);
    const anterior = blocos.get(atual.numero);
    // mantém o bloco mais completo (o que contém a evidência do vencedor)
    const temEvidencia = temEvidenciaVencedor(conteudo);
    if (!anterior || (temEvidencia && !temEvidenciaVencedor(anterior.conteudo))) {
      blocos.set(atual.numero, { numero: atual.numero, pagina: atual.pagina, conteudo });
    } else if (anterior && temEvidencia && conteudo.length > anterior.conteudo.length) {
      blocos.set(atual.numero, { numero: atual.numero, pagina: atual.pagina, conteudo });
    }
  }
  return [...blocos.values()].sort((a, b) => a.numero - b.numero);
}

/** Extrai deterministicamente o bloco "Aceito e Habilitado ... melhor lance". */
function lerAceitoHabilitado(bloco: string) {
  const plano = bloco.replace(/\s+/g, " ");
  // Ex.: "Aceito e Habilitado por CPF ***.124.***-*9 - NOME para FORNECEDOR LTDA,
  //       CNPJ 09.316.105/0018-77, melhor lance: R$ 1.353,2700 (unitário) / R$ 166.452,2100 (total)"
  // Também aceita blocos com apenas o valor total.
  const re =
    /Aceit[oa]s?\s+e\s+Habilitad[oa]s?\b([\s\S]{0,400}?)\bCNPJ:?\s*([\d.]{2,}\/?[\d-]*)\s*,?\s*melhor\s+lance:?\s*([^\n]{0,160})/i;
  const m = re.exec(plano);
  if (!m) return null;

  const cabecalho = m[1] ?? "";
  const cnpj = (m[2] ?? "").trim().replace(/[,.;]$/, "");
  // encerra o trecho do lance antes do início da lista de propostas dos demais licitantes
  const lance = (m[3] ?? "").split(
    /\bPropostas\b|\bFornecedor\b|\bBenef[íi]cio\b|\bValor\s+proposta\b|\bValor\s+negociado\b/i,
  )[0]!;

  // nome do licitante: último "para <NOME>," antes do CNPJ
  const nomeMatch = /\bpara\s+(.+?)\s*,\s*$/i.exec(cabecalho) ?? /\bpara\s+(.+)$/i.exec(cabecalho);
  const licitante = nomeMatch?.[1]?.trim().replace(/[,.;]$/, "") ?? null;

  // valores rotulados: "(unitário)" e "(total)"
  const { unitario, total } = lerRotulados(lance);

  return {
    licitante,
    cnpj: cnpj || null,
    valor_unitario: unitario,
    valor_total: total,
    trecho: m[0]!
      .split(/\bPropostas\b|\bFornecedor\s+Valor\s+ofertado\b/i)[0]!
      .trim(),
  };
}

/** Lê "Valor estimado" (valor de referência) do item, unitário e/ou total. */
function lerValorReferencia(bloco: string) {
  const plano = bloco.replace(/\s+/g, " ");
  const m =
    /Valor\s+(?:estimado|de\s+refer[êe]ncia|m[áa]ximo(?:\s+aceit[áa]vel)?)\s*:?\s*([^:]{0,120})/i.exec(
      plano,
    );
  if (!m) return { unitario: null, total: null };
  return lerRotulados(m[1] ?? "");
}

/** Lê valores rotulados como "(unitário)" e "(total)" de um trecho. */
function lerRotulados(trecho: string) {
  const valores = [
    ...trecho.matchAll(/R?\$?\s*([\d.]+,\d{2,4}|\d+(?:[.,]\d+)?)\s*\(?\s*(unit\w*|total)?/gi),
  ];
  let unitario: number | null = null;
  let total: number | null = null;
  const semRotulo: number[] = [];
  for (const v of valores) {
    const n = numeroBr(v[1]!);
    if (n === null) continue;
    const rotulo = v[2]?.toLowerCase();
    if (rotulo?.startsWith("unit")) unitario = n;
    else if (rotulo === "total") total = n;
    else semRotulo.push(n);
  }
  if (total === null && unitario === null && semRotulo.length) {
    total = semRotulo[semRotulo.length - 1]!;
    if (semRotulo.length > 1) unitario = semRotulo[0]!;
  }
  return { unitario, total };
}

/**
 * Lê o "Valor negociado" do licitante aceito e habilitado.
 * Procura o trecho da proposta do próprio vencedor (identificado pelo CNPJ) e,
 * na ausência dele, o valor negociado mais próximo do bloco aceito/habilitado.
 */
function lerValorNegociado(bloco: string, cnpj: string | null) {
  const plano = bloco.replace(/\s+/g, " ");
  const candidatos: string[] = [];

  if (cnpj) {
    const idx = plano.lastIndexOf(cnpj);
    if (idx >= 0) candidatos.push(plano.slice(idx, idx + 900));
  }
  // Sem o CNPJ do vencedor não é possível isolar a proposta dele: usa o bloco inteiro
  // apenas quando existe um único "Valor negociado" no item.
  if (candidatos.length === 0 && (plano.match(/Valor\s+negociado/gi) ?? []).length === 1) {
    candidatos.push(plano);
  }

  for (const trecho of candidatos) {
    const m = /Valor\s+negociado\s*:?\s*([^:]{0,120})/i.exec(trecho);
    if (!m) continue;
    const bruto = m[1] ?? "";
    if (/n[ãa]o\s+realizado|n[ãa]o\s+se\s+aplica|^\s*-\s*$/i.test(bruto.trim())) continue;
    const { unitario, total } = lerRotulados(bruto);
    if (unitario !== null || total !== null) return { unitario, total };
  }
  return { unitario: null, total: null };
}


/** Lê a situação do item preservando a terminologia original do documento. */
function lerSituacao(bloco: string): string | null {
  const plano = bloco.replace(/\s+/g, " ");
  const rotulo = /Situa[çc][ãa]o(?:\s+do\s+item)?\s*:?\s*([^.;|\n]{3,80})/i.exec(plano);
  if (rotulo?.[1]) return rotulo[1].trim();

  const padroes = [
    /Aberto\s+para\s+recursos/i,
    /Aguardando\s+adjudica[çc][ãa]o/i,
    /Aguardando\s+homologa[çc][ãa]o/i,
    /Adjudicado\s+e\s+Homologado/i,
    /Adjudicado/i,
    /Homologado/i,
    /Encerrado/i,
    /Cancelado[^.;\n]{0,40}/i,
    /Deserto/i,
    /Fracassado/i,
    /Em\s+julgamento/i,
    /Aceit[oa]s?\s+e\s+Habilitad[oa]s?/i,
  ];
  for (const p of padroes) {
    const m = p.exec(plano);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return null;
}

const promptItens = (blocos: Bloco[]) => `${REGRAS_GERAIS}

Você recebe trechos de um TERMO DE JULGAMENTO, um por item. Para CADA item, devolva a
descrição/especificação fiel (preservando capacidade, tensão, frequência, garantia, marca/modelo e
demais características apresentadas), a quantidade, a unidade de fornecimento e a situação do item
exatamente como aparece no documento. Não invente dados: use "NAO_LOCALIZADO".

Devolva SOMENTE JSON:
{"itens":[{"numero_item":0,"especificacao":"","quantidade":"","unidade":"","situacao":""}]}

${blocos
  .map(
    (b) => `=== ITEM ${b.numero} (página ${b.pagina}) ===\n${b.conteudo.slice(0, 6000)}`,
  )
  .join("\n\n")}`;

export const extrairItensAceitos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        documentoId: z.string().uuid(),
        motor: z.enum(["INTERNO", "PYTHON", "PADRAO"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const inicio = Date.now();
    const { data: doc } = await supabase
      .from("documentos")
      .select("id, nome_original, texto_extraido, quantidade_paginas, caminho_arquivo, extensao")
      .eq("id", data.documentoId)
      .single();
    if (!doc) throw new Error("Documento não encontrado.");

    // Motor escolhido na tela ou o motor padrão definido nas Configurações.
    const { data: config } = await supabase
      .from("configuracao_motor")
      .select("endereco_servico, motor_padrao, situacao")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const escolhido =
      !data.motor || data.motor === "PADRAO"
        ? config?.motor_padrao === "PYTHON"
          ? "PYTHON"
          : "INTERNO"
        : data.motor;

    if (escolhido === "PYTHON") {
      if (!config?.endereco_servico) {
        throw new Error(
          "O serviço Python não está configurado. Informe o endereço em Configurações.",
        );
      }
      let arquivoBase64: string | null = null;
      if (doc.caminho_arquivo) {
        const { data: arquivo } = await supabase.storage
          .from("documentos")
          .download(doc.caminho_arquivo);
        if (arquivo) {
          const bytes = new Uint8Array(await arquivo.arrayBuffer());
          let bruto = "";
          for (const b of bytes) bruto += String.fromCharCode(b);
          arquivoBase64 = btoa(bruto);
        }
      }
      const resposta = await chamarServicoPython(
        config.endereco_servico,
        "/itens-aceitos",
        {
          nome_documento: doc.nome_original,
          extensao: doc.extensao,
          texto: doc.texto_extraido,
          arquivo_base64: arquivoBase64,
        },
        esquemaItensPython,
      );
      const itensPython = converterItensPython(resposta);
      if (itensPython.length === 0) {
        throw new Error(
          'O serviço Python não localizou itens com a situação "Aceito e Habilitado" no documento.',
        );
      }
      return {
        documentoId: doc.id,
        nomeDocumento: doc.nome_original,
        totalBlocos: resposta.total_blocos ?? itensPython.length,
        itens: itensPython,
        motor: "PYTHON" as const,
        motorVersao: resposta.versao,
        duracaoMs: Date.now() - inicio,
      };
    }

    if (!doc.texto_extraido || doc.texto_extraido.replace(/\s/g, "").length < 200) {
      throw new Error(
        "O documento ainda não possui texto pesquisável. Envie o Termo de Julgamento em PDF com texto (não digitalizado como imagem) ou use o motor Python com leitura de imagem (OCR).",
      );
    }

    const blocos = separarItens(doc.texto_extraido);
    const comEvidencia = blocos.filter((b) => temEvidenciaVencedor(b.conteudo));
    if (comEvidencia.length === 0) {
      throw new Error(
        'Nenhum item com a situação "Aceito e Habilitado" foi localizado no documento.',
      );
    }

    // A IA complementa somente descrição, quantidade, unidade e situação.
    const complementos = new Map<
      number,
      {
        especificacao?: string | undefined;
        quantidade?: string | undefined;
        unidade?: string | undefined;
        situacao?: string | undefined;
      }
    >();
    const lote = 6;
    for (let i = 0; i < comEvidencia.length; i += lote) {
      const parte = comEvidencia.slice(i, i + lote);
      try {
        const resposta = await chamarIA(
          [
            { role: "system", content: "Responda exclusivamente com JSON válido." },
            { role: "user", content: promptItens(parte) },
          ],
          { json: true },
        );
        const json = extrairJson<{
          itens?: {
            numero_item?: number | string;
            especificacao?: string;
            quantidade?: string;
            unidade?: string;
            situacao?: string;
          }[];
        }>(resposta);
        for (const it of json.itens ?? []) {
          const numero = Number(it.numero_item);
          if (!Number.isFinite(numero)) continue;
          complementos.set(numero, {
            especificacao: it.especificacao,
            quantidade: it.quantidade,
            unidade: it.unidade,
            situacao: it.situacao,
          });
        }
      } catch (e) {
        console.error("[painel] falha na leitura de um lote de itens", e);
      }
    }

    const nao = (v?: string | null) =>
      !v || v.trim() === "" || v.trim().toUpperCase() === "NAO_LOCALIZADO" ? null : v.trim();

    const itens: ItemPainel[] = comEvidencia.map((bloco) => {
      const vencedor = lerAceitoHabilitado(bloco.conteudo);
      const extra = complementos.get(bloco.numero) ?? {};
      const quantidade = numeroBr(nao(extra.quantidade ?? null));
      const negociado = lerValorNegociado(bloco.conteudo, vencedor?.cnpj ?? null);
      const referencia = lerValorReferencia(bloco.conteudo);

      const pendencias: string[] = [];

      // O valor negociado prevalece sobre o melhor lance quando informado no bloco.
      const usaNegociado = negociado.unitario !== null || negociado.total !== null;
      const origem: ItemPainel["origem_valor"] = usaNegociado
        ? "VALOR_NEGOCIADO"
        : vencedor
          ? "MELHOR_LANCE"
          : null;
      if (usaNegociado)
        pendencias.push("Valor negociado informado no documento prevaleceu sobre o melhor lance.");

      const unitario = usaNegociado ? negociado.unitario : (vencedor?.valor_unitario ?? null);
      const total = usaNegociado ? negociado.total : (vencedor?.valor_total ?? null);

      let unitarioFinal = unitario;
      let totalFinal = total;
      if (unitarioFinal === null && quantidade && totalFinal) {
        unitarioFinal = Number((totalFinal / quantidade).toFixed(4));
        pendencias.push("Valor unitário calculado a partir do valor total ÷ quantidade.");
      }
      if (totalFinal === null && quantidade && unitarioFinal) {
        totalFinal = Number((unitarioFinal * quantidade).toFixed(2));
        pendencias.push("Valor total calculado a partir do valor unitário × quantidade.");
      }

      let validacao: string | null = null;
      let diferenca: number | null = null;
      if (quantidade && unitarioFinal && totalFinal) {
        diferenca = Number((quantidade * unitarioFinal - totalFinal).toFixed(2));
        validacao = Math.abs(diferenca) <= Math.max(0.05, totalFinal * 0.001) ? "OK" : "DIVERGENTE";
      }

      // Percentual de diferença entre o valor considerado e o valor de referência.
      let percentual: number | null = null;
      if (referencia.total && totalFinal) {
        percentual = Number((((totalFinal - referencia.total) / referencia.total) * 100).toFixed(2));
      } else if (referencia.unitario && unitarioFinal) {
        percentual = Number(
          (((unitarioFinal - referencia.unitario) / referencia.unitario) * 100).toFixed(2),
        );
      }

      if (!vencedor)
        pendencias.push("Bloco do licitante aceito/habilitado não interpretado integralmente.");
      if (vencedor && !vencedor.licitante) pendencias.push("Licitante não localizado no bloco.");
      if (vencedor && !validarCnpj(vencedor.cnpj))
        pendencias.push("CNPJ fora do formato 00.000.000/0000-00.");
      if (vencedor && totalFinal === null) pendencias.push("Valor total não localizado.");
      if (!nao(extra.especificacao ?? null)) pendencias.push("Especificação não localizada.");
      if (!quantidade) pendencias.push("Quantidade não localizada.");
      if (percentual === null) pendencias.push("Valor de referência não localizado no item.");
      if (validacao === "DIVERGENTE")
        pendencias.push("Quantidade × valor unitário difere do valor total.");

      const status: ItemPainel["status_conferencia"] = !vencedor
        ? "ERRO_EXTRACAO"
        : pendencias.length
          ? "NECESSITA_CONFERENCIA"
          : "EXTRAIDO_VALIDADO";

      return {
        numero_item: bloco.numero,
        especificacao: nao(extra.especificacao ?? null),
        quantidade,
        unidade: nao(extra.unidade ?? null),
        valor_unitario: unitarioFinal,
        valor_total: totalFinal,
        valor_negociado_unitario: negociado.unitario,
        valor_negociado_total: negociado.total,
        origem_valor: origem,
        valor_referencia_unitario: referencia.unitario,
        valor_referencia_total: referencia.total,
        percentual_diferenca: percentual,
        licitante: vencedor?.licitante ?? null,
        cnpj: vencedor?.cnpj ?? null,
        situacao: nao(extra.situacao ?? null) ?? lerSituacao(bloco.conteudo),
        pagina: bloco.pagina,
        trecho_origem: vencedor?.trecho ?? bloco.conteudo.slice(0, 1200).trim(),
        status_conferencia: status,
        validacao_total: validacao,
        diferenca,
        observacoes: pendencias.join(" ") || null,
      };
    });

    return {
      documentoId: doc.id,
      nomeDocumento: doc.nome_original,
      totalBlocos: blocos.length,
      itens,
      motor: "INTERNO" as const,
      motorVersao: "interno-1",
      duracaoMs: Date.now() - inicio,
    };
  });

export const salvarImportacaoPainel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        documentoId: z.string().uuid(),
        processoId: z.string().uuid().nullable().optional(),
        identificacaoProcesso: z.string().nullable().optional(),
        motor: z.enum(["INTERNO", "PYTHON"]).optional(),
        motorVersao: z.string().nullable().optional(),
        duracaoMs: z.number().nullable().optional(),
        itens: z.array(z.record(z.string(), z.unknown())),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    if (data.itens.length === 0) throw new Error("Nenhum item para gravar.");

    const { data: anteriores } = await supabase
      .from("painel_importacoes")
      .select("versao")
      .eq("documento_id", data.documentoId)
      .order("versao", { ascending: false })
      .limit(1);
    const versao = (anteriores?.[0]?.versao ?? 0) + 1;

    if (data.processoId) {
      await supabase
        .from("painel_importacoes")
        .update({ atual: false })
        .eq("processo_id", data.processoId);
    }

    const { data: doc } = await supabase
      .from("documentos")
      .select("nome_original")
      .eq("id", data.documentoId)
      .single();

    const valorTotal = data.itens.reduce(
      (soma, i) => soma + (typeof i["valor_total"] === "number" ? (i["valor_total"] as number) : 0),
      0,
    );

    const { data: importacao, error } = await supabase
      .from("painel_importacoes")
      .insert({
        processo_id: data.processoId ?? null,
        documento_id: data.documentoId,
        nome_documento: doc?.nome_original ?? null,
        identificacao_processo: data.identificacaoProcesso ?? null,
        versao,
        total_itens: data.itens.length,
        valor_total: valorTotal,
        atual: true,
        usuario: context.userId,
      })
      .select()
      .single();
    if (error || !importacao) throw new Error(error?.message ?? "Falha ao registrar a importação.");

    const registros = data.itens.map((i) => ({
      importacao_id: importacao.id,
      processo_id: data.processoId ?? null,
      documento_id: data.documentoId,
      numero_item: (i["numero_item"] as number) ?? null,
      especificacao: (i["especificacao"] as string) ?? null,
      quantidade: (i["quantidade"] as number) ?? null,
      unidade: (i["unidade"] as string) ?? null,
      valor_unitario: (i["valor_unitario"] as number) ?? null,
      valor_total: (i["valor_total"] as number) ?? null,
      valor_negociado_unitario: (i["valor_negociado_unitario"] as number) ?? null,
      valor_negociado_total: (i["valor_negociado_total"] as number) ?? null,
      origem_valor: (i["origem_valor"] as string) ?? null,
      valor_referencia_unitario: (i["valor_referencia_unitario"] as number) ?? null,
      valor_referencia_total: (i["valor_referencia_total"] as number) ?? null,
      percentual_diferenca: (i["percentual_diferenca"] as number) ?? null,
      licitante: (i["licitante"] as string) ?? null,
      cnpj: (i["cnpj"] as string) ?? null,
      situacao: (i["situacao"] as string) ?? null,
      pagina: (i["pagina"] as number) ?? null,
      status_conferencia: (i["status_conferencia"] as string) ?? "NECESSITA_CONFERENCIA",
      validacao_total: (i["validacao_total"] as string) ?? null,
      diferenca: (i["diferenca"] as number) ?? null,
      trecho_origem: (i["trecho_origem"] as string) ?? null,
      observacoes: (i["observacoes"] as string) ?? null,
    }));

    const { error: erroItens } = await supabase.from("painel_itens").insert(registros);
    if (erroItens) throw new Error(erroItens.message);

    await supabase.from("auditoria").insert({
      usuario_id: context.userId,
      entidade: "painel_itens",
      entidade_id: importacao.id,
      acao: "IMPORTACAO_ITENS_ACEITOS",
      valor_novo: `${data.itens.length} item(ns), versão ${versao}`,
    });

    return { importacaoId: importacao.id, versao, total: data.itens.length };
  });
