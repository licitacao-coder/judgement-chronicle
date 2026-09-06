import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chamarIA, extrairJson } from "./ia.server";
import { REGRAS_GERAIS } from "./prompts.server";

export type ItemPainel = {
  numero_item: number | null;
  especificacao: string | null;
  quantidade: number | null;
  unidade: string | null;
  valor_unitario: number | null;
  valor_total: number | null;
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
  const lance = m[3] ?? "";

  // nome do licitante: último "para <NOME>," antes do CNPJ
  const nomeMatch = /\bpara\s+(.+?)\s*,\s*$/i.exec(cabecalho) ?? /\bpara\s+(.+)$/i.exec(cabecalho);
  const licitante = nomeMatch?.[1]?.trim().replace(/[,.;]$/, "") ?? null;

  // valores rotulados: "(unitário)" e "(total)"
  const valores = [...lance.matchAll(/R?\$?\s*([\d.]+,\d{2,4}|\d+(?:[.,]\d+)?)\s*\(?\s*(unit\w*|total)?/gi)];
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

  return {
    licitante,
    cnpj: cnpj || null,
    valor_unitario: unitario,
    valor_total: total,
    trecho: m[0]!.trim(),
  };
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
  .inputValidator((data) => z.object({ documentoId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: doc } = await supabase
      .from("documentos")
      .select("id, nome_original, texto_extraido, quantidade_paginas")
      .eq("id", data.documentoId)
      .single();
    if (!doc) throw new Error("Documento não encontrado.");
    if (!doc.texto_extraido || doc.texto_extraido.replace(/\s/g, "").length < 200) {
      throw new Error(
        "O documento ainda não possui texto pesquisável. Envie o Termo de Julgamento em PDF com texto (não digitalizado como imagem).",
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
      const unitario = vencedor?.valor_unitario ?? null;
      const total = vencedor?.valor_total ?? null;

      const pendencias: string[] = [];
      let unitarioFinal = unitario;
      if (unitarioFinal === null && quantidade && total) {
        unitarioFinal = Number((total / quantidade).toFixed(4));
        pendencias.push("Lance unitário calculado a partir do lance total ÷ quantidade.");
      }

      let validacao: string | null = null;
      let diferenca: number | null = null;
      if (quantidade && unitarioFinal && total) {
        diferenca = Number((quantidade * unitarioFinal - total).toFixed(2));
        validacao = Math.abs(diferenca) <= Math.max(0.05, total * 0.001) ? "OK" : "DIVERGENTE";
      }

      if (!vencedor)
        pendencias.push("Bloco do licitante aceito/habilitado não interpretado integralmente.");
      if (vencedor && !vencedor.licitante) pendencias.push("Licitante não localizado no bloco.");
      if (vencedor && !validarCnpj(vencedor.cnpj))
        pendencias.push("CNPJ fora do formato 00.000.000/0000-00.");
      if (vencedor && total === null) pendencias.push("Melhor lance total não localizado.");
      if (!nao(extra.especificacao ?? null)) pendencias.push("Especificação não localizada.");
      if (!quantidade) pendencias.push("Quantidade não localizada.");
      if (validacao === "DIVERGENTE")
        pendencias.push("Quantidade × lance unitário difere do lance total.");


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
        valor_unitario: unitario,
        valor_total: total,
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
