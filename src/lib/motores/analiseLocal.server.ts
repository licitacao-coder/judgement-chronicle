import { z } from "zod";
import { chamarServicoPython } from "./motorPython.server";

/** Análise completa feita pelo serviço local do órgão (sem inteligência artificial). */

const texto = z.union([z.string(), z.null()]).optional();
const numero = z.union([z.number(), z.null()]).optional();

const esquemaEvento = z.object({
  data_evento: texto,
  hora_evento: texto,
  tipo_evento: texto,
  autor: texto,
  destinatario: texto,
  mensagem_original: texto,
  mensagem_normalizada: texto,
  pagina_documento: numero,
  nivel_confianca: numero,
});

const esquemaEnquadramento = z.object({
  lei: texto,
  artigo: texto,
  inciso: texto,
  item_edital: texto,
  dispositivo_texto: texto,
  justificativa: texto,
  origem_dispositivo: texto,
  nivel_confianca: numero,
});

export const esquemaAnaliseLocal = z.object({
  versao: z.string(),
  ocr_utilizado: z.boolean().optional(),
  processo: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  licitantes: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  ocorrencias: z.array(
    z.object({
      cnpj_licitante: texto,
      tipo_ocorrencia: texto,
      descricao_resumida: texto,
      manifestacao: texto,
      providencias: texto,
      repercussao: texto,
      nivel_confianca: numero,
      eventos: z.array(esquemaEvento).optional(),
      enquadramentos: z.array(esquemaEnquadramento).optional(),
    }),
  ),
});

export const esquemaRedacaoLocal = z.object({
  versao: z.string(),
  relato: z.string(),
  providencias: z.string(),
  repercussao: z.string(),
});

export async function analisarLocal(
  endereco: string,
  documento: { nome: string | null; extensao: string | null; texto: string },
) {
  return chamarServicoPython(
    endereco,
    "/analise",
    {
      nome_documento: documento.nome,
      extensao: documento.extensao,
      texto: documento.texto,
    },
    esquemaAnaliseLocal,
  );
}

export async function redigirLocal(
  endereco: string,
  dados: {
    certame: string | null;
    objeto: string | null;
    licitante: string | null;
    cnpj: string | null;
    tipo_ocorrencia: string | null;
    resumo: string | null;
    manifestacao: string | null;
    eventos: Record<string, unknown>[];
  },
) {
  return chamarServicoPython(endereco, "/redacao", dados, esquemaRedacaoLocal);
}
