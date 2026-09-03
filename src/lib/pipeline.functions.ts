import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chamarIA, extrairJson } from "./ia.server";
import { promptExtracao, promptRedacao } from "./prompts.server";

type Extracao = {
  processo: Record<string, string | number | null>;
  licitantes: Record<string, string | number | null>[];
  ocorrencias: {
    cnpj_licitante?: string;
    tipo_ocorrencia?: string;
    descricao_resumida?: string;
    manifestacao?: string;
    providencias?: string;
    repercussao?: string;
    nivel_confianca?: number | string;
    eventos?: Record<string, string | number | null>[];
    enquadramentos?: Record<string, string | number | null>[];
  }[];
};

const limpo = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v);
  if (!s || s === "NAO_LOCALIZADO" || s === "null") return null;
  return s;
};

const somenteDigitos = (v: unknown) => (limpo(v) ?? "").replace(/\D/g, "");

export const processarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ documentoId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: doc, error } = await supabase
      .from("documentos")
      .select("*")
      .eq("id", data.documentoId)
      .single();
    if (error || !doc) throw new Error("Documento não encontrado.");

    await supabase
      .from("documentos")
      .update({ status_processamento: "PROCESSANDO", erro_processamento: null })
      .eq("id", doc.id);

    try {
      const { data: arquivo, error: erroDownload } = await supabase.storage
        .from("documentos")
        .download(doc.caminho_arquivo!);
      if (erroDownload || !arquivo) throw new Error("Não foi possível ler o arquivo enviado.");

      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      let texto = "";
      let paginas = 1;

      if (doc.extensao === "pdf") {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(bytes);
        const resultado = await extractText(pdf, { mergePages: false });
        const paginasTexto = resultado.text as unknown as string[];
        paginas = resultado.totalPages ?? paginasTexto.length;
        texto = paginasTexto
          .map((t, i) => `--- Página ${i + 1} ---\n${t}`)
          .join("\n\n");
      } else if (doc.extensao === "docx") {
        const { unzipSync, strFromU8 } = await import("fflate");
        const arquivos = unzipSync(bytes);
        const xml = strFromU8(arquivos["word/document.xml"]!);
        texto = xml
          .replace(/<\/w:p>/g, "\n")
          .replace(/<w:tab[^>]*\/>/g, "\t")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\n{3,}/g, "\n\n");
      } else {
        texto = new TextDecoder().decode(bytes);
      }

      texto = texto.trim();
      if (texto.replace(/\s/g, "").length < 200) {
        throw new Error(
          "O arquivo não possui texto pesquisável suficiente. Envie um PDF com texto (não digitalizado como imagem) ou um DOCX.",
        );
      }

      await supabase
        .from("documentos")
        .update({
          status_processamento: "TEXTO_EXTRAIDO",
          texto_extraido: texto,
          quantidade_paginas: paginas,
          data_processamento: new Date().toISOString(),
        })
        .eq("id", doc.id);

      return { paginas, caracteres: texto.length };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      await supabase
        .from("documentos")
        .update({ status_processamento: "ERRO", erro_processamento: mensagem })
        .eq("id", doc.id);
      throw new Error(mensagem);
    }
  });

