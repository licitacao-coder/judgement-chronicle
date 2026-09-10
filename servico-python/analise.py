"""Análise completa do documento de sessão pública, por regras (sem IA).

Cobre as etapas que antes dependiam de inteligência artificial:
identificação do certame, dos licitantes, das ocorrências, da linha do tempo
(eventos em ordem cronológica), do enquadramento preliminar e da redação do
relato, providências e repercussão.

Regras absolutas mantidas do aplicativo:
  * nada é inventado: campo não localizado volta vazio;
  * grafias originais de CNPJ, CPF, datas, horários e números são preservadas;
  * cada ocorrência guarda o trecho literal do documento como evidência;
  * nenhuma conclusão de responsabilidade, dolo, má-fé, penalidade ou sanção.
"""

from __future__ import annotations

import re
from typing import Any

RE_PAGINA = re.compile(r"---\s*P[áa]gina\s+(\d+)\s*---", re.I)
RE_CNPJ = re.compile(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}")
RE_CPF = re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b")
RE_DATA = re.compile(r"\b(\d{2}/\d{2}/\d{4})\b")
RE_HORA = re.compile(r"\b(\d{1,2}[:h]\d{2}(?::\d{2})?)\b")
RE_ESPACOS = re.compile(r"[ \t\u00a0]+")

# ---------------------------------------------------------------- utilidades


def normalizar(texto: str) -> str:
    return RE_ESPACOS.sub(" ", texto.replace("\r", "")).strip()


def primeiro(padrao: str, texto: str, grupo: int = 1) -> str:
    achado = re.search(padrao, texto, re.I)
    if not achado:
        return ""
    try:
        return normalizar(achado.group(grupo))
    except IndexError:
        return ""


def pagina_do_trecho(texto: str, posicao: int) -> int | None:
    ultima = None
    for achado in RE_PAGINA.finditer(texto[:posicao]):
        ultima = int(achado.group(1))
    return ultima


def linhas_uteis(texto: str) -> list[str]:
    return [normalizar(l) for l in texto.split("\n") if normalizar(l)]


# ------------------------------------------------------------------ certame

RE_MODALIDADE = re.compile(
    r"\b(Preg[ãa]o\s+Eletr[ôo]nico|Preg[ãa]o\s+Presencial|Preg[ãa]o|Concorr[êe]ncia"
    r"|Concurso|Leil[ãa]o|Di[áa]logo\s+Competitivo|Dispensa\s+Eletr[ôo]nica"
    r"|Dispensa|Inexigibilidade|Tomada\s+de\s+Pre[çc]os|Convite)\b",
    re.I,
)


