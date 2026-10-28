const zlib = require("zlib");

function readZipEntry(buf, name) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("El archivo no es un DOCX/ZIP válido");
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeader = buf.readUInt32LE(offset + 42);
    const fileName = buf.toString("utf8", offset + 46, offset + 46 + nameLen);
    if (fileName === name) {
      const localNameLen = buf.readUInt16LE(localHeader + 26);
      const localExtraLen = buf.readUInt16LE(localHeader + 28);
      const start = localHeader + 30 + localNameLen + localExtraLen;
      const data = buf.subarray(start, start + compressedSize);
      return method === 0 ? data : zlib.inflateRawSync(data);
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function decodeXml(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function headingLevel(style) {
  if (!/heading|t[ií]tulo|ttulo|title/i.test(style)) return 0;
  return Number((style.match(/\d+/) || ["1"])[0]) || 1;
}

/** Párrafos del DOCX con estilo, nivel de título y si pertenece a una lista. */
function docxParagraphs(buf) {
  const xml = readZipEntry(buf, "word/document.xml");
  if (!xml) return [];
  const source = xml.toString("utf8");
  const out = [];
  for (const match of source.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)) {
    const p = match[0];
    const style = (p.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || "";
    if (/^(toc|tdc)|tdc$|tocheading/i.test(style)) continue;
    const text = decodeXml(
      [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)].map((m) => (m[1] === undefined ? "\t" : m[1])).join("")
    )
      .replace(/\s+/g, " ")
      .replace(/^[•·▪●◦\-–]\s*/, "")
      .trim();
    if (!text) continue;
    out.push({ style, text, heading: headingLevel(style), list: /<w:numPr>/.test(p) });
  }
  return out;
}

module.exports = { docxParagraphs };
