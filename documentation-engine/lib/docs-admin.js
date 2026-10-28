const fs = require("fs");
const path = require("path");
const { config } = require("./env");
const { buildReport } = require("./report");

const SECTION_IDS = ["iniciativa", "solucion", "diagramas", "pruebas"];
const DOC_FOLDER_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

function assertKey(key) {
  if (!DOC_FOLDER_RE.test(key || "")) {
    const err = new Error("Clave de iniciativa inválida.");
    err.status = 400;
    throw err;
  }
  return key;
}

function docRoot(key) {
  return path.join(config.DOCS_ROOT, assertKey(key));
}

function reportPath(key) {
  return path.join(docRoot(key), `informe-${key}.html`);
}

function modelPath(key) {
  return path.join(docRoot(key), "model.json");
}

function extractSection(html, id) {
  const re = new RegExp(`<section\\s+[^>]*id="${id}"[^>]*>[\\s\\S]*?<\\/section>`, "i");
  const match = String(html || "").match(re);
  return match ? match[0] : "";
}

function extractSectionsHtml(html) {
  const sections = {};
  for (const id of SECTION_IDS) sections[id] = extractSection(html, id);
  return sections;
}

function replaceSection(html, id, sectionHtml) {
  const re = new RegExp(`<section\\s+[^>]*id="${id}"[^>]*>[\\s\\S]*?<\\/section>`, "i");
  let next = String(sectionHtml || "").trim();
  if (!next) return html;
  if (!new RegExp(`<section\\s+[^>]*id="${id}"`, "i").test(next)) {
    const cls = id === "iniciativa" ? ' class="panel active"' : ' class="panel"';
    next = `<section id="${id}"${cls}>\n${next}\n    </section>`;
  }
  if (!re.test(html)) {
    const err = new Error(`El informe no tiene la sección ${id}.`);
    err.status = 400;
    throw err;
  }
  return html.replace(re, next);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return null;
  }
}

function isStructured(model) {
  return Boolean(model && model.structured !== false && model.analysis && typeof model.analysis === "object");
}

function loadDocument(key) {
  assertKey(key);
  const report = reportPath(key);
  if (!fs.existsSync(report)) {
    const err = new Error(`No hay informe para ${key}.`);
    err.status = 404;
    throw err;
  }
  const html = fs.readFileSync(report, "utf8");
  const model = readJson(modelPath(key));
  const structured = isStructured(model);
  const head = html.slice(0, 4000);
  const title = ((head.match(/<title>([^<]*)<\/title>/) || [])[1] || key).replace(/\s*\|\s*Documentación\s*$/, "");
  return {
    key,
    structured,
    title: (model && model.title) || title.replace(new RegExp(`^${key}\\s*—\\s*`), ""),
    subtitle: (model && model.subtitle) || "",
    updated: fs.statSync(report).mtime.toISOString(),
    url: `/docs/${key}/informe-${key}.html`,
    model: structured ? model : null,
    sectionsHtml: extractSectionsHtml(html),
  };
}

function backupReport(key) {
  const report = reportPath(key);
  if (!fs.existsSync(report)) return null;
  const dest = path.join(docRoot(key), `informe-${key}.backup-${stamp()}.html`);
  fs.copyFileSync(report, dest);
  return dest;
}