export const analisarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ documentoId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    const { data: doc } = await supabase
      .from("documentos")
      .select("id, texto_extraido")
      .eq("id", data.documentoId)
      .single();
    if (!doc?.texto_extraido) throw new Error("O documento ainda não possui texto extraído.");

    const resposta = await chamarIA(
      [
        { role: "system", content: "Responda exclusivamente com JSON válido." },
        { role: "user", content: promptExtracao(doc.texto_extraido) },
      ],
      { json: true },
    );
    const extracao = extrairJson<Extracao>(resposta);
    const p = extracao.processo ?? {};

    const { data: processo, error: erroProcesso } = await supabase
      .from("processos")
      .insert({
        documento_id: doc.id,
        orgao: limpo(p["orgao"]),
        numero_processo: limpo(p["numero_processo"]),
        processo_sei: limpo(p["processo_sei"]),
        modalidade: limpo(p["modalidade"]),
        numero_certame: limpo(p["numero_certame"]),
        ano_certame: limpo(p["ano_certame"]),
        objeto: limpo(p["objeto"]),
        plataforma: limpo(p["plataforma"]),
        data_sessao: limpo(p["data_sessao"]),
        horario_sessao: limpo(p["horario_sessao"]),
        agente: limpo(p["agente"]),
        uasg: limpo(p["uasg"]),
        nivel_confianca: limpo(p["nivel_confianca"]),
      })
      .select()
      .single();
    if (erroProcesso || !processo) {
      throw new Error(erroProcesso?.message ?? "Falha ao registrar o processo.");
    }

    const mapaLicitantes = new Map<string, string>();
    for (const l of extracao.licitantes ?? []) {
      const { data: licitante } = await supabase
        .from("licitantes")
        .insert({
          processo_id: processo.id,
          razao_social: limpo(l["razao_social"]),
          cnpj_cpf: limpo(l["cnpj_cpf"]),
          representante: limpo(l["representante"]),
          email: limpo(l["email"]),
          telefone: limpo(l["telefone"]),
          situacao: limpo(l["situacao"]),
          grupo_lote: limpo(l["grupo_lote"]),
          itens: limpo(l["itens"]),
          valor_ofertado: limpo(l["valor_proposta"]),
          nivel_confianca: limpo(l["nivel_confianca"]),
          origem_dado: "EXTRACAO_AUTOMATICA",
        })
        .select()
        .single();
      if (licitante) {
        const chave = somenteDigitos(l["cnpj_cpf"]) || (limpo(l["razao_social"]) ?? licitante.id);
        mapaLicitantes.set(chave, licitante.id);
      }
    }

    let totalOcorrencias = 0;
    for (const o of extracao.ocorrencias ?? []) {
      const chave = somenteDigitos(o.cnpj_licitante);
      const licitanteId = mapaLicitantes.get(chave) ?? null;

      const { data: ocorrencia } = await supabase
        .from("ocorrencias")
        .insert({
          processo_id: processo.id,
          licitante_id: licitanteId,
          tipo_ocorrencia: limpo(o.tipo_ocorrencia) ?? "OUTRA",
          descricao_resumida: limpo(o.descricao_resumida),
          manifestacao: limpo(o.manifestacao),
          providencias: limpo(o.providencias),
          repercussao: limpo(o.repercussao),
          nivel_confianca: limpo(o.nivel_confianca),
          status: "EXTRAIDA",
        })
        .select()
        .single();
      if (!ocorrencia) continue;
      totalOcorrencias += 1;

      const eventos = (o.eventos ?? []).map((ev, indice) => ({
        ocorrencia_id: ocorrencia.id,
        licitante_id: licitanteId,
        data_evento: limpo(ev["data_evento"]),
        hora_evento: limpo(ev["hora_evento"]),
        tipo_evento: limpo(ev["tipo_evento"]) ?? "OUTRO",
        autor: limpo(ev["autor"]),
        destinatario: limpo(ev["destinatario"]),
        mensagem_original: limpo(ev["mensagem_original"]),
        mensagem_normalizada: limpo(ev["mensagem_normalizada"]),
        pagina_documento:
          typeof ev["pagina_documento"] === "number" ? ev["pagina_documento"] : null,
        nivel_confianca: limpo(ev["nivel_confianca"]),
        ordem_cronologica: indice + 1,
      }));
      if (eventos.length) await supabase.from("eventos_ocorrencia").insert(eventos);

      const enquadramentos = (o.enquadramentos ?? []).map((e) => ({
        ocorrencia_id: ocorrencia.id,
        lei: limpo(e["lei"]),
        artigo: limpo(e["artigo"]),
        inciso: limpo(e["inciso"]),
        item_edital: limpo(e["item_edital"]),
        dispositivo_texto: limpo(e["dispositivo_texto"]),
        justificativa: limpo(e["justificativa"]),
        origem_dispositivo: limpo(e["origem_dispositivo"]) ?? "SUGERIDO_SISTEMA",
        status_validacao: "PRELIMINAR",
      }));
      if (enquadramentos.length) await supabase.from("enquadramentos").insert(enquadramentos);

      await supabase.from("relatorios").insert({
        processo_id: processo.id,
        ocorrencia_id: ocorrencia.id,
        status: "RASCUNHO",
        dados_json: {},
        checklist: {},
        relato: limpo(o.descricao_resumida),
        providencias: limpo(o.providencias),
        repercussao: limpo(o.repercussao),
        usuario_criacao: userId,
      });
    }

    await supabase
      .from("documentos")
      .update({ status_processamento: "ANALISADO" })
      .eq("id", doc.id);

    return {
      processoId: processo.id,
      licitantes: mapaLicitantes.size,
      ocorrencias: totalOcorrencias,
    };
  });