def extrair_processo(texto: str) -> dict[str, Any]:
    cabecalho = texto[:12000]
    modalidade = primeiro(RE_MODALIDADE.pattern, cabecalho, 1)

    numero_certame = ""
    ano_certame = ""
    achado = re.search(
        r"(?:Preg[ãa]o|Concorr[êe]ncia|Dispensa|Inexigibilidade|Certame|Licita[çc][ãa]o)"
        r"[^\n\d]{0,40}?n?[ºo°.]?\s*(\d{1,6})\s*/\s*(\d{4})",
        cabecalho,
        re.I,
    )
    if achado:
        numero_certame = achado.group(1)
        ano_certame = achado.group(2)

    objeto = primeiro(
        r"Objeto\s*(?:da\s+(?:licita[çc][ãa]o|contrata[çc][ãa]o))?\s*:?\s*(.{10,900}?)"
        r"(?=\n\s*\n|\n\s*[A-ZÁÉÍÓÚÂÃÇ][^\n]{0,40}:|$)",
        cabecalho,
    )

    return {
        "orgao": primeiro(
            r"(?:[ÓO]rg[ãa]o(?:\s+(?:promotor|licitante))?|Entidade)\s*:?\s*([^\n]{3,160})",
            cabecalho,
        )
        or primeiro(r"^\s*(Prefeitura[^\n]{3,160}|Governo[^\n]{3,160}|Minist[ée]rio[^\n]{3,160})", cabecalho),
        "numero_processo": primeiro(
            r"Processo\s*(?:administrativo)?\s*n?[ºo°.]?\s*:?\s*([\d./\-]{4,40})", cabecalho
        ),
        "processo_sei": primeiro(r"SEI\s*n?[ºo°.]?\s*:?\s*([\d./\-]{4,40})", cabecalho),
        "modalidade": modalidade,
        "numero_certame": numero_certame,
        "ano_certame": ano_certame,
        "objeto": objeto,
        "plataforma": primeiro(
            r"(?:Plataforma|Sistema|Portal)\s*(?:eletr[ôo]nic[ao])?\s*:?\s*([^\n]{3,80})", cabecalho
        )
        or primeiro(r"\b(Comprasnet|Compras\.gov\.br|Licitanet|BLL|BBMNET|Portal\s+de\s+Compras\s+P[úu]blicas)\b", cabecalho),
        "data_sessao": primeiro(
            r"(?:Data\s+(?:da\s+)?(?:sess[ãa]o|abertura)|Sess[ãa]o\s+p[úu]blica[^\n]{0,40}?)"
            r"[^\n\d]{0,20}(\d{2}/\d{2}/\d{4})",
            cabecalho,
        )
        or primeiro(RE_DATA.pattern, cabecalho),
        "horario_sessao": primeiro(
            r"(?:Hor[áa]rio|[àa]s)\s*:?\s*(\d{1,2}[:h]\d{2}(?::\d{2})?)", cabecalho
        ),
        "agente": primeiro(
            r"(?:Agente\s+de\s+contrata[çc][ãa]o|Pregoeir[oa]|Presidente\s+da\s+comiss[ãa]o)"
            r"\s*:?\s*([^\n]{3,120})",
            cabecalho,
        ),
        "uasg": primeiro(r"UASG\s*:?\s*(\d{3,10})", cabecalho),
        "nivel_confianca": 0.6,
    }


# --------------------------------------------------------------- licitantes

RE_SITUACAO_LICITANTE = re.compile(
    r"(Aceit[oa]s?\s+e\s+Habilitad[oa]s?|Habilitad[oa]|Inabilitad[oa]|Desclassificad[oa]"
    r"|Classificad[oa]|Desistente|Recusad[oa]|Cancelad[oa]\s+na\s+aceita[çc][ãa]o"
    r"|Cancelad[oa]\s+no\s+julgamento|Cancelad[oa])",
    re.I,
)


def extrair_licitantes(texto: str) -> list[dict[str, Any]]:
    encontrados: dict[str, dict[str, Any]] = {}
    for achado in RE_CNPJ.finditer(texto):
        cnpj = achado.group(0)
        inicio = max(0, achado.start() - 320)
        volta = normalizar(texto[inicio : achado.start()])
        segue = normalizar(texto[achado.end() : achado.end() + 320])

        razao = ""
        candidatos = re.findall(
            r"([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9&.,\-/' ]{5,90}?(?:LTDA|ME|EPP|EIRELI|S/?A|S\.A\.?|"
            r"COM[ÉE]RCIO[A-ZÀ-Ú0-9&.,\-/' ]{0,60}|DISTRIBUIDORA[A-ZÀ-Ú0-9&.,\-/' ]{0,60}))",
            volta,
        )
        if candidatos:
            razao = re.sub(r"[\s,.-]*(CNPJ|CPF)\s*$", "", normalizar(candidatos[-1]), flags=re.I)
        else:
            rotulado = re.search(
                r"(?:Fornecedor|Licitante|Empresa|Raz[ãa]o\s+social)\s*:?\s*([^\n:]{5,120})$",
                volta,
                re.I,
            )
            if rotulado:
                razao = normalizar(rotulado.group(1))

        situacao = ""
        achado_situacao = RE_SITUACAO_LICITANTE.search(segue) or RE_SITUACAO_LICITANTE.search(volta)
        if achado_situacao:
            situacao = normalizar(achado_situacao.group(1))

        registro = encontrados.setdefault(
            cnpj,
            {
                "razao_social": razao,
                "cnpj_cpf": cnpj,
                "representante": "",
                "email": "",
                "telefone": "",
                "situacao": situacao,
                "grupo_lote": "",
                "itens": "",
                "valor_proposta": "",
                "nivel_confianca": 0.6,
            },
        )
        if not registro["razao_social"] and razao:
            registro["razao_social"] = razao
        if not registro["situacao"] and situacao:
            registro["situacao"] = situacao

    for registro in encontrados.values():
        contexto = ""
        posicao = texto.find(registro["cnpj_cpf"])
        if posicao >= 0:
            contexto = texto[max(0, posicao - 400) : posicao + 600]
        registro["email"] = primeiro(r"([\w.\-+]+@[\w.\-]+\.\w{2,})", contexto)
        registro["telefone"] = primeiro(r"(\(?\d{2}\)?\s?\d{4,5}-?\d{4})", contexto)
        registro["representante"] = primeiro(
            r"(?:Representante|Respons[áa]vel)\s*(?:legal)?\s*:?\s*([^\n:;]{3,90})", contexto
        )
        registro["itens"] = primeiro(r"\bItem\s+(\d{1,4})\b", contexto)

    return list(encontrados.values())