function writeModel(key, model) {
  const payload = { ...model, key, structured: true, savedAt: new Date().toISOString() };
  fs.writeFileSync(modelPath(key), JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

function saveFromModel(key, incoming) {
  const existing = readJson(modelPath(key)) || { key, analysis: {} };
  const merged = {
    ...existing,
    ...incoming,
    key,
    analysis: { ...(existing.analysis || {}), ...((incoming && incoming.analysis) || {}) },
    jira: incoming.jira !== undefined ? incoming.jira : existing.jira,
    generatedAt: incoming.generatedAt || existing.generatedAt || new Date().toLocaleString("es-PE"),
  };
  if (!merged.analysis.mentions) {
    merged.analysis.mentions = existing.analysis?.mentions || {
      session: false,
      security: false,
      contract: false,
      errors: false,
    };
  }
  merged.analysis.inScope = Array.isArray(merged.analysis.inScope) ? merged.analysis.inScope : [];
  merged.analysis.outScope = Array.isArray(merged.analysis.outScope) ? merged.analysis.outScope : [];
  merged.analysis.rules = Array.isArray(merged.analysis.rules) ? merged.analysis.rules : [];
  merged.analysis.risks = Array.isArray(merged.analysis.risks) ? merged.analysis.risks : [];
  merged.analysis.endpoints = Array.isArray(merged.analysis.endpoints) ? merged.analysis.endpoints : [];
  merged.analysis.microservices = Array.isArray(merged.analysis.microservices) ? merged.analysis.microservices : [];
  merged.diagrams = Array.isArray(merged.diagrams) ? merged.diagrams : [];
  merged.pendingDiagrams = Array.isArray(merged.pendingDiagrams) ? merged.pendingDiagrams : [];
  merged.attachments = Array.isArray(merged.attachments) ? merged.attachments : [];
  merged.detSections = Array.isArray(merged.detSections) ? merged.detSections : [];
  merged.cases = merged.cases && merged.cases.length ? merged.cases : null;
  merged.jiraUrl = merged.jiraUrl || (merged.jira && merged.jira.url) || "";
  if (merged.jira) {
    merged.jira.children = Array.isArray(merged.jira.children) ? merged.jira.children : [];
    merged.jira.components = Array.isArray(merged.jira.components) ? merged.jira.components : [];
    merged.jira.labels = Array.isArray(merged.jira.labels) ? merged.jira.labels : [];
  }
  const backup = backupReport(key);
  writeModel(key, merged);
  fs.writeFileSync(reportPath(key), buildReport(merged), "utf8");
  return { key, backup, mode: "model", url: `/docs/${key}/informe-${key}.html` };
}

function saveFromHtml(key, sectionsHtml) {
  const report = reportPath(key);
  let html = fs.readFileSync(report, "utf8");
  const backup = backupReport(key);
  for (const id of SECTION_IDS) {
    if (sectionsHtml && sectionsHtml[id]) html = replaceSection(html, id, sectionsHtml[id]);
  }
  fs.writeFileSync(report, html, "utf8");
  const existing = readJson(modelPath(key)) || { key };
  existing.structured = false;
  existing.savedAt = new Date().toISOString();
  fs.writeFileSync(modelPath(key), JSON.stringify(existing, null, 2), "utf8");
  return { key, backup, mode: "html", url: `/docs/${key}/informe-${key}.html` };
}

function saveDocument(key, body) {
  assertKey(key);
  if (!fs.existsSync(reportPath(key))) {
    const err = new Error(`No hay informe para ${key}.`);
    err.status = 404;
    throw err;
  }
  if (body && body.mode === "html") return saveFromHtml(key, body.sectionsHtml || {});
  if (body && body.model) return saveFromModel(key, body.model);
  const err = new Error("Envía model o sectionsHtml.");
  err.status = 400;
  throw err;
}

function deleteDocument(key) {
  assertKey(key);
  const root = docRoot(key);
  const report = reportPath(key);
  if (!fs.existsSync(report)) {
    const err = new Error(`No hay informe para ${key}.`);
    err.status = 404;
    throw err;
  }
  const trash = path.join(config.DOCS_ROOT, "_papelera", `${key}-${stamp()}`);
  fs.mkdirSync(path.dirname(trash), { recursive: true });
  fs.cpSync(root, trash, { recursive: true });
  fs.rmSync(root, { recursive: true, force: true });
  return { key, trash };
}

module.exports = {
  SECTION_IDS,
  loadDocument,
  saveDocument,
  deleteDocument,
  writeModel,
};
