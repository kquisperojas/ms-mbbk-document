const fs = require("fs");
const path = require("path");
const { config } = require("./env");
const { allInitiativeKeys, resolveLifecycle, readJson, modelPath, reportPath } = require("./doc-status");

function countFiles(dir, filter = () => true) {
  try {
    return fs.readdirSync(dir).filter(filter).length;
  } catch (_) {
    return 0;
  }
}

function documentedKeys() {
  try {
    return fs
      .readdirSync(config.DOCS_ROOT, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() &&
          !d.name.startsWith("_") &&
          fs.existsSync(path.join(config.DOCS_ROOT, d.name, `informe-${d.name}.html`))
      )
      .map((d) => d.name);
  } catch (_) {
    return [];
  }
}

function documentationIndex() {
  return allInitiativeKeys()
    .map((key) => {
      const life = resolveLifecycle(key);
      if (!life) return null;
      const root = path.join(config.DOCS_ROOT, key);
      const model = life.hasReport ? readJson(modelPath(key)) || {} : {};
      const report = reportPath(key);
      let title = (model.jira && model.jira.summary) || life.title || key;
      if (life.hasReport && fs.existsSync(report)) {
        const head = fs.readFileSync(report, "utf8").slice(0, 4000);
        const fromHtml = ((head.match(/<title>([^<]*)<\/title>/) || [])[1] || key).replace(/\s*\|\s*Documentación\s*$/, "");
        title =
          (model.jira && model.jira.summary) ||
          fromHtml.replace(new RegExp(`^${key}\\s*—\\s*`), "") ||
          model.title ||
          key;
      }
      return {
        key,
        title,
        subtitle: life.subtitle || model.subtitle || "",
        updated: life.updated || new Date().toISOString(),
        diagrams: countFiles(path.join(root, "diagrams"), (f) => f.endsWith(".html")),
        artefactos: countFiles(path.join(root, "artefactos")),
        backups: countFiles(root, (f) => f.startsWith(`informe-${key}.backup-`)),
        url: life.url,
        fileUrl: life.hasReport ? "file:///" + report.replace(/\\/g, "/") : "",
        status: life.status,
        statusLabel: life.statusLabel,
        hasReport: life.hasReport,
        isDraft: life.isDraft,
        missing: life.missing || [],
        publishedAt: life.publishedAt || null,
        publishedBy: life.publishedBy || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));
}

module.exports = { documentedKeys, documentationIndex };
