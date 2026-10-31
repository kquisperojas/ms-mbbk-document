const fs = require("fs");
const path = require("path");
const { config } = require("./env");

const DOC_FOLDER_RE = /^[A-Za-z0-9][A-Z0-9_-]*$/i;
const DRAFT_GROUPS = ["det", "sequence", "architecture", "tests", "others"];

const STATUS = {
  borrador: { id: "borrador", label: "Borrador" },
  revision: { id: "revision", label: "En revisión" },
  publicada: { id: "publicada", label: "Publicada" },
  desactualizada: { id: "desactualizada", label: "Desactualizada" },
};

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

function reviewPath(key) {
  return path.join(docRoot(key), "review.json");
}

function draftPath(key) {
  return path.join(docRoot(key), "draft.json");
}

function draftFilesDir(key, group) {
  return group ? path.join(docRoot(key), "draft-files", group) : path.join(docRoot(key), "draft-files");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return null;
  }
}

function safeName(name) {
  return path.basename(String(name || "archivo")).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
}

function listGroupFiles(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => fs.statSync(path.join(dir, name)).isFile())
      .map((name) => ({ name, size: fs.statSync(path.join(dir, name)).size }));
  } catch (_) {
    return [];
  }
}

function completeness(model) {
  const diagrams = Array.isArray(model && model.diagrams) ? model.diagrams.length : 0;
  const hasDiagrams = diagrams > 0;
  const hasTests = Boolean(model && Array.isArray(model.cases) && model.cases.length);
  const missing = [];
  if (!hasDiagrams) missing.push("diagramas");
  if (!hasTests) missing.push("casos de prueba");
  return { hasDiagrams, hasTests, complete: hasDiagrams && hasTests, missing };
}

function resolveLifecycle(key) {
  assertKey(key);
  const hasReport = fs.existsSync(reportPath(key));
  const draft = readJson(draftPath(key));
  if (!hasReport) {
    if (!draft) return null;
    return {
      key,
      status: STATUS.borrador.id,
      statusLabel: STATUS.borrador.label,
      hasReport: false,
      isDraft: true,
      missing: [],
      title: draft.title || key,
      updated: draft.savedAt || null,
      url: `/portal/generar?draft=${encodeURIComponent(key)}`,
    };
  }
  const model = readJson(modelPath(key)) || {};
  const review = readJson(reviewPath(key)) || {};
  const complete = completeness(model);
  const published = review.status === STATUS.publicada.id;
  const status = published
    ? STATUS.publicada
    : complete.complete
      ? STATUS.revision
      : STATUS.desactualizada;
  const stat = fs.statSync(reportPath(key));
  return {
    key,
    status: status.id,
    statusLabel: status.label,
    hasReport: true,
    isDraft: false,
    missing: published ? [] : complete.missing,
    title: model.title || key,
    subtitle: model.subtitle || "",
    updated: stat.mtime.toISOString(),
    url: `/docs/${key}/informe-${key}.html`,
    publishedAt: review.publishedAt || null,
    publishedBy: review.publishedBy || null,
  };
}

function emptyReview(key, status = STATUS.revision.id) {
  return {
    key,
    status,
    statusLabel: (STATUS[status] || STATUS.revision).label,
    publishedAt: null,
    publishedBy: null,
    missing: [],
    comments: [],
  };
}

function syncReviewRecord(key, extra = {}) {
  const life = resolveLifecycle(key);
  if (!life || !life.hasReport) {
    const err = new Error(`No hay informe para ${key}.`);
    err.status = 404;
    throw err;
  }
  const stored = readJson(reviewPath(key)) || {};
  const comments = Array.isArray(stored.comments) ? stored.comments : [];
  const next = {
    ...emptyReview(key, life.status),
    ...stored,
    ...extra,
    key,
    status: extra.status === STATUS.publicada.id ? STATUS.publicada.id : life.status,
    statusLabel:
      extra.status === STATUS.publicada.id ? STATUS.publicada.label : life.statusLabel,
    missing: extra.status === STATUS.publicada.id ? [] : life.missing,
    comments: Array.isArray(extra.comments) ? extra.comments : comments,
    savedAt: new Date().toISOString(),
  };
  if (next.status === STATUS.publicada.id) {
    next.publishedAt = extra.publishedAt || stored.publishedAt || new Date().toISOString();
    next.publishedBy = extra.publishedBy || stored.publishedBy || null;
  } else {
    next.publishedAt = null;
    next.publishedBy = null;
  }
  fs.mkdirSync(docRoot(key), { recursive: true });
  fs.writeFileSync(reviewPath(key), JSON.stringify(next, null, 2), "utf8");
  return next;
}

