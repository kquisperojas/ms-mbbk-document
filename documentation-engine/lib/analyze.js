const SECTION_PATTERNS = {
  objective: /objetivo|prop[oó]sito|resumen ejecutivo/i,
  outScope: /fuera de(l)? alcance|no incluye|exclusiones|out of scope/i,
  inScope: /alcance|scope/i,
  rules: /reglas? de negocio|consideraciones|criterios|restricciones|validaciones/i,
  risks: /riesgos|supuestos|dependencias/i,
};

const MS_RE = /\b(?:jch|ch|jsc|jbs|bs|sp|sb|jsp)-[a-z0-9]+(?:-[a-z0-9]+)+\b/gi;

/** Agrupa párrafos bajo el título más cercano. */
function sectionize(paragraphs) {
  const sections = [];
  let current = { title: "", level: 0, items: [] };
  for (const p of paragraphs) {
    if (p.heading || (p.text.length < 70 && /^\d+(\.\d+)*\.?\s+\S/.test(p.text) && !p.list)) {
      if (current.title || current.items.length) sections.push(current);
      current = { title: p.text, level: p.heading || 2, items: [] };
    } else {
      current.items.push(p);
    }
  }
  if (current.title || current.items.length) sections.push(current);
  return sections;
}

function findSection(sections, key, exclude) {
  return sections.find((s) => SECTION_PATTERNS[key].test(s.title) && !(exclude && exclude.test(s.title)) && s.items.length);
}

