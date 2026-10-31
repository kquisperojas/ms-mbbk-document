const fs = require("fs");
const path = require("path");
const {
  generateDocumentation,
  updateTestsDocumentation,
  updateIniciativaDocumentation,
  updateDiagramsDocumentation,
} = require("./lib/generator");
const { loadDocument, saveDocument, deleteDocument, loadReview, saveReview } = require("./lib/docs-admin");
const { saveDraft, loadDraft, clearDraft, draftFilePaths } = require("./lib/doc-status");
const { loadShell } = require("./lib/shell");
const { documentationIndex } = require("./lib/docs-index");
const { getInitiative } = require("./lib/jira");

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
    case "generate": {
      const pick = (group) => {
        const uploaded = filesFrom(job[group]);
        return uploaded.length ? uploaded : filesFrom(draftFilePaths(job.key, group));
      };
      return generateDocumentation({
        key: job.key,
        figmaUrl: job.figmaUrl || "",
        featureBranch: job.featureBranch || "",
        det: pick("det"),
        sequences: pick("sequence"),
        architectures: pick("architecture"),
        tests: pick("tests"),
        others: pick("others"),
      });
    }
    case "draft-save":
      return saveDraft({
        key: job.key,
        link: job.link || "",
        figmaUrl: job.figmaUrl || "",
        featureBranch: job.featureBranch || "",
        det: filesFrom(job.det),
        sequence: filesFrom(job.sequence),
        architecture: filesFrom(job.architecture),
        tests: filesFrom(job.tests),
        others: filesFrom(job.others),
      });
    case "draft-load":
      return loadDraft(job.key);
    case "draft-delete": {
      loadDraft(job.key);
      clearDraft(job.key);
      return { key: job.key, deleted: true };
    }
    case "tests":
      return updateTestsDocumentation(job.key, filesFrom(job.tests), job.featureBranch || "");
    case "iniciativa":
      return updateIniciativaDocumentation(job.key, filesFrom(job.det), job.link || job.jiraUrl || "");
    case "diagramas":
      return updateDiagramsDocumentation(
        job.key,
        filesFrom(job.sequence),
        filesFrom(job.architecture),
        Boolean(job.useArchify)
      );
    case "load":
      return loadDocument(job.key);
    case "jira-issue":
      return getInitiative(job.key);
    case "save":
      return saveDocument(job.key, job.body || {});
    case "delete":
      return deleteDocument(job.key);
    case "review-load":
      return loadReview(job.key);
    case "review-save":
      return saveReview(job.key, job.body || {});
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