async function saveDraft(job) {
  const key = assertKey(job.key);
  if (fs.existsSync(reportPath(key))) {
    const err = new Error(`${key} ya tiene documentación generada. Usa generar para actualizarla.`);
    err.status = 409;
    throw err;
  }
  const hasFiles = DRAFT_GROUPS.some((group) => Array.isArray(job[group]) && job[group].length);
  const hasMeta = Boolean(String(job.figmaUrl || "").trim() || String(job.featureBranch || "").trim());
  if (!hasFiles && !hasMeta) {
    const err = new Error("Para guardar un borrador adjunta insumos (DET, diagramas, pruebas) o indica Figma / rama feature.");
    err.status = 400;
    throw err;
  }
  const root = docRoot(key);
  fs.mkdirSync(root, { recursive: true });
  const files = {};
  for (const group of DRAFT_GROUPS) {
    const dest = draftFilesDir(key, group);
    fs.mkdirSync(dest, { recursive: true });
    const incoming = Array.isArray(job[group]) ? job[group] : [];
    if (incoming.length) {
      for (const name of fs.readdirSync(dest)) fs.rmSync(path.join(dest, name), { force: true });
      files[group] = [];
      for (const file of incoming) {
        const name = safeName(file.name);
        const buf = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(path.join(dest, name), buf);
        files[group].push({ name, size: buf.length });
      }
    } else {
      files[group] = listGroupFiles(dest);
    }
  }
  const payload = {
    key,
    link: job.link || "",
    figmaUrl: job.figmaUrl || "",
    featureBranch: job.featureBranch || "",
    files,
    savedAt: new Date().toISOString(),
    status: STATUS.borrador.id,
    statusLabel: STATUS.borrador.label,
  };
  fs.writeFileSync(draftPath(key), JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

function loadDraft(key) {
  assertKey(key);
  const stored = readJson(draftPath(key));
  if (!stored) {
    const err = new Error(`No hay borrador para ${key}.`);
    err.status = 404;
    throw err;
  }
  const files = {};
  for (const group of DRAFT_GROUPS) {
    files[group] = listGroupFiles(draftFilesDir(key, group));
  }
  return { ...stored, key, files, status: STATUS.borrador.id, statusLabel: STATUS.borrador.label };
}

function clearDraft(key) {
  try {
    fs.rmSync(draftPath(key), { force: true });
    fs.rmSync(draftFilesDir(key), { recursive: true, force: true });
  } catch (_) {
    // ignore
  }
}

function draftFilePaths(key, group) {
  const dir = draftFilesDir(key, group);
  try {
    return fs.readdirSync(dir).map((name) => path.join(dir, name));
  } catch (_) {
    return [];
  }
}

function allInitiativeKeys() {
  try {
    return fs
      .readdirSync(config.DOCS_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_") && DOC_FOLDER_RE.test(d.name))
      .map((d) => d.name)
      .filter((key) => fs.existsSync(reportPath(key)) || fs.existsSync(draftPath(key)));
  } catch (_) {
    return [];
  }
}

module.exports = {
  STATUS,
  DRAFT_GROUPS,
  assertKey,
  docRoot,
  reportPath,
  modelPath,
  reviewPath,
  draftPath,
  readJson,
  completeness,
  resolveLifecycle,
  emptyReview,
  syncReviewRecord,
  saveDraft,
  loadDraft,
  clearDraft,
  draftFilePaths,
  allInitiativeKeys,
};