export const redigirRelato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ocorrenciaId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: ocorrencia } = await supabase
      .from("ocorrencias")
      .select("*, licitantes(*), processos(*), eventos_ocorrencia(*)")
      .eq("id", data.ocorrenciaId)
      .single();
    if (!ocorrencia) throw new Error("Ocorrência não encontrada.");

    const o = ocorrencia as unknown as {
      tipo_ocorrencia: string | null;
      descricao_resumida: string | null;
      manifestacao: string | null;
      licitantes: Record<string, string | null> | null;
      processos: Record<string, string | null> | null;
      eventos_ocorrencia: Record<string, string | number | null>[];
    };

    const eventos = [...(o.eventos_ocorrencia ?? [])].sort(
      (a, b) => Number(a["ordem_cronologica"] ?? 0) - Number(b["ordem_cronologica"] ?? 0),
    );

    const contexto = [
      `Certame: ${o.processos?.["modalidade"] ?? ""} nº ${o.processos?.["numero_certame"] ?? ""}/${o.processos?.["ano_certame"] ?? ""}`,
      `Objeto: ${o.processos?.["objeto"] ?? ""}`,
      `Licitante: ${o.licitantes?.["razao_social"] ?? ""} - CNPJ/CPF ${o.licitantes?.["cnpj_cpf"] ?? ""}`,
      `Tipo de ocorrência: ${o.tipo_ocorrencia ?? ""}`,
      `Resumo: ${o.descricao_resumida ?? ""}`,
      `Manifestação do licitante: ${o.manifestacao ?? ""}`,
      "Eventos em ordem cronológica:",
      ...eventos.map(
        (ev) =>
          `- ${ev["data_evento"] ?? "data não localizada"} ${ev["hora_evento"] ?? ""} | ${ev["tipo_evento"] ?? ""} | ${ev["autor"] ?? ""} → ${ev["destinatario"] ?? ""} | ${ev["mensagem_normalizada"] ?? ev["mensagem_original"] ?? ""} | trecho: "${ev["mensagem_original"] ?? ""}"`,
      ),
    ].join("\n");

    const resposta = await chamarIA(
      [
        { role: "system", content: "Responda exclusivamente com JSON válido." },
        { role: "user", content: promptRedacao(contexto) },
      ],
      { json: true },
    );
    const texto = extrairJson<{
      relato?: string;
      providencias?: string;
      repercussao?: string;
    }>(resposta);

    await supabase
      .from("ocorrencias")
      .update({
        providencias: limpo(texto.providencias),
        repercussao: limpo(texto.repercussao),
      })
      .eq("id", data.ocorrenciaId);

    return {
      relato: texto.relato ?? "",
      providencias: texto.providencias ?? "",
      repercussao: texto.repercussao ?? "",
    };
  });
