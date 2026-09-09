"""Leitura do Termo de Julgamento: itens efetivamente Aceitos e Habilitados.

Mesmas regras do motor interno do aplicativo, com a vantagem de ler PDFs
digitalizados como imagem por meio de OCR (Tesseract).
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, asdict
from typing import Any

RE_EVIDENCIA = re.compile(r"Aceit[oa]s?\s+e\s+Habilitad[oa]s?", re.I)
RE_CNPJ = re.compile(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}")
RE_PAGINA = re.compile(r"---\s*P[áa]gina\s+(\d+)\s*---", re.I)
RE_ITEM = re.compile(r"(^|\n)\s*Item\s+(\d{1,4})\b", re.I)
RE_ACEITO = re.compile(
    r"Aceit[oa]s?\s+e\s+Habilitad[oa]s?\b(.{0,400}?)\bCNPJ:?\s*([\d.]{2,}/?[\d-]*)\s*,?\s*melhor\s+lance:?\s*(.{0,160})",
    re.I | re.S,
)
RE_ROTULADO = re.compile(
    r"R?\$?\s*([\d.]+,\d{2,4}|\d+(?:[.,]\d+)?)\s*\(?\s*(unit\w*|total)?", re.I
)
RE_REFERENCIA = re.compile(
    r"Valor\s+(?:estimado|de\s+refer[êe]ncia|m[áa]ximo(?:\s+aceit[áa]vel)?)\s*:?\s*([^:]{0,120})",
    re.I,
)
RE_NEGOCIADO = re.compile(r"Valor\s+negociado\s*:?\s*([^:]{0,120})", re.I)
RE_SEM_VALOR = re.compile(r"n[ãa]o\s+realizado|n[ãa]o\s+se\s+aplica|^\s*-\s*$", re.I)
RE_SITUACAO = re.compile(r"Situa[çc][ãa]o(?:\s+do\s+item)?\s*:?\s*([^.;|\n]{3,80})", re.I)
RE_CORTE_LANCE = re.compile(
    r"\bPropostas\b|\bFornecedor\b|\bBenef[íi]cio\b|\bValor\s+proposta\b|\bValor\s+negociado\b",
    re.I,
)
RE_CORTE_TRECHO = re.compile(r"\bPropostas\b|\bFornecedor\s+Valor\s+ofertado\b", re.I)

PADROES_SITUACAO = [
    r"Aberto\s+para\s+recursos",
    r"Aguardando\s+adjudica[çc][ãa]o",
    r"Aguardando\s+homologa[çc][ãa]o",
    r"Adjudicado\s+e\s+Homologado",
    r"Adjudicado",
    r"Homologado",
    r"Encerrado",
    r"Cancelado[^.;\n]{0,40}",
    r"Deserto",
    r"Fracassado",
    r"Em\s+julgamento",
    r"Aceit[oa]s?\s+e\s+Habilitad[oa]s?",
]

RE_QUANTIDADE = re.compile(
    r"Quantidade\s*(?:total)?\s*:?\s*([\d.]+(?:,\d+)?)", re.I
)
RE_UNIDADE = re.compile(
    r"Unidade\s+de\s+(?:fornecimento|medida)\s*:?\s*([^\n:;]{1,40})", re.I
)
RE_DESCRICAO = re.compile(
    r"(?:Descri[çc][ãa]o(?:\s+detalhada)?|Especifica[çc][ãa]o)\s*:?\s*(.{5,1200}?)(?=\s{2,}[A-ZÁÉÍÓÚÂÃÇ][a-zá-ú]+\s*:|$)",
    re.I | re.S,
)


@dataclass
class Item:
    numero_item: int | None = None
    especificacao: str | None = None
    quantidade: float | None = None
    unidade: str | None = None
    valor_unitario: float | None = None
    valor_total: float | None = None
    valor_negociado_unitario: float | None = None
    valor_negociado_total: float | None = None
    origem_valor: str | None = None
    valor_referencia_unitario: float | None = None
    valor_referencia_total: float | None = None
    percentual_diferenca: float | None = None
    licitante: str | None = None
    cnpj: str | None = None
    situacao: str | None = None
    pagina: int | None = None
    trecho_origem: str | None = None
    status_conferencia: str = "NECESSITA_CONFERENCIA"
    validacao_total: str | None = None
    diferenca: float | None = None
    observacoes: str | None = None


def numero_br(texto: str | None) -> float | None:
    if not texto:
        return None
    limpo = re.sub(r"\s", "", texto).replace("R$", "")
    limpo = re.sub(r"\.(?=\d{3}(\D|$))", "", limpo).replace(",", ".")
    try:
        return float(limpo)
    except ValueError:
        return None


def ler_texto_pdf(conteudo: bytes) -> tuple[str, bool]:
    """Devolve o texto por páginas e se o OCR foi necessário."""
    import pdfplumber

    partes: list[str] = []
    with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
        for indice, pagina in enumerate(pdf.pages, start=1):
            texto = pagina.extract_text() or ""
            partes.append(f"--- Página {indice} ---\n{texto}")
    junto = "\n\n".join(partes)
    if len(re.sub(r"\s", "", junto)) >= 200:
        return junto, False
    return ler_texto_ocr(conteudo), True


def ler_texto_ocr(conteudo: bytes) -> str:
    """OCR para PDFs digitalizados como imagem."""
    import pytesseract
    from pdf2image import convert_from_bytes

    partes: list[str] = []
    for indice, imagem in enumerate(convert_from_bytes(conteudo, dpi=300), start=1):
        texto = pytesseract.image_to_string(imagem, lang="por")
        partes.append(f"--- Página {indice} ---\n{texto}")
    return "\n\n".join(partes)


def separar_paginas(texto: str) -> list[tuple[int, str]]:
    partes = RE_PAGINA.split(texto)
    if len(partes) < 3:
        return [(1, texto)]
    paginas: list[tuple[int, str]] = []
    for i in range(1, len(partes), 2):
        paginas.append((int(partes[i]), partes[i + 1] if i + 1 < len(partes) else ""))
    return paginas


def tem_evidencia(conteudo: str) -> bool:
    return bool(RE_EVIDENCIA.search(re.sub(r"\s+", " ", conteudo)))


def separar_itens(texto: str) -> list[tuple[int, int, str]]:
    """(numero_item, pagina, conteudo) para cada item localizado."""
    acumulado = ""
    mapa: list[tuple[int, int]] = []
    for pagina, conteudo in separar_paginas(texto):
        acumulado += "\n" + conteudo
        mapa.append((len(acumulado), pagina))

    marcas: list[tuple[int, int, int]] = []
    for m in RE_ITEM.finditer(acumulado):
        inicio = m.start()
        pagina = next((p for fim, p in mapa if inicio < fim), 1)
        marcas.append((int(m.group(2)), pagina, inicio))

    blocos: dict[int, tuple[int, int, str]] = {}
    for i, (numero, pagina, inicio) in enumerate(marcas):
        fim = marcas[i + 1][2] if i + 1 < len(marcas) else len(acumulado)
        conteudo = acumulado[inicio:fim]
        anterior = blocos.get(numero)
        evidencia = tem_evidencia(conteudo)
        if anterior is None or (evidencia and not tem_evidencia(anterior[2])):
            blocos[numero] = (numero, pagina, conteudo)
        elif evidencia and len(conteudo) > len(anterior[2]):
            blocos[numero] = (numero, pagina, conteudo)
    return [blocos[k] for k in sorted(blocos)]


def ler_rotulados(trecho: str) -> tuple[float | None, float | None]:
    unitario: float | None = None
    total: float | None = None
    sem_rotulo: list[float] = []
    for m in RE_ROTULADO.finditer(trecho or ""):
        n = numero_br(m.group(1))
        if n is None:
            continue
        rotulo = (m.group(2) or "").lower()
        if rotulo.startswith("unit"):
            unitario = n
        elif rotulo == "total":
            total = n
        else:
            sem_rotulo.append(n)
    if total is None and unitario is None and sem_rotulo:
        total = sem_rotulo[-1]
        if len(sem_rotulo) > 1:
            unitario = sem_rotulo[0]
    return unitario, total


def ler_aceito_habilitado(bloco: str) -> dict[str, Any] | None:
    plano = re.sub(r"\s+", " ", bloco)
    m = RE_ACEITO.search(plano)
    if not m:
        return None
    cabecalho = m.group(1) or ""
    cnpj = (m.group(2) or "").strip().rstrip(",.;")
    lance = RE_CORTE_LANCE.split(m.group(3) or "")[0]

    nome = re.search(r"\bpara\s+(.+?)\s*,\s*$", cabecalho, re.I) or re.search(
        r"\bpara\s+(.+)$", cabecalho, re.I
    )
    licitante = nome.group(1).strip().rstrip(",.;") if nome else None
    unitario, total = ler_rotulados(lance)
    return {
        "licitante": licitante,
        "cnpj": cnpj or None,
        "valor_unitario": unitario,
        "valor_total": total,
        "trecho": RE_CORTE_TRECHO.split(m.group(0))[0].strip(),
    }


def ler_valor_referencia(bloco: str) -> tuple[float | None, float | None]:
    plano = re.sub(r"\s+", " ", bloco)
    m = RE_REFERENCIA.search(plano)
    if not m:
        return None, None
    return ler_rotulados(m.group(1) or "")


def ler_valor_negociado(bloco: str, cnpj: str | None) -> tuple[float | None, float | None]:
    plano = re.sub(r"\s+", " ", bloco)
    candidatos: list[str] = []
    if cnpj:
        idx = plano.rfind(cnpj)
        if idx >= 0:
            candidatos.append(plano[idx : idx + 900])
    if not candidatos and len(re.findall(r"Valor\s+negociado", plano, re.I)) == 1:
        candidatos.append(plano)
    for trecho in candidatos:
        m = RE_NEGOCIADO.search(trecho)
        if not m:
            continue
        bruto = m.group(1) or ""
        if RE_SEM_VALOR.search(bruto.strip()):
            continue
        unitario, total = ler_rotulados(bruto)
        if unitario is not None or total is not None:
            return unitario, total
    return None, None


def ler_situacao(bloco: str) -> str | None:
    plano = re.sub(r"\s+", " ", bloco)
    m = RE_SITUACAO.search(plano)
    if m:
        return m.group(1).strip()
    for padrao in PADROES_SITUACAO:
        m = re.search(padrao, plano, re.I)
        if m:
            return re.sub(r"\s+", " ", m.group(0)).strip()
    return None


def ler_descricao(bloco: str) -> str | None:
    plano = re.sub(r"[ \t]+", " ", bloco)
    m = RE_DESCRICAO.search(plano)
    if not m:
        return None
    texto = re.sub(r"\s+", " ", m.group(1)).strip()
    return texto[:1500] or None


def extrair_itens(texto: str) -> tuple[list[dict[str, Any]], int]:
    blocos = separar_itens(texto)
    com_evidencia = [b for b in blocos if tem_evidencia(b[2])]
    itens: list[dict[str, Any]] = []

    for numero, pagina, conteudo in com_evidencia:
        item = Item(numero_item=numero, pagina=pagina)
        pendencias: list[str] = []

        vencedor = ler_aceito_habilitado(conteudo)
        item.quantidade = numero_br(
            (RE_QUANTIDADE.search(conteudo).group(1) if RE_QUANTIDADE.search(conteudo) else None)
        )
        unidade = RE_UNIDADE.search(conteudo)
        item.unidade = unidade.group(1).strip() if unidade else None
        item.especificacao = ler_descricao(conteudo)
        item.situacao = ler_situacao(conteudo)

        negociado_unit, negociado_total = ler_valor_negociado(
            conteudo, vencedor["cnpj"] if vencedor else None
        )
        item.valor_negociado_unitario = negociado_unit
        item.valor_negociado_total = negociado_total
        ref_unit, ref_total = ler_valor_referencia(conteudo)
        item.valor_referencia_unitario = ref_unit
        item.valor_referencia_total = ref_total

        usa_negociado = negociado_unit is not None or negociado_total is not None
        item.origem_valor = (
            "VALOR_NEGOCIADO" if usa_negociado else ("MELHOR_LANCE" if vencedor else None)
        )
        if usa_negociado:
            pendencias.append(
                "Valor negociado informado no documento prevaleceu sobre o melhor lance."
            )

        unitario = negociado_unit if usa_negociado else (vencedor or {}).get("valor_unitario")
        total = negociado_total if usa_negociado else (vencedor or {}).get("valor_total")

        if unitario is None and item.quantidade and total:
            unitario = round(total / item.quantidade, 4)
            pendencias.append("Valor unitário calculado a partir do valor total ÷ quantidade.")
        if total is None and item.quantidade and unitario:
            total = round(unitario * item.quantidade, 2)
            pendencias.append("Valor total calculado a partir do valor unitário × quantidade.")

        item.valor_unitario = unitario
        item.valor_total = total
        item.licitante = (vencedor or {}).get("licitante")
        item.cnpj = (vencedor or {}).get("cnpj")
        item.trecho_origem = (vencedor or {}).get("trecho") or conteudo[:1200].strip()

        if item.quantidade and unitario and total:
            item.diferenca = round(item.quantidade * unitario - total, 2)
            limite = max(0.05, total * 0.001)
            item.validacao_total = "OK" if abs(item.diferenca) <= limite else "DIVERGENTE"

        if ref_total and total:
            item.percentual_diferenca = round((total - ref_total) / ref_total * 100, 2)
        elif ref_unit and unitario:
            item.percentual_diferenca = round((unitario - ref_unit) / ref_unit * 100, 2)

        if not vencedor:
            pendencias.append("Bloco do licitante aceito/habilitado não interpretado integralmente.")
        if vencedor and not item.licitante:
            pendencias.append("Licitante não localizado no bloco.")
        if vencedor and not (item.cnpj and RE_CNPJ.search(item.cnpj)):
            pendencias.append("CNPJ fora do formato 00.000.000/0000-00.")
        if vencedor and total is None:
            pendencias.append("Valor total não localizado.")
        if not item.especificacao:
            pendencias.append("Especificação não localizada.")
        if not item.quantidade:
            pendencias.append("Quantidade não localizada.")
        if item.percentual_diferenca is None:
            pendencias.append("Valor de referência não localizado no item.")
        if item.validacao_total == "DIVERGENTE":
            pendencias.append("Quantidade × valor unitário difere do valor total.")

        item.status_conferencia = (
            "ERRO_EXTRACAO"
            if not vencedor
            else ("NECESSITA_CONFERENCIA" if pendencias else "EXTRAIDO_VALIDADO")
        )
        item.observacoes = " ".join(pendencias) or None
        itens.append(asdict(item))

    return itens, len(blocos)
