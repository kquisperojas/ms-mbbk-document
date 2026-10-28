const fs = require("fs");
const path = require("path");
const { generateDocumentation, updateTestsDocumentation } = require("./lib/generator");
const { loadDocument, saveDocument, deleteDocument } = require("./lib/docs-admin");
const { loadShell } = require("./lib/shell");
const { documentationIndex } = require("./lib/docs-index");

function asFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    name: path.basename(filePath),
    size: buffer.length,
    arrayBuffer: async () => buffer,
  };
}

function filesFrom(paths) {
  return (paths || []).filter(Boolean).map(asFile);
}

async function run(command, job) {
  switch (command) {
    case "generate":
      return generateDocumentation({
        key: job.key,
        figmaUrl: job.figmaUrl || "",
        det: filesFrom(job.det),
        sequences: filesFrom(job.sequence),
        architectures: filesFrom(job.architecture),
        tests: filesFrom(job.tests),
        others: filesFrom(job.others),
      });
    case "tests":
      return updateTestsDocumentation(job.key, filesFrom(job.tests), job.featureBranch || "");
    case "load":
      return loadDocument(job.key);
    case "save":
      return saveDocument(job.key, job.body || {});
    case "delete":
      return deleteDocument(job.key);
    case "index":
      return { items: documentationIndex() };
    case "shell":
      return { css: loadShell().css };
    default:
      throw Object.assign(new Error("Comando desconocido: " + command), { status: 400 });
  }
}

async function main() {
  const command = process.argv[2];
  const jobPath = process.argv[3];
  if (!command || !jobPath) {
    throw Object.assign(new Error("Uso: node cli.js <comando> <job.json>"), { status: 400 });
  }
  const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
  const result = await run(command, job);
  process.stdout.write(JSON.stringify(result));
}

main().catch((err) => {
  const payload = { error: err.message || String(err), status: err.status || 500 };
  process.stderr.write(JSON.stringify(payload));
  process.exit(1);
});
