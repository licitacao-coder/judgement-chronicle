export const REGRAS_GERAIS = `Você atua como assistente técnico de um órgão público na análise de documentos de sessão pública de licitação.

REGRAS ABSOLUTAS:
1. Nunca invente informação. Use exclusivamente o que consta no texto fornecido.
2. Quando um dado não constar no documento, retorne exatamente "NAO_LOCALIZADO".
3. Preserve máscaras e grafias originais de CNPJ, CPF, números de processo, datas e horários.
4. Trate cada licitante separadamente; nunca misture fatos de licitantes distintos.
5. Toda ocorrência deve estar sustentada por trecho literal do documento (evidência).
6. Distinga dispositivos EXPRESSAMENTE citados no documento (CITADO_DOCUMENTO) de sugestões suas (SUGERIDO_SISTEMA).
7. É proibido concluir responsabilidade, dolo, má-fé, culpa, penalidade ou sanção administrativa. O resultado é preliminar e informativo.
8. Linguagem impessoal, técnica e administrativa, sem adjetivação.`;

export function promptExtracao(texto: string): string {
  return `${REGRAS_GERAIS}

Analise o documento abaixo e devolva SOMENTE um objeto JSON com esta estrutura:

{
  "processo": {
    "orgao": "", "numero_processo": "", "processo_sei": "", "modalidade": "",
    "numero_certame": "", "ano_certame": "", "objeto": "", "plataforma": "",
    "data_sessao": "", "horario_sessao": "", "agente": "", "uasg": "",
    "nivel_confianca": 0.0
  },
  "licitantes": [
    {
      "razao_social": "", "cnpj_cpf": "", "representante": "", "email": "",
      "telefone": "", "situacao": "", "grupo_lote": "", "itens": "",
      "valor_proposta": "", "classificacao": "", "nivel_confianca": 0.0
    }
  ],
  "ocorrencias": [
    {
      "cnpj_licitante": "",
      "tipo_ocorrencia": "UM DE: DESISTENCIA_PROPOSTA, RECUSA_ASSINATURA, NAO_ENVIO_DOCUMENTOS, DOCUMENTO_IRREGULAR, PROPOSTA_INEXEQUIVEL, DILIGENCIA_NAO_ATENDIDA, DILIGENCIA_ATENDIDA, ATRASO_ENVIO, DECLARACAO_FALSA, CONDUTA_PERTURBADORA, INABILITACAO, DESCLASSIFICACAO, OUTRA",
      "descricao_resumida": "",
      "manifestacao": "",
      "providencias": "",
      "repercussao": "",
      "nivel_confianca": 0.0,
      "eventos": [
        {
          "data_evento": "", "hora_evento": "",
          "tipo_evento": "UM DE: ABERTURA_SESSAO, LANCE, CONVOCACAO, DILIGENCIA, PRAZO_FIXADO, RESPOSTA_LICITANTE, ENVIO_DOCUMENTO, SILENCIO, DECISAO_AGENTE, SUSPENSAO, REABERTURA, ENCERRAMENTO, OUTRO",
          "autor": "", "destinatario": "",
          "mensagem_original": "trecho literal do documento",
          "mensagem_normalizada": "descrição objetiva do fato",
          "pagina_documento": null,
          "nivel_confianca": 0.0
        }
      ],
      "enquadramentos": [
        {
          "lei": "", "artigo": "", "inciso": "", "item_edital": "",
          "dispositivo_texto": "", "justificativa": "",
          "origem_dispositivo": "CITADO_DOCUMENTO ou SUGERIDO_SISTEMA",
          "nivel_confianca": 0.0
        }
      ]
    }
  ]
}

Os eventos de cada ocorrência devem estar em ordem cronológica.
Se não houver ocorrência relativa a um licitante, não crie ocorrência para ele.

=== DOCUMENTO ===
${texto.slice(0, 120000)}
=== FIM DO DOCUMENTO ===`;
}

export function promptRedacao(contexto: string): string {
  return `${REGRAS_GERAIS}

Redija o relato oficial da ocorrência para o documento "RELATÓRIO DE OCORRÊNCIA EM SESSÃO PÚBLICA".
Use apenas os fatos e evidências abaixo, em ordem cronológica, em texto corrido (sem listas ou marcadores),
em linguagem administrativa impessoal, mencionando datas, horários, prazos e a identificação do licitante.
Não conclua responsabilidade, dolo, má-fé ou sanção.

Devolva SOMENTE JSON:
{"relato": "", "providencias": "", "repercussao": ""}

=== FATOS ===
${contexto}
=== FIM ===`;
}