# -------------------------------------------------------------- ocorrências

# Cada padrão gera uma ocorrência quando localizado no documento.
PADROES_OCORRENCIA: list[tuple[str, str, str]] = [
    (
        "DESISTENCIA_PROPOSTA",
        r"desist[êe]ncia\s+d[ao]\s+(?:proposta|lance)|desistiu\s+d[ao]\s+(?:proposta|lance)"
        r"|solicit(?:a|ou)\s+desist[êe]ncia",
        "Registro de desistência de proposta ou lance.",
    ),
    (
        "RECUSA_ASSINATURA",
        r"recus(?:a|ou|ou-se)\s+(?:a\s+)?assin(?:ar|atura)",
        "Registro de recusa de assinatura.",
    ),
    (
        "NAO_ENVIO_DOCUMENTOS",
        r"n[ãa]o\s+(?:enviou|apresentou|encaminhou)\s+(?:os\s+)?documento|deixou\s+de\s+(?:enviar|apresentar)"
        r"|aus[êe]ncia\s+de\s+envio\s+(?:d[ao]s?\s+)?documento",
        "Registro de não envio ou não apresentação de documentos no prazo.",
    ),
    (
        "DOCUMENTO_IRREGULAR",
        r"documento\w*\s+(?:irregular|inv[áa]lid\w+|vencid\w+|ileg[íi]vel|incompleto|divergente)"
        r"|certid[ãa]o\s+(?:vencida|irregular|negativa\s+n[ãa]o\s+apresentada)",
        "Registro de documento apresentado com irregularidade formal.",
    ),
    (
        "PROPOSTA_INEXEQUIVEL",
        r"inexequ[íi]vel|inexequibilidade",
        "Registro de questionamento quanto à exequibilidade da proposta.",
    ),
    (
        "DILIGENCIA_NAO_ATENDIDA",
        r"dilig[êe]ncia\s+n[ãa]o\s+(?:atendida|respondida|cumprida)"
        r"|n[ãa]o\s+atendeu\s+[àa]\s+dilig[êe]ncia",
        "Registro de diligência não atendida.",
    ),
    (
        "DILIGENCIA_ATENDIDA",
        r"dilig[êe]ncia\s+(?:atendida|respondida|cumprida)|em\s+resposta\s+[àa]\s+dilig[êe]ncia",
        "Registro de diligência atendida pelo licitante.",
    ),
    (
        "ATRASO_ENVIO",
        r"ap[óo]s\s+o\s+prazo|fora\s+do\s+prazo|intempestiv|com\s+atraso",
        "Registro de envio ou manifestação fora do prazo fixado.",
    ),
    (
        "DECLARACAO_FALSA",
        r"declara[çc][ãa]o\s+(?:falsa|inver[íi]dica)|informa[çc][ãa]o\s+inver[íi]dica",
        "Registro de questionamento sobre veracidade de declaração.",
    ),
    (
        "CONDUTA_PERTURBADORA",
        r"tumultu|perturba[çc][ãa]o\s+d[ao]\s+sess[ãa]o|linguagem\s+inadequada|ofens",
        "Registro de conduta que afetou o andamento da sessão.",
    ),
    (
        "INABILITACAO",
        r"inabilita[çc][ãa]o|inabilitad[oa]",
        "Registro de inabilitação de licitante.",
    ),
    (
        "DESCLASSIFICACAO",
        r"desclassifica[çc][ãa]o|desclassificad[oa]|cancelad[oa]\s+n[ao]\s+(?:aceita[çc][ãa]o|julgamento)",
        "Registro de desclassificação de proposta.",
    ),
    (
        "OUTRA",
        r"recurso\s+(?:administrativo|interposto)|inten[çc][ãa]o\s+de\s+recurso"
        r"|suspens[ãa]o\s+d[ao]\s+sess[ãa]o|reabertura\s+d[ao]\s+sess[ãa]o",
        "Registro de recurso, intenção de recurso, suspensão ou reabertura da sessão.",
    ),
]

