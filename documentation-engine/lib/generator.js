const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { execFile } = require("child_process");
const { config } = require("./env");
const { getInitiative, isJiraPopulated } = require("./jira");
const { docxParagraphs } = require("./docx");
const { analyzeDet, emptyAnalysis } = require("./analyze");
const { imageViewerHtml } = require("./diagram-viewer");
const { buildArchifyCandidate } = require("./archify-from-image");
const { buildReport, primaryMs } = require("./report");
const { writeModel, saveDocument } = require("./docs-admin");
const { syncReviewRecord, clearDraft } = require("./doc-status");

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const GROUP_LABELS = {
  det: "Documento técnico",
  sequence: "Diagrama de secuencia (fuente)",
  architecture: "Arquitectura (fuente)",
  tests: "Casos de prueba",
  other: "Adjunto",
};

const slug = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "diagrama";

const safeName = (name) => path.basename(String(name)).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
const artefactHref = (name) => "artefactos/" + encodeURIComponent(name);
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

function runArchify(type, input, output, quality, cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [config.ARCHIFY_BIN, "render", type, input, output, "--quality", quality],
      { cwd, timeout: 180000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => (err ? reject(new Error((stderr || stdout || err.message).slice(0, 600))) : resolve())
    );
  });
}

/** Sin el repositorio a mano, Archify no puede verificar `sources`; se retiran para renderizar. */
function withoutSourceEvidence(candidate, outputRelative) {
  const strip = (value) => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "sources").map(([k, v]) => [k, strip(v)]));
  };
  const out = strip(candidate);
  out.meta = { ...(out.meta || {}), output: outputRelative };
  delete out.meta.repository;
  return out;
}

