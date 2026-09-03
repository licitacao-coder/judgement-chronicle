import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { TEMPLATE_DOCX_BASE64 } from "./template-docx";

export function base64ParaBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    bin += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(bin);
}

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paraXmlComQuebras(valor: string): string {
  return escaparXml(valor)
    .split(/\r?\n/)
    .join('</w:t><w:br/><w:t xml:space="preserve">');
}

function substituir(xml: string, campos: Record<string, string>): string {
  // Junta placeholders partidos entre runs do Word.
  let saida = xml.replace(
    /\{\{[^}]*?\}\}/g,
    (m) => m.replace(/<[^>]+>/g, ""),
  );
  saida = saida.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_m, chave: string) => {
    const valor = campos[chave];
    return valor ? paraXmlComQuebras(valor) : "";
  });
  return saida;
}

export function preencherTemplate(campos: Record<string, string>): Uint8Array {
  const arquivos = unzipSync(base64ParaBytes(TEMPLATE_DOCX_BASE64));
  for (const nome of Object.keys(arquivos)) {
    if (
      nome === "word/document.xml" ||
      /^word\/(header|footer)\d*\.xml$/.test(nome)
    ) {
      const xml = strFromU8(arquivos[nome]!);
      arquivos[nome] = strToU8(substituir(xml, campos));
    }
  }
  return zipSync(arquivos, { level: 6 });
}

export function listarPlaceholders(): string[] {
  const arquivos = unzipSync(base64ParaBytes(TEMPLATE_DOCX_BASE64));
  const xml = strFromU8(arquivos["word/document.xml"]!);
  return [...new Set([...xml.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]!))];
}
