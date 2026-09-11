"""Serviço Python de leitura de documentos de licitação.

Motor alternativo do aplicativo "Gerador de Relatório de Ocorrência em Sessão
Pública". Roda em servidor próprio do órgão, sem dependência da plataforma do
aplicativo. Somente leitura e extração: nenhuma conclusão de responsabilidade
ou sanção é produzida aqui.

Rotas:
  GET  /situacao        -> versão do serviço e se o OCR está disponível
  POST /itens-aceitos   -> itens "Aceito e Habilitado" do Termo de Julgamento
  POST /texto           -> texto integral do documento (para o relatório)
  POST /analise         -> certame, licitantes, ocorrências e linha do tempo
  POST /redacao         -> relato, providências e repercussão
"""

from __future__ import annotations

import base64
import os
import shutil

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from typing import Any

from analise import analisar, redigir
from extracao import extrair_itens, ler_texto_pdf, ler_texto_ocr

VERSAO = "python-1.1.0"
CHAVE = os.environ.get("CHAVE_SERVICO", "")
TAMANHO_MAXIMO_MB = int(os.environ.get("TAMANHO_MAXIMO_MB", "40"))

app = FastAPI(title="Leitor de documentos de licitação", version=VERSAO)


PASTAS_PROVAVEIS = [
    os.environ.get("TESSERACT_PASTA", ""),
    os.environ.get("POPPLER_PASTA", ""),
    r"C:\Program Files\Tesseract-OCR",
    r"C:\Program Files (x86)\Tesseract-OCR",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR"),
    os.path.expandvars(r"%LOCALAPPDATA%\Tesseract-OCR"),
]


def registrar_programas_externos() -> None:
    """Windows: winget instala Tesseract/Poppler sem colocá-los no PATH da sessão."""
    extras = [p for p in PASTAS_PROVAVEIS if p and os.path.isdir(p)]
    # Poppler é instalado em pastas com versão (…/poppler-25.07.0/Library/bin).
    for raiz in [
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages"),
        r"C:\Program Files",
    ]:
        if not os.path.isdir(raiz):
            continue
        for atual, pastas, _ in os.walk(raiz):
            if os.path.basename(atual).lower() == "bin" and "poppler" in atual.lower():
                extras.append(atual)
            if atual.count(os.sep) - raiz.count(os.sep) > 4:
                pastas[:] = []
    if extras:
        os.environ["PATH"] = os.pathsep.join(extras + [os.environ.get("PATH", "")])


registrar_programas_externos()


def ocr_disponivel() -> bool:
    return shutil.which("tesseract") is not None


def conferir_chave(chave: str | None) -> None:
    if not CHAVE:
        return
    if chave != CHAVE:
        raise HTTPException(status_code=401, detail="Chave de acesso inválida.")


class PedidoDocumento(BaseModel):
    nome_documento: str | None = None
    extensao: str | None = None
    texto: str | None = None
    arquivo_base64: str | None = Field(default=None, repr=False)


def obter_texto(pedido: PedidoDocumento) -> tuple[str, bool]:
    """Devolve o texto do documento e se houve uso de OCR."""
    if pedido.arquivo_base64:
        try:
            conteudo = base64.b64decode(pedido.arquivo_base64)
        except Exception as erro:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="Arquivo inválido.") from erro
        if len(conteudo) > TAMANHO_MAXIMO_MB * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail=f"Arquivo acima do limite de {TAMANHO_MAXIMO_MB} MB.",
            )
        extensao = (pedido.extensao or "").lower()
        if extensao in ("pdf", ""):
            texto, usou_ocr = ler_texto_pdf(conteudo)
            if len(texto.replace(" ", "").strip()) >= 200:
                return texto, usou_ocr
        elif extensao in ("txt", "text"):
            return conteudo.decode("utf-8", errors="ignore"), False

    if pedido.texto and len(pedido.texto.replace(" ", "").strip()) >= 200:
        return pedido.texto, False

    if pedido.arquivo_base64 and ocr_disponivel():
        return ler_texto_ocr(base64.b64decode(pedido.arquivo_base64)), True

    raise HTTPException(
        status_code=422,
        detail="Não foi possível obter texto do documento enviado.",
    )


@app.get("/situacao")
def situacao(x_chave_servico: str | None = Header(default=None)) -> dict[str, object]:
    conferir_chave(x_chave_servico)
    return {"servico": "leitor-licitacao", "versao": VERSAO, "ocr": ocr_disponivel()}


@app.post("/itens-aceitos")
def itens_aceitos(
    pedido: PedidoDocumento,
    x_chave_servico: str | None = Header(default=None),
) -> dict[str, object]:
    conferir_chave(x_chave_servico)
    texto, usou_ocr = obter_texto(pedido)
    itens, total_blocos = extrair_itens(texto)
    return {
        "versao": VERSAO,
        "ocr_utilizado": usou_ocr,
        "total_blocos": total_blocos,
        "itens": itens,
    }


@app.post("/texto")
def texto_documento(
    pedido: PedidoDocumento,
    x_chave_servico: str | None = Header(default=None),
) -> dict[str, object]:
    conferir_chave(x_chave_servico)
    texto, usou_ocr = obter_texto(pedido)
    return {"versao": VERSAO, "ocr_utilizado": usou_ocr, "texto": texto}


@app.post("/analise")
def analise_documento(
    pedido: PedidoDocumento,
    x_chave_servico: str | None = Header(default=None),
) -> dict[str, Any]:
    """Certame, licitantes, ocorrências, linha do tempo e enquadramento preliminar."""
    conferir_chave(x_chave_servico)
    texto, usou_ocr = obter_texto(pedido)
    resultado = analisar(texto)
    return {"versao": VERSAO, "ocr_utilizado": usou_ocr, **resultado}


class PedidoRedacao(BaseModel):
    certame: str | None = None
    objeto: str | None = None
    licitante: str | None = None
    cnpj: str | None = None
    tipo_ocorrencia: str | None = None
    resumo: str | None = None
    manifestacao: str | None = None
    eventos: list[dict[str, Any]] = Field(default_factory=list)


@app.post("/redacao")
def redacao(
    pedido: PedidoRedacao,
    x_chave_servico: str | None = Header(default=None),
) -> dict[str, Any]:
    conferir_chave(x_chave_servico)
    if len(pedido.eventos) > 200:
        raise HTTPException(status_code=413, detail="Quantidade de eventos acima do limite.")
    texto = redigir(pedido.model_dump())
    return {"versao": VERSAO, **texto}