PADROES_EVENTO: list[tuple[str, str]] = [
    ("ABERTURA_SESSAO", r"abertura\s+d[ao]\s+sess[ãa]o|sess[ãa]o\s+(?:foi\s+)?aberta|in[íi]cio\s+d[ao]\s+sess[ãa]o"),
    ("LANCE", r"\blance\b|\blances\b|melhor\s+lance|encerramento\s+da\s+etapa\s+de\s+lances"),
    ("CONVOCACAO", r"convoca(?:d[oa]|[çc][ãa]o|r|mos)|fica\s+convocad"),
    ("DILIGENCIA", r"dilig[êe]ncia"),
    ("PRAZO_FIXADO", r"prazo\s+(?:de|at[ée])\s+|fica\s+concedido\s+o\s+prazo|prorroga[çc][ãa]o\s+de\s+prazo"),
    ("RESPOSTA_LICITANTE", r"o\s+licitante\s+(?:informou|respondeu|manifestou|alegou)|em\s+resposta"),
    ("ENVIO_DOCUMENTO", r"anex(?:ou|ado)|envi(?:ou|ado)\s+(?:o\s+)?(?:arquivo|documento)"),
    ("SILENCIO", r"n[ãa]o\s+(?:houve\s+)?(?:manifesta[çc][ãa]o|resposta)|permaneceu\s+silente"),
    ("DECISAO_AGENTE", r"decid|declar(?:o|ou|ado)|homolog|adjudic|aceit[oa]\s+e\s+habilit"),
    ("SUSPENSAO", r"suspens[ãa]o|suspend"),
    ("REABERTURA", r"reabertura|reabert"),
    ("ENCERRAMENTO", r"encerra(?:d[oa]|mento|r)\s*(?:a\s+sess[ãa]o)?"),
]

ENQUADRAMENTOS_SUGERIDOS: dict[str, list[dict[str, str]]] = {
    "DESISTENCIA_PROPOSTA": [
        {
            "lei": "Lei nº 14.133/2021",
            "artigo": "155",
            "inciso": "I",
            "dispositivo_texto": "dar causa à inexecução parcial do objeto / deixar de manter a proposta",
        }
    ],
    "RECUSA_ASSINATURA": [
        {"lei": "Lei nº 14.133/2021", "artigo": "155", "inciso": "II", "dispositivo_texto": "não celebrar o contrato quando convocado"}
    ],
    "NAO_ENVIO_DOCUMENTOS": [
        {"lei": "Lei nº 14.133/2021", "artigo": "155", "inciso": "III", "dispositivo_texto": "deixar de entregar a documentação exigida para o certame"}
    ],
    "DOCUMENTO_IRREGULAR": [
        {"lei": "Lei nº 14.133/2021", "artigo": "63", "inciso": "", "dispositivo_texto": "habilitação: exigências documentais do certame"}
    ],
    "PROPOSTA_INEXEQUIVEL": [
        {"lei": "Lei nº 14.133/2021", "artigo": "59", "inciso": "III", "dispositivo_texto": "desclassificação de proposta com preço inexequível"}
    ],
    "DILIGENCIA_NAO_ATENDIDA": [
        {"lei": "Lei nº 14.133/2021", "artigo": "64", "inciso": "", "dispositivo_texto": "diligência para saneamento de documentos"}
    ],
    "DECLARACAO_FALSA": [
        {"lei": "Lei nº 14.133/2021", "artigo": "155", "inciso": "VIII", "dispositivo_texto": "apresentar declaração ou documentação falsa"}
    ],
    "CONDUTA_PERTURBADORA": [
        {"lei": "Lei nº 14.133/2021", "artigo": "155", "inciso": "V", "dispositivo_texto": "praticar ato lesivo ao andamento do certame"}
    ],
    "ATRASO_ENVIO": [
        {"lei": "Lei nº 14.133/2021", "artigo": "155", "inciso": "IV", "dispositivo_texto": "não manter a proposta / descumprir prazos do certame"}
    ],
    "INABILITACAO": [
        {"lei": "Lei nº 14.133/2021", "artigo": "63", "inciso": "", "dispositivo_texto": "habilitação do licitante"}
    ],
    "DESCLASSIFICACAO": [
        {"lei": "Lei nº 14.133/2021", "artigo": "59", "inciso": "", "dispositivo_texto": "desclassificação de propostas"}
    ],
}

