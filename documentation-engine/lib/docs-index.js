const fs = require("fs");
const path = require("path");
const { config } = require("./env");

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
  return documentedKeys()
    .map((key) => {
      const root = path.join(config.DOCS_ROOT, key);
      const report = path.join(root, `informe-${key}.html`);
      const stat = fs.statSync(report);
      const head = fs.readFileSync(report, "utf8").slice(0, 4000);
      const title = ((head.match(/<title>([^<]*)<\/title>/) || [])[1] || key).replace(/\s*\|\s*Documentación\s*$/, "");
      const subtitle = ((head.match(/<span>Documentación técnica · ([^<]*)<\/span>/) || [])[1] || "").trim();
      return {
        key,
        title: title.replace(new RegExp(`^${key}\\s*—\\s*`), ""),
        subtitle,
        updated: stat.mtime.toISOString(),
        diagrams: countFiles(path.join(root, "diagrams"), (f) => f.endsWith(".html")),
        artefactos: countFiles(path.join(root, "artefactos")),
        backups: countFiles(root, (f) => f.startsWith(`informe-${key}.backup-`)),
        url: `/docs/${key}/informe-${key}.html`,
        fileUrl: "file:///" + report.replace(/\\/g, "/"),
      };
    })
    .sort((a, b) => b.updated.localeCompare(a.updated));
}

module.exports = { documentedKeys, documentationIndex };
