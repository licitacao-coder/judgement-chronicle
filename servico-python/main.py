"""Serviço Python de leitura de documentos de licitação.

Motor alternativo do aplicativo "Gerador de Relatório de Ocorrência em Sessão
Pública". Roda em servidor próprio do órgão, sem dependência da plataforma do
aplicativo. Somente leitura e extração: nenhuma conclusão de responsabilidade
ou sanção é produzida aqui.

Rotas:
  GET  /situacao        -> versão do serviço e se o OCR está disponível
  POST /itens-aceitos   -> itens "Aceito e Habilitado" do Termo de Julgamento
  POST /texto           -> texto integral do documento (para o relatório)
"""

from __future__ import annotations

import base64
import os
import shutil

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from extracao import extrair_itens, ler_texto_pdf, ler_texto_ocr

VERSAO = "python-1.0.0"
CHAVE = os.environ.get("CHAVE_SERVICO", "")
TAMANHO_MAXIMO_MB = int(os.environ.get("TAMANHO_MAXIMO_MB", "40"))

app = FastAPI(title="Leitor de documentos de licitação", version=VERSAO)


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