const MS_HEADING_RE = /^(?:\d+(?:\.\d+)*\.?\s+)?([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\.?$/i;
const METHOD_ONLY_RE = /^(GET|POST|PUT|PATCH|DELETE)$/i;
const INLINE_ENDPOINT_RE = /\b(GET|POST|PUT|PATCH|DELETE)\b\s*[:\-–]?\s*((?:https?:\/\/[^\s/]+)?\/[\w\-/{}.?&=]+)/i;
const PATHLIKE_RE = /^(?:https?:\/\/\S+|\/\S+|[\w{}=&?.-]+\/[\w{}=&?./-]*|[&?][\w{}=&?./-]+)$/;
const VERSION_RE = /^v?\.?\d+(\.\d+)*$/i;
const trim220 = (text) => (text.length > 220 ? text.slice(0, 217) + "…" : text);

/** Primer párrafo descriptivo tras la celda `j` (las tablas del DET llegan como un párrafo por celda). */
function describeAfter(paragraphs, j) {
  for (let k = j + 1; k < Math.min(paragraphs.length, j + 5); k++) {
    const t = paragraphs[k].text;
    if (paragraphs[k].heading) break;
    if (METHOD_ONLY_RE.test(t) || VERSION_RE.test(t) || PATHLIKE_RE.test(t) || t.length < 12) continue;
    return trim220(t);
  }
  return "";
}

function isDescriptive(text) {
  return text.length >= 30 && /\s/.test(text) && !PATHLIKE_RE.test(text);
}

/** Descripción de un MS: párrafo descriptivo bajo su título; si no, su primera mención útil. */
function msContext(paragraphs, name) {
  const i = paragraphs.findIndex((p) => p.heading && p.text.toLowerCase().includes(name));
  if (i >= 0) {
    for (let k = i + 1; k < Math.min(paragraphs.length, i + 4) && !paragraphs[k].heading; k++) {
      if (isDescriptive(paragraphs[k].text)) return trim220(paragraphs[k].text);
    }
  }
  const j = paragraphs.findIndex((p) => !p.heading && p.text.toLowerCase().includes(name));
  if (j < 0) return "";
  return PATHLIKE_RE.test(paragraphs[j].text) ? describeAfter(paragraphs, j) : trim220(paragraphs[j].text);
}

function extractEndpoints(paragraphs) {
  const endpoints = [];
  const seen = new Set();
  for (let i = 0; i < paragraphs.length; i++) {
    const t = paragraphs[i].text;
    let method;
    let path;
    let j = i;
    const inline = t.match(INLINE_ENDPOINT_RE);
    if (METHOD_ONLY_RE.test(t) && paragraphs[i + 1] && PATHLIKE_RE.test(paragraphs[i + 1].text)) {
      method = t.toUpperCase();
      path = paragraphs[i + 1].text;
      j = i + 1;
    } else if (inline) {
      method = inline[1].toUpperCase();
      path = inline[2];
    } else if (/^https?:\/\/\S+\/\S+$/.test(t) || /^\/(channel|support|business|api)\//.test(t)) {
      method = "—";
      path = t;
    } else continue;
    while (paragraphs[j + 1] && /^[\w{}=&?./-]+$/.test(paragraphs[j + 1].text) && /[/&?=]/.test(paragraphs[j + 1].text) && !VERSION_RE.test(paragraphs[j + 1].text)) {
      path += paragraphs[j + 1].text;
      j++;
    }
    path = path.replace(/^https?:\/\/[^/]+/, "");
    if (!path.startsWith("/")) path = "/" + path;
    const norm = path.split("?")[0].replace(/\/+$/, "");
    if (seen.has(norm)) continue;
    seen.add(norm);
    endpoints.push({ method, path, description: describeAfter(paragraphs, j) });
    i = j;
  }
  return endpoints;
}

function classifyMs(mentions) {
  if (/\bnuev[oa]s?\b|crear|creaci[oó]n/i.test(mentions)) return "Nuevo";
  if (/modific|extender|extensi[oó]n|ajust|actualiz|desarroll|implement/i.test(mentions)) return "Modificado";
  if (/\bcore\b|as400|trama/i.test(mentions)) return "Core";
  return "Reutilizado";
}

function analyzeDet(paragraphs) {
  const sections = sectionize(paragraphs);
  const allText = paragraphs.map((p) => p.text).join("\n");

  const objectiveSection = findSection(sections, "objective");
  const objective = objectiveSection
    ? objectiveSection.items.slice(0, 2).map((p) => p.text).join(" ")
    : (paragraphs.find((p) => /objetivo/i.test(p.text) && p.text.length > 40) || {}).text || "";

  const outSection = findSection(sections, "outScope");
  const inSection = findSection(sections, "inScope", SECTION_PATTERNS.outScope);
  const rulesSection = findSection(sections, "rules");
  const risksSection = findSection(sections, "risks");
  const list = (section, max = 12) => (section ? section.items.slice(0, max).map((p) => p.text) : []);

  const endpoints = extractEndpoints(paragraphs);

  const names = [
    ...[...allText.matchAll(MS_RE)].map((m) => m[0]),
    ...paragraphs.filter((p) => p.heading).map((p) => (p.text.match(MS_HEADING_RE) || [])[1]).filter(Boolean),
  ].map((n) => n.toLowerCase().replace(/-(cal|dev|qa|uat|prod|stg)$/, ""));
  const microservices = [...new Set(names)].map((name) => {
    const mentions = paragraphs.filter((p) => !p.heading && p.text.toLowerCase().includes(name)).map((p) => p.text).join(" ");
    return { name, tag: classifyMs(mentions), context: msContext(paragraphs, name) };
  });

  return {
    sections,
    objective,
    inScope: list(inSection),
    outScope: list(outSection),
    rules: list(rulesSection),
    risks: list(risksSection, 8),
    endpoints: endpoints.slice(0, 20),
    microservices: microservices.slice(0, 18),
    mentions: {
      session: /hazelcast|sesi[oó]n|session/i.test(allText),
      security: /token|jwt|oauth|cifrad|encrypt|aes/i.test(allText),
      contract: /openapi|swagger|request|response|contrato/i.test(allText),
      errors: /c[oó]digo de error|errores|http 4\d\d|http 5\d\d|mensaje de error/i.test(allText),
    },
  };
}

function emptyAnalysis() {
  return analyzeDet([]);
}

module.exports = { analyzeDet, emptyAnalysis };