RE_ITEM_EDITAL = re.compile(r"(?:item|subitem)\s+(\d{1,2}(?:\.\d{1,2}){0,3})\s+do\s+edital", re.I)


def tipo_evento(frase: str) -> str:
    for tipo, padrao in PADROES_EVENTO:
        if re.search(padrao, frase, re.I):
            return tipo
    return "OUTRO"


def frases_do_texto(texto: str) -> list[tuple[str, int]]:
    """Frases com a posição inicial no texto integral."""
    resultado: list[tuple[str, int]] = []
    for bloco in re.finditer(r"[^\n]{20,}", texto):
        trecho = bloco.group(0)
        base = bloco.start()
        # Não quebra em abreviações usuais (art., inc., n., Lei n., §, Sr.).
        padrao = r".{20,}?(?:(?<!\bart)(?<!\binc)(?<!\bn)(?<!\bsr)(?<!\bsra)(?<!\bparágr)[.;](?=\s|$)|$)"
        for parte in re.finditer(padrao, trecho, re.I):
            frase = normalizar(parte.group(0))
            if len(frase) >= 20:
                resultado.append((frase, base + parte.start()))
    return resultado


def cnpj_proximo(texto: str, posicao: int) -> str:
    janela = texto[max(0, posicao - 600) : posicao + 600]
    achado = RE_CNPJ.search(janela)
    return achado.group(0) if achado else ""


def montar_eventos(texto: str, frases: list[tuple[str, int]]) -> list[dict[str, Any]]:
    eventos: list[dict[str, Any]] = []
    for frase, posicao in frases:
        tipo = tipo_evento(frase)
        if tipo == "OUTRO":
            continue
        data = primeiro(RE_DATA.pattern, frase)
        hora = primeiro(RE_HORA.pattern, frase)
        if not data:
            data = primeiro(RE_DATA.pattern, texto[max(0, posicao - 400) : posicao])
        autor = primeiro(
            r"\b(Pregoeir[oa]|Agente\s+de\s+contrata[çc][ãa]o|Sistema|Licitante|Fornecedor"
            r"|Comiss[ãa]o|Autoridade\s+competente)\b",
            frase,
        )
        eventos.append(
            {
                "data_evento": data,
                "hora_evento": hora,
                "tipo_evento": tipo,
                "autor": autor,
                "destinatario": "",
                "mensagem_original": frase[:1200],
                "mensagem_normalizada": frase[:600],
                "pagina_documento": pagina_do_trecho(texto, posicao),
                "nivel_confianca": 0.6,
                "_posicao": posicao,
            }
        )
    return eventos