function parseCsv(text) {
  const delimiter = (text.split(/\r?\n/)[0].match(/;/g) || []).length > (text.split(/\r?\n/)[0].match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

function normalizeResult(value) {
  const v = String(value || "").trim().toLowerCase();
  if (/^no|falla|fail|rechaz/.test(v)) return "No cumple";
  if (/parcial|partial/.test(v)) return "Parcial";
  if (/cumple|ok|pass|exitos|aprob/.test(v)) return "Cumple";
  return "Pendiente";
}

function decodeXml(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function unzipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("El Excel no es un .xlsx válido.");
  const entries = {};
  let p = buf.readUInt32LE(eocd + 16);
  while (p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50) {
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString("utf8").replace(/\\/g, "/");
    const localNameLen = buf.readUInt16LE(localOff + 26);
    const localExtra = buf.readUInt16LE(localOff + 28);
    const compressed = buf.slice(localOff + 30 + localNameLen + localExtra, localOff + 30 + localNameLen + localExtra + compSize);
    let data = compressed;
    if (method === 8) data = zlib.inflateRawSync(compressed);
    else if (method !== 0) {
      p += 46 + nameLen + extraLen + commentLen;
      continue;
    }
    entries[name] = data.toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[\s\S]*?<\/si>/gi)].map((m) =>
    decodeXml([...m[0].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((t) => t[1]).join(""))
  );
}

function colIndex(ref) {
  const letters = String(ref || "").match(/^[A-Z]+/i);
  if (!letters) return 0;
  let n = 0;
  for (const ch of letters[0].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function xlsxToRows(buffer) {
  const entries = unzipEntries(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  const shared = parseSharedStrings(entries["xl/sharedStrings.xml"] || "");
  const sheetKey = Object.keys(entries).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k));
  if (!sheetKey) throw new Error("El Excel no tiene una hoja de datos.");
  const rows = [];
  for (const rowXml of entries[sheetKey].matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const cells = [];
    for (const cell of rowXml[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const attrs = cell[1];
      const body = cell[2];
      const ref = ((attrs.match(/\br="([^"]+)"/) || [])[1] || "");
      const type = ((attrs.match(/\bt="([^"]+)"/) || [])[1] || "").toLowerCase();
      let value = "";
      if (type === "s") {
        const idx = Number((body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i) || [])[1] || "");
        value = shared[idx] || "";
      } else if (type === "inlineStr") {
        value = decodeXml([...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((t) => t[1]).join(""));
      } else {
        value = decodeXml((body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i) || [])[1] || "");
      }
      cells[colIndex(ref)] = value;
    }
    if (cells.some((v) => String(v || "").trim())) rows.push(cells.map((v) => String(v || "")));
  }
  return rows;
}

function headerIndex(header, names, used) {
  return header.findIndex((h, i) => !used.has(i) && names.some((n) => h.includes(n)));
}

function parseCasesFromRows(rows) {
  if (!rows || rows.length < 2) return [];
  const header = rows[0].map((h) => String(h || "").trim().toLowerCase());
  const used = new Set();
  const pick = (...names) => {
    const i = headerIndex(header, names, used);
    if (i >= 0) used.add(i);
    return i;
  };
  const idx = {
    id: pick("id", "código", "codigo", "nro caso", "nro", "caso de prueba"),
    title: pick(
      "escenario",
      "descrip",
      "título",
      "titulo",
      "detalle",
      "nombre del caso",
      "caso de prueba",
      "caso",
      "title"
    ),
    result: pick("resultado", "estado", "result", "status"),
    evidence: pick("evidencia", "observ", "comentario", "motivo", "por qué", "porque", "evidence"),
  };
  return rows
    .slice(1)
    .map((r, i) => {
      const id = (idx.id >= 0 && String(r[idx.id] || "").trim()) || `CP-${String(i + 1).padStart(3, "0")}`;
      let title = String((idx.title >= 0 ? r[idx.title] : "") || "").trim();
      if (!title || title === id) {
        const fallback = (r || []).find((cell, col) => {
          const v = String(cell || "").trim();
          return col !== idx.id && v && v !== id && v.length > String(id).length;
        });
        title = String(fallback || title || id).trim();
      }
      return {
        id,
        title,
        result: normalizeResult(idx.result >= 0 ? r[idx.result] : ""),
        evidence: String((idx.evidence >= 0 ? r[idx.evidence] : "") || "").trim(),
      };
    })
    .filter((c) => c.title);
}

function parseCases(text) {
  return parseCasesFromRows(parseCsv(text.replace(/^\uFEFF/, "")));
}

function parseCasesFromSaved(saved) {
  const cases = [];
  const warnings = [];
  for (const file of saved) {
    try {
      if (file.ext === ".csv" || file.ext === ".txt") {
        cases.push(...parseCases(file.buffer.toString("utf8")));
      } else if (file.ext === ".xlsx") {
        cases.push(...parseCasesFromRows(xlsxToRows(file.buffer)));
      } else {
        warnings.push(`${file.name}: usa .xlsx o .csv para poblar Pruebas; quedó en artefactos.`);
      }
    } catch (e) {
      warnings.push(`${file.name}: ${e.message}`);
    }
  }
  return { cases, warnings };
}

function stepsFromSequence(candidate) {
  const names = Object.fromEntries((candidate.participants || []).map((p) => [p.id, p.label || p.id]));
  return (candidate.messages || [])
    .filter((msg) => msg.variant !== "return")
    .map((msg) => `${names[msg.to] || msg.to}: ${msg.label}${msg.note ? ` (${msg.note})` : ""}`);
}

async function saveFiles(files, dir) {
  const saved = [];
  for (const file of files) {
    if (!file || !file.size) continue;
    let name = safeName(file.name);
    if (fs.existsSync(path.join(dir, name))) {
      const ext = path.extname(name);
      name = `${path.basename(name, ext)}-${stamp()}${ext}`;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(dir, name), buffer);
    saved.push({ name, buffer, ext: path.extname(name).toLowerCase() });
  }
  return saved;
}

async function publishArchify(candidate, kind, folder, htmlName, base, sourceName, warnings) {
  const type = candidate.diagram_type || (kind === "Secuencia" ? "sequence" : "architecture");
  const workDir = path.join(folder.root, ".archify", `${type}-${base}-${stamp()}`);
  fs.mkdirSync(workDir, { recursive: true });
  const input = path.join(workDir, "candidate.json");
  const output = path.join(folder.diagrams, htmlName);
  const prepared = withoutSourceEvidence(candidate, `diagrams/${htmlName}`);
  fs.writeFileSync(input, JSON.stringify(prepared, null, 2));
  await runArchify(type, input, output, prepared.meta?.quality_profile || "standard", folder.root);
  return {
    id: `${kind === "Secuencia" ? "secuencia" : "arquitectura"}-${base}`,
    kind,
    label: prepared.meta?.title || sourceName,
    src: `diagrams/${htmlName}`,
    description: `Diagrama Archify interactivo generado desde ${sourceName}.`,
    steps: type === "sequence" ? stepsFromSequence(prepared) : [],
    archify: true,
  };
}

async function buildDiagram(saved, kind, folder, warnings, options = {}) {
  const base = slug(path.basename(saved.name, saved.ext));
  const prefix = kind === "Secuencia" ? "secuencia" : "arquitectura";
  const label = path.basename(saved.name, saved.ext).replace(/[_-]+/g, " ").trim();
  const htmlName = `${prefix}-${base}.html`;

  if (saved.ext === ".json") {
    if (!options.useArchify) {
      warnings.push(`${saved.name}: candidate.json no se renderizó porque no se pidió Archify. Quedó en artefactos.`);
      return null;
    }
    let candidate;
    try {
      candidate = JSON.parse(saved.buffer.toString("utf8"));
    } catch (e) {
      warnings.push(`${saved.name}: JSON inválido (${e.message}).`);
      return null;
    }
    try {
      return await publishArchify(candidate, kind, folder, htmlName, base, saved.name, warnings);
    } catch (e) {
      warnings.push(`${saved.name}: Archify no pudo renderizar (${e.message.split("\n")[0]}).`);
      return null;
    }
  }

  if (IMAGE_EXT.has(saved.ext)) {
    if (options.useArchify) {
      const built = buildArchifyCandidate(saved, kind, options.analysis, `diagrams/${htmlName}`);
      if (built && built.candidate) {
        try {
          const published = await publishArchify(built.candidate, kind, folder, htmlName, base, saved.name, warnings);
          published.description =
            built.source === "drawio"
              ? `Diagrama Archify reconstruido desde el modelo embebido en ${saved.name}.`
              : `Diagrama Archify generado a partir de ${saved.name} y el DET de la iniciativa.`;
          return published;
        } catch (e) {
          warnings.push(`${saved.name}: Archify no pudo renderizar el diagrama generado (${e.message.split("\n")[0]}).`);
        }
      } else {
        warnings.push(`${saved.name}: no se pudo reconstruir un candidato Archify desde la imagen.`);
      }
    }
    if (options.useArchify) {
      warnings.push(`${saved.name}: se pidió Archify pero no se publicó visor de imagen.`);
      return null;
    }
    fs.writeFileSync(
      path.join(folder.diagrams, htmlName),
      imageViewerHtml({
        title: label,
        subtitle: `Fuente: artefactos/${saved.name}`,
        imageSrc: "../" + artefactHref(saved.name),
        kind,
      })
    );
    return {
      id: `${prefix}-${base}`,
      kind,
      label,
      src: `diagrams/${htmlName}`,
      description: `${kind} entregado como imagen (${saved.name}).`,
      steps: [],
    };
  }

  warnings.push(`${saved.name}: formato no visualizable; quedó como artefacto.`);
  return null;
}

function writeReadme(folder, key, model) {
  const lines = [
    `# ${key} — Documentación`,
    "",
    `Portal: \`${path.join(folder.root, `informe-${key}.html`)}\``,
    `Diagramas: \`${folder.diagrams}\``,
    `Artefactos: \`${folder.artefactos}\``,
    "",
    `Épica Jira: ${model.jiraUrl}`,
    model.figmaUrl ? `Figma: ${model.figmaUrl}` : "Figma: pendiente",
    "",
    `Generado por MBBK-HUB el ${model.generatedAt}.`,
    "",
  ];
  fs.writeFileSync(path.join(folder.root, "README.md"), lines.join("\n"), "utf8");
}

/**
 * Crea o actualiza DOCUMENTACION/<KEY>/informe-<KEY>.html con los insumos del formulario.
 * Si ya existe un informe, se respalda antes de sobrescribirlo.
 */
async function contrastCasesWithBranch(cases, featureBranchUrl, analysis) {
  const { loadBranchCorpus } = require("./github-code");
  const { validateCases } = require("./validate-cases");
  const corpus = await loadBranchCorpus(featureBranchUrl);
  const validated = validateCases(cases, corpus, analysis);
  return {
    cases: validated.cases,
    summary: validated.summary,
    featureBranchUrl: corpus.url,
    featureBranch: `${corpus.owner}/${corpus.repo}@${corpus.ref}`,
  };
}

async function generateDocumentation({ key, figmaUrl, featureBranch, det, sequences, architectures, tests, others }) {
  if (!det || !det.length) {
    const err = new Error("Adjunta el documento técnico (DET).");
    err.status = 400;
    throw err;
  }
  const root = path.join(config.DOCS_ROOT, key);
  const folder = { root, diagrams: path.join(root, "diagrams"), artefactos: path.join(root, "artefactos") };
  fs.mkdirSync(folder.diagrams, { recursive: true });
  fs.mkdirSync(folder.artefactos, { recursive: true });

  const warnings = [];
  const reportPath = path.join(root, `informe-${key}.html`);
  let backup = null;
  if (fs.existsSync(reportPath)) {
    backup = path.join(root, `informe-${key}.backup-${stamp()}.html`);
    fs.copyFileSync(reportPath, backup);
  }

  let jira = null;
  try {
    jira = await getInitiative(key);
  } catch (e) {
    warnings.push(`Jira: ${e.message}`);
  }

  const attachments = [];
  const track = (items, group) => items.forEach((s) => attachments.push({ name: s.name, href: artefactHref(s.name), group, groupLabel: GROUP_LABELS[group] }));

  const detSaved = await saveFiles(det, folder.artefactos);
  const seqSaved = await saveFiles(sequences, folder.artefactos);
  const archSaved = await saveFiles(architectures, folder.artefactos);
  const testSaved = await saveFiles(tests, folder.artefactos);
  const otherSaved = await saveFiles(others, folder.artefactos);
  track(detSaved, "det");
  track(archSaved, "architecture");
  track(seqSaved, "sequence");
  track(testSaved, "tests");
  track(otherSaved, "other");

  let analysis = emptyAnalysis();
  let detSections = [];
  const detDoc = detSaved.find((d) => d.ext === ".docx");
  if (detDoc) {
    try {
      analysis = analyzeDet(docxParagraphs(detDoc.buffer));
      detSections = analysis.sections;
    } catch (e) {
      warnings.push(`DET: no se pudo leer el DOCX (${e.message}).`);
    }
  } else if (detSaved.length) {
    warnings.push("DET: solo se analiza contenido de archivos .docx; el archivo quedó enlazado en artefactos.");
  }

  const diagrams = [];
  for (const s of archSaved) {
    const d = await buildDiagram(s, "Arquitectura", folder, warnings, { useArchify: true, analysis });
    if (d) diagrams.push(d);
  }
  for (const s of seqSaved) {
    const d = await buildDiagram(s, "Secuencia", folder, warnings, { useArchify: true, analysis });
    if (d) diagrams.push(d);
  }
  const pendingDiagrams = [];
  if (!diagrams.some((d) => d.kind === "Arquitectura")) pendingDiagrams.push("Arquitectura de microservicios (Logical/Physical To-Be)");
  if (!diagrams.some((d) => d.kind === "Secuencia")) pendingDiagrams.push("Diagramas de secuencia por flujo");

  let cases = null;
  const parsedTests = parseCasesFromSaved(testSaved);
  warnings.push(...parsedTests.warnings);
  if (parsedTests.cases.length) cases = parsedTests.cases;
  else if (testSaved.length) warnings.push("Casos de prueba: usa Excel (.xlsx) o CSV para poblar la sección Pruebas; el archivo quedó en artefactos.");

  const branch = String(featureBranch || "").trim();
  const branchMeta = {};
  if (cases && branch) {
    try {
      const contrasted = await contrastCasesWithBranch(cases, branch, analysis);
      cases = contrasted.cases;
      branchMeta.featureBranchUrl = contrasted.featureBranchUrl;
      branchMeta.featureBranch = contrasted.featureBranch;
      branchMeta.testsValidation = contrasted.summary;
      branchMeta.testsValidatedAt = new Date().toLocaleString("es-PE");
    } catch (e) {
      warnings.push(`Rama feature: no se pudo contrastar los casos de prueba (${e.message}).`);
      branchMeta.featureBranchUrl = branch;
    }
  } else if (branch) {
    branchMeta.featureBranchUrl = branch;
  } else if (cases) {
    warnings.push("Casos de prueba: se cargaron sin contrastar con código. Indica la Rama Feature para validarlos.");
  }

  const title = jira?.summary || key;
  const model = {
    key,
    title,
    subtitle: primaryMs(analysis)?.name || jira?.issueType || "Iniciativa",
    jira: isJiraPopulated(jira) ? jira : null,
    jiraUrl: jira?.url || `${config.JIRA_BASE_URL}/browse/${key}`,
    figmaUrl: figmaUrl || "",
    analysis,
    detName: detSaved[0]?.name || "",
    detSections,
    attachments,
    diagrams,
    pendingDiagrams,
    cases,
    generatedAt: new Date().toLocaleString("es-PE"),
    ...branchMeta,
  };

  writeModel(key, model);
  fs.writeFileSync(reportPath, buildReport(model), "utf8");
  if (figmaUrl) fs.writeFileSync(path.join(folder.artefactos, "figma.url.txt"), figmaUrl + "\n", "utf8");
  writeReadme(folder, key, model);
  const review = syncReviewRecord(key);
  clearDraft(key);

  const fileUrl = "file:///" + reportPath.replace(/\\/g, "/") + "#iniciativa";
  return {
    key,
    reportPath,
    fileUrl,
    httpUrl: `/docs/${key}/informe-${key}.html#iniciativa`,
    backup,
    warnings,
    status: review.status,
    statusLabel: review.statusLabel,
    missing: review.missing,
    summary: {
      jira: Boolean(jira),
      endpoints: analysis.endpoints.length,
      microservices: analysis.microservices.length,
      diagrams: diagrams.length,
      cases: cases ? cases.length : 0,
    },
  };
}

async function updateTestsDocumentation(key, tests, featureBranchUrl) {
  const root = path.join(config.DOCS_ROOT, key);
  const reportFile = path.join(root, `informe-${key}.html`);
  if (!fs.existsSync(reportFile)) {
    const err = new Error(`No hay informe para ${key}. Genera la documentación primero.`);
    err.status = 404;
    throw err;
  }
  if (!tests || !tests.length) {
    const err = new Error("Adjunta el Excel o CSV de casos de prueba.");
    err.status = 400;
    throw err;
  }
  const branch = String(featureBranchUrl || "").trim();
  if (!branch) {
    const err = new Error("Indica el link de la rama feature de la solución.");
    err.status = 400;
    throw err;
  }
  const artefactos = path.join(root, "artefactos");
  fs.mkdirSync(artefactos, { recursive: true });
  const testSaved = await saveFiles(tests, artefactos);
  const parsed = parseCasesFromSaved(testSaved);
  if (!parsed.cases.length) {
    const err = new Error(
      parsed.warnings.join(" ") ||
        "No se leyeron casos. Usa Excel (.xlsx) o CSV con columnas id/caso de prueba, escenario y resultado."
    );
    err.status = 400;
    throw err;
  }
  const modelFile = path.join(root, "model.json");
  const model = fs.existsSync(modelFile) ? JSON.parse(fs.readFileSync(modelFile, "utf8")) : { key, analysis: {} };
  const contrasted = await contrastCasesWithBranch(parsed.cases, branch, model.analysis);
  const attachments = Array.isArray(model.attachments) ? model.attachments.slice() : [];
  testSaved.forEach((s) =>
    attachments.push({ name: s.name, href: artefactHref(s.name), group: "tests", groupLabel: GROUP_LABELS.tests })
  );
  const now = new Date().toLocaleString("es-PE");
  const saved = saveDocument(key, {
    mode: "model",
    model: {
      ...model,
      attachments,
      cases: contrasted.cases,
      featureBranchUrl: contrasted.featureBranchUrl,
      featureBranch: contrasted.featureBranch,
      testsUpdatedAt: now,
      testsValidatedAt: now,
      testsValidation: contrasted.summary,
    },
  });
  const review = syncReviewRecord(key);
  return {
    key,
    cases: contrasted.cases.length,
    summary: contrasted.summary,
    warnings: parsed.warnings,
    backup: saved.backup,
    url: `/docs/${key}/informe-${key}.html#pruebas`,
    httpUrl: `/docs/${key}/informe-${key}.html#pruebas`,
    status: review.status,
    statusLabel: review.statusLabel,
    missing: review.missing,
  };
}

function extractJiraKey(link) {
  const text = String(link || "");
  const selected = text.match(/[?&]selectedIssue=([A-Z][A-Z0-9_]+-\d+)/i);
  if (selected) return selected[1].toUpperCase();
  const browse = text.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/i);
  if (browse) return browse[1].toUpperCase();
  const any = text.match(/\b([A-Z][A-Z0-9_]+-\d+)\b/i);
  return any ? any[1].toUpperCase() : null;
}

function requireExisting(key) {
  const root = path.join(config.DOCS_ROOT, key);
  const reportFile = path.join(root, `informe-${key}.html`);
  if (!fs.existsSync(reportFile)) {
    const err = new Error(`No hay informe para ${key}. Genera la documentación primero.`);
    err.status = 404;
    throw err;
  }
  const modelFile = path.join(root, "model.json");
  const model = fs.existsSync(modelFile) ? JSON.parse(fs.readFileSync(modelFile, "utf8")) : { key, analysis: emptyAnalysis() };
  return {
    root,
    diagrams: path.join(root, "diagrams"),
    artefactos: path.join(root, "artefactos"),
    modelFile,
    model,
  };
}

function mergeAttachments(existing, group, saved) {
  const rest = (existing || []).filter((item) => item.group !== group);
  const next = saved.map((file) => ({
    name: file.name,
    href: artefactHref(file.name),
    group,
    groupLabel: GROUP_LABELS[group],
  }));
  return [...rest, ...next];
}

async function updateIniciativaDocumentation(key, det, jiraLink) {
  const ctx = requireExisting(key);
  if (!det || !det.length) {
    const err = new Error("Adjunta el documento técnico (DET).");
    err.status = 400;
    throw err;
  }
  const link = String(jiraLink || "").trim() || ctx.model.jiraUrl || "";
  const extracted = extractJiraKey(link);
  if (extracted && extracted !== String(key).toUpperCase()) {
    const err = new Error(`El link de la épica debe ser de ${key}.`);
    err.status = 400;
    throw err;
  }
  fs.mkdirSync(ctx.artefactos, { recursive: true });
  const detSaved = await saveFiles(det, ctx.artefactos);
  const warnings = [];
  let analysis = ctx.model.analysis || emptyAnalysis();
  let detSections = ctx.model.detSections || [];
  let detName = ctx.model.detName || "";
  const detDoc = detSaved.find((file) => file.ext === ".docx");
  if (detDoc) {
    try {
      analysis = analyzeDet(docxParagraphs(detDoc.buffer));
      detSections = analysis.sections;
      detName = detSaved[0].name;
    } catch (e) {
      warnings.push(`DET: no se pudo leer el DOCX (${e.message}).`);
    }
  } else if (detSaved.length) {
    detName = detSaved[0].name;
    warnings.push("DET: solo se analiza contenido de archivos .docx; el archivo quedó enlazado en artefactos.");
  }
  let jira = isJiraPopulated(ctx.model.jira) ? ctx.model.jira : null;
  if (link) {
    try {
      jira = await getInitiative(key);
    } catch (e) {
      warnings.push(`Jira: ${e.message}`);
    }
  }
  const saved = saveDocument(key, {
    mode: "model",
    model: {
      ...ctx.model,
      analysis,
      detSections,
      detName,
      jira: isJiraPopulated(jira) ? jira : null,
      jiraUrl: (jira && jira.url) || link || ctx.model.jiraUrl,
      title: (jira && jira.summary) || ctx.model.title,
      subtitle: primaryMs(analysis)?.name || ctx.model.subtitle,
      attachments: mergeAttachments(ctx.model.attachments, "det", detSaved),
    },
  });
  const review = syncReviewRecord(key);
  return {
    key,
    warnings,
    backup: saved.backup,
    url: `/docs/${key}/informe-${key}.html#iniciativa`,
    httpUrl: `/docs/${key}/informe-${key}.html#iniciativa`,
    status: review.status,
    statusLabel: review.statusLabel,
    missing: review.missing,
  };
}

async function updateDiagramsDocumentation(key, sequences, architectures, useArchify) {
  const ctx = requireExisting(key);
  const seq = sequences || [];
  const arch = architectures || [];
  if (!seq.length && !arch.length) {
    const err = new Error("Adjunta diagramas de secuencia y/o arquitectura.");
    err.status = 400;
    throw err;
  }
  fs.mkdirSync(ctx.diagrams, { recursive: true });
  fs.mkdirSync(ctx.artefactos, { recursive: true });
  const warnings = [];
  const seqSaved = await saveFiles(seq, ctx.artefactos);
  const archSaved = await saveFiles(arch, ctx.artefactos);
  const existing = Array.isArray(ctx.model.diagrams) ? ctx.model.diagrams : [];
  const diagrams = [];
  const opts = { useArchify: Boolean(useArchify), analysis: ctx.model.analysis || emptyAnalysis() };
  if (archSaved.length) {
    for (const file of archSaved) {
      const diagram = await buildDiagram(file, "Arquitectura", ctx, warnings, opts);
      if (diagram) diagrams.push(diagram);
    }
  } else {
    diagrams.push(...existing.filter((item) => item.kind === "Arquitectura"));
  }
  if (seqSaved.length) {
    for (const file of seqSaved) {
      const diagram = await buildDiagram(file, "Secuencia", ctx, warnings, opts);
      if (diagram) diagrams.push(diagram);
    }
  } else {
    diagrams.push(...existing.filter((item) => item.kind === "Secuencia"));
  }
  const pendingDiagrams = [];
  if (!diagrams.some((item) => item.kind === "Arquitectura")) {
    pendingDiagrams.push("Arquitectura de microservicios (Logical/Physical To-Be)");
  }
  if (!diagrams.some((item) => item.kind === "Secuencia")) {
    pendingDiagrams.push("Diagramas de secuencia por flujo");
  }
  let attachments = ctx.model.attachments || [];
  if (archSaved.length) attachments = mergeAttachments(attachments, "architecture", archSaved);
  if (seqSaved.length) attachments = mergeAttachments(attachments, "sequence", seqSaved);
  const saved = saveDocument(key, {
    mode: "model",
    model: {
      ...ctx.model,
      attachments,
      diagrams,
      pendingDiagrams,
      useArchify: Boolean(useArchify),
    },
  });
  const review = syncReviewRecord(key);
  return {
    key,
    diagrams: diagrams.length,
    useArchify: Boolean(useArchify),
    warnings,
    backup: saved.backup,
    url: `/docs/${key}/informe-${key}.html#diagramas`,
    httpUrl: `/docs/${key}/informe-${key}.html#diagramas`,
    status: review.status,
    statusLabel: review.statusLabel,
    missing: review.missing,
  };
}

module.exports = {
  generateDocumentation,
  updateTestsDocumentation,
  updateIniciativaDocumentation,
  updateDiagramsDocumentation,
  buildDiagram,
  parseCasesFromRows,
  parseCasesFromSaved,
  xlsxToRows,
};
