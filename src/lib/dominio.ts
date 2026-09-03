export const NAO_LOCALIZADO = "NAO_LOCALIZADO";

export const ROTULO_TIPO_OCORRENCIA: Record<string, string> = {
  DESISTENCIA_PROPOSTA: "Desistência de proposta",
  RECUSA_ASSINATURA: "Recusa de assinatura",
  NAO_ENVIO_DOCUMENTOS: "Não envio de documentos",
  DOCUMENTO_IRREGULAR: "Documento irregular ou inconsistente",
  PROPOSTA_INEXEQUIVEL: "Proposta inexequível",
  DILIGENCIA_NAO_ATENDIDA: "Diligência não atendida",
  DILIGENCIA_ATENDIDA: "Diligência atendida",
  ATRASO_ENVIO: "Envio fora do prazo",
  DECLARACAO_FALSA: "Declaração possivelmente inverídica",
  CONDUTA_PERTURBADORA: "Conduta perturbadora da sessão",
  INABILITACAO: "Inabilitação",
  DESCLASSIFICACAO: "Desclassificação",
  OUTRA: "Outra ocorrência",
};

export const ROTULO_TIPO_EVENTO: Record<string, string> = {
  ABERTURA_SESSAO: "Abertura da sessão",
  LANCE: "Lance",
  CONVOCACAO: "Convocação",
  DILIGENCIA: "Diligência",
  PRAZO_FIXADO: "Prazo fixado",
  RESPOSTA_LICITANTE: "Resposta do licitante",
  ENVIO_DOCUMENTO: "Envio de documento",
  SILENCIO: "Ausência de manifestação",
  DECISAO_AGENTE: "Decisão do agente",
  SUSPENSAO: "Suspensão da sessão",
  REABERTURA: "Reabertura da sessão",
  ENCERRAMENTO: "Encerramento",
  OUTRO: "Outro registro",
};

export const ORIGEM_DISPOSITIVO: Record<string, string> = {
  CITADO_DOCUMENTO: "Expressamente citado no documento",
  SUGERIDO_SISTEMA: "Sugestão do sistema (não citado no documento)",
};

export const DOCUMENTOS_COMPROBATORIOS = [
  "Ata da sessão pública",
  "Termo/Relatório de julgamento",
  "Extrato do chat da sessão",
  "Relatório de diligências",
  "Proposta comercial apresentada",
  "Documentos de habilitação",
  "Comunicações eletrônicas (e-mails)",
  "Comprovantes de prazos e horários do sistema",
];

export const CHECKLIST_REVISAO = [
  "Dados do processo e do certame conferidos",
  "Identificação do licitante e do CNPJ conferida",
  "Linha do tempo conferida com o documento de origem",
  "Relato revisado, impessoal e sem juízo de valor",
  "Enquadramento tratado como preliminar",
  "Documentos comprobatórios indicados",
  "Ausência de conclusão de responsabilidade ou sanção",
];

export const ETAPAS_PROCESSAMENTO = [
  "Upload do documento",
  "Leitura e extração do texto",
  "Extração dos dados do certame",
  "Identificação dos licitantes e ocorrências",
  "Construção da linha do tempo",
  "Enquadramento preliminar",
  "Formulário pronto para revisão",
];

export function formatarDocumento(valor?: string | null): string {
  if (!valor) return "";
  const d = valor.replace(/\D/g, "");
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return valor;
}

export function rotuloConfianca(valor?: string | number | null): string {
  if (valor === null || valor === undefined || valor === "") return "não informada";
  const n = typeof valor === "number" ? valor : Number(valor);
  if (Number.isNaN(n)) return String(valor).toLowerCase();
  if (n >= 0.85) return "alta";
  if (n >= 0.6) return "média";
  return "baixa";
}

export function dataBrasileiraHoje(): string {
  const hoje = new Date();
  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
}

export function ordenarCronologicamente<
  T extends { data_evento?: string | null; hora_evento?: string | null },
>(eventos: T[]): T[] {
  return [...eventos].sort((a, b) => {
    const ka = `${a.data_evento ?? "9999-99-99"} ${a.hora_evento ?? "99:99"}`;
    const kb = `${b.data_evento ?? "9999-99-99"} ${b.hora_evento ?? "99:99"}`;
    return ka.localeCompare(kb);
  });
}