def ordenar_eventos(eventos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def chave(ev: dict[str, Any]) -> tuple[str, str, int]:
        data = ev.get("data_evento") or ""
        ordenavel = ""
        if re.fullmatch(r"\d{2}/\d{2}/\d{4}", data):
            dia, mes, ano = data.split("/")
            ordenavel = f"{ano}{mes}{dia}"
        hora = (ev.get("hora_evento") or "").replace("h", ":")
        return (ordenavel or "99999999", hora or "99:99", int(ev.get("_posicao") or 0))

    return sorted(eventos, key=chave)


def extrair_ocorrencias(texto: str) -> list[dict[str, Any]]:
    frases = frases_do_texto(texto)
    eventos_gerais = ordenar_eventos(montar_eventos(texto, frases))

    ocorrencias: list[dict[str, Any]] = []
    for tipo, padrao, resumo_padrao in PADROES_OCORRENCIA:
        achados = [(f, p) for f, p in frases if re.search(padrao, f, re.I)]
        if not achados:
            continue

        # Agrupa por licitante identificado nas proximidades do trecho.
        por_licitante: dict[str, list[tuple[str, int]]] = {}
        for frase, posicao in achados:
            por_licitante.setdefault(cnpj_proximo(texto, posicao), []).append((frase, posicao))

        for cnpj, trechos in por_licitante.items():
            primeira_posicao = min(p for _, p in trechos)
            ultima_posicao = max(p for _, p in trechos)
            eventos = [
                {k: v for k, v in ev.items() if k != "_posicao"}
                for ev in eventos_gerais
                if primeira_posicao - 2500 <= int(ev["_posicao"]) <= ultima_posicao + 2500
            ][:40]
            if not eventos:
                eventos = [
                    {
                        "data_evento": primeiro(RE_DATA.pattern, trechos[0][0]),
                        "hora_evento": primeiro(RE_HORA.pattern, trechos[0][0]),
                        "tipo_evento": "OUTRO",
                        "autor": "",
                        "destinatario": "",
                        "mensagem_original": trechos[0][0][:1200],
                        "mensagem_normalizada": trechos[0][0][:600],
                        "pagina_documento": pagina_do_trecho(texto, trechos[0][1]),
                        "nivel_confianca": 0.5,
                    }
                ]

            contexto = texto[max(0, primeira_posicao - 800) : ultima_posicao + 1200]
            enquadramentos: list[dict[str, Any]] = []
            for sugestao in ENQUADRAMENTOS_SUGERIDOS.get(tipo, []):
                enquadramentos.append(
                    {
                        **sugestao,
                        "item_edital": primeiro(RE_ITEM_EDITAL.pattern, contexto),
                        "justificativa": "Sugestão preliminar do serviço local, com base nos fatos "
                        "registrados no documento. Depende de conferência humana.",
                        "origem_dispositivo": "SUGERIDO_SISTEMA",
                        "nivel_confianca": 0.5,
                    }
                )
            citado = re.search(
                r"art(?:igo)?\.?\s*(\d{1,3})[^\n]{0,60}?Lei\s*n?[ºo°.]?\s*([\d.]+/\d{4})", contexto, re.I
            )
            if citado:
                enquadramentos.insert(
                    0,
                    {
                        "lei": f"Lei nº {citado.group(2)}",
                        "artigo": citado.group(1),
                        "inciso": "",
                        "item_edital": primeiro(RE_ITEM_EDITAL.pattern, contexto),
                        "dispositivo_texto": normalizar(citado.group(0)),
                        "justificativa": "Dispositivo expressamente citado no documento.",
                        "origem_dispositivo": "CITADO_DOCUMENTO",
                        "nivel_confianca": 0.8,
                    },
                )

            manifestacao = primeiro(
                r"(?:o\s+licitante|a\s+empresa|o\s+fornecedor)\s+(?:informou|alegou|manifestou|justificou)"
                r"[^.;\n]{0,600}[.;]?",
                contexto,
                0,
            )

            ocorrencias.append(
                {
                    "cnpj_licitante": cnpj,
                    "tipo_ocorrencia": tipo,
                    "descricao_resumida": f"{resumo_padrao} Trecho: “{trechos[0][0][:400]}”",
                    "manifestacao": manifestacao,
                    "providencias": "",
                    "repercussao": "",
                    "nivel_confianca": 0.6,
                    "eventos": eventos,
                    "enquadramentos": enquadramentos,
                }
            )

    return ocorrencias


def analisar(texto: str) -> dict[str, Any]:
    return {
        "processo": extrair_processo(texto),
        "licitantes": extrair_licitantes(texto),
        "ocorrencias": extrair_ocorrencias(texto),
    }


# ------------------------------------------------------------------ redação

ROTULO_TIPO = {
    "DESISTENCIA_PROPOSTA": "desistência de proposta ou lance",
    "RECUSA_ASSINATURA": "recusa de assinatura",
    "NAO_ENVIO_DOCUMENTOS": "não apresentação de documentos exigidos",
    "DOCUMENTO_IRREGULAR": "documentação com irregularidade formal",
    "PROPOSTA_INEXEQUIVEL": "questionamento quanto à exequibilidade da proposta",
    "DILIGENCIA_NAO_ATENDIDA": "diligência não atendida",
    "DILIGENCIA_ATENDIDA": "diligência atendida",
    "ATRASO_ENVIO": "manifestação ou envio fora do prazo",
    "DECLARACAO_FALSA": "questionamento sobre veracidade de declaração",
    "CONDUTA_PERTURBADORA": "conduta que afetou o andamento da sessão",
    "INABILITACAO": "inabilitação",
    "DESCLASSIFICACAO": "desclassificação",
    "OUTRA": "ocorrência registrada em sessão",
}


def redigir(dados: dict[str, Any]) -> dict[str, str]:
    """Monta relato, providências e repercussão em texto corrido e impessoal."""
    certame = normalizar(str(dados.get("certame") or ""))
    objeto = normalizar(str(dados.get("objeto") or ""))
    licitante = normalizar(str(dados.get("licitante") or ""))
    cnpj = normalizar(str(dados.get("cnpj") or ""))
    tipo = str(dados.get("tipo_ocorrencia") or "OUTRA").upper()
    resumo = normalizar(str(dados.get("resumo") or ""))
    manifestacao = normalizar(str(dados.get("manifestacao") or ""))
    eventos = dados.get("eventos") or []

    identificacao = licitante or "o licitante identificado no documento"
    if cnpj:
        identificacao = f"{identificacao}, inscrito no CNPJ/CPF nº {cnpj},"

    partes: list[str] = []
    abertura = "Registra-se que, no curso da sessão pública"
    if certame:
        abertura += f" do {certame}"
    if objeto:
        abertura += f", cujo objeto é {objeto[:300]}"
    abertura += (
        f", foi constatada situação de {ROTULO_TIPO.get(tipo, 'ocorrência registrada em sessão')} "
        f"em relação a {identificacao} conforme os registros a seguir descritos."
    )
    partes.append(abertura)

    for ev in eventos[:30]:
        data = normalizar(str(ev.get("data_evento") or ""))
        hora = normalizar(str(ev.get("hora_evento") or ""))
        mensagem = normalizar(str(ev.get("mensagem_normalizada") or ev.get("mensagem_original") or ""))
        if not mensagem:
            continue
        marcador = ""
        if re.match(r"^(Em|[ÀA]s)\s", mensagem, re.I) or re.match(r"^\d{2}/\d{2}/\d{4}", mensagem):
            partes.append(mensagem.rstrip(".") + ".")
            continue
        if data and hora:
            marcador = f"Em {data}, às {hora}, "
        elif data:
            marcador = f"Em {data}, "
        elif hora:
            marcador = f"Às {hora}, "
        else:
            marcador = "Na sequência, "
        frase = mensagem[0].lower() + mensagem[1:] if mensagem else mensagem
        partes.append(f"{marcador}{frase.rstrip('.')}.")

    if resumo:
        partes.append(f"O documento consigna ainda: {resumo.rstrip('.')}.")
    if manifestacao:
        partes.append(f"Quanto à manifestação apresentada, o documento registra: {manifestacao.rstrip('.')}.")

    partes.append(
        "Os fatos acima decorrem exclusivamente da leitura do documento da sessão pública, têm "
        "caráter preliminar e informativo e não importam juízo de responsabilidade, dolo, má-fé, "
        "penalidade ou sanção administrativa, cabendo conferência humana e, se for o caso, "
        "apuração em procedimento próprio, assegurados o contraditório e a ampla defesa."
    )

    providencias = (
        "Foram adotadas, no âmbito da sessão pública, as providências registradas no documento, "
        "com a formalização deste relatório de ocorrência para conhecimento da autoridade "
        "competente e adoção das medidas que entender cabíveis, inclusive eventual instauração de "
        "procedimento próprio, assegurados o contraditório e a ampla defesa."
    )
    repercussao = (
        "A ocorrência repercutiu no andamento do certame nos limites descritos no relato, "
        "conforme registros do documento da sessão pública, sem que se ateste, nesta oportunidade, "
        "prejuízo mensurável ou responsabilidade de qualquer participante."
    )

    return {
        "relato": " ".join(partes),
        "providencias": providencias,
        "repercussao": repercussao,
    }
