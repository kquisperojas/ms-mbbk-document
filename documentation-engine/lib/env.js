const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function loadEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const fileValues = loadEnvFile(path.join(ROOT, ".env"));
const get = (key, fallback = "") => process.env[key] || fileValues[key] || fallback;

const config = {
  ROOT,
  PORT: Number(get("PORT", "8790")),
  JIRA_BASE_URL: get("JIRA_BASE_URL", "https://pichinchaperu.atlassian.net").replace(/\/+$/, ""),
  JIRA_EMAIL: get("JIRA_EMAIL"),
  JIRA_API_TOKEN: get("JIRA_API_TOKEN"),
  JIRA_PROJECT: get("JIRA_PROJECT", "APP"),
  JIRA_BOARD_ID: get("JIRA_BOARD_ID", "179"),
  JIRA_STATUS: get("JIRA_STATUS", "Solucionado"),
  JIRA_ISSUE_TYPES: get("JIRA_ISSUE_TYPES", "Epic"),
  JIRA_JQL: get("JIRA_JQL", ""),
  DOCS_ROOT: path.resolve(get("DOCS_ROOT", "C:\\WORKSPACE\\DOCUMENTACION")),
  CANONICAL_REPORT: get("CANONICAL_REPORT", "C:\\WORKSPACE\\DOCUMENTACION\\NEG-1678\\informe-NEG-1678.html"),
  ARCHIFY_BIN: get(
    "ARCHIFY_BIN",
    path.join(process.env.USERPROFILE || "C:\\Users\\PC", ".agents", "skills", "archify", "bin", "archify.mjs")
  ),
  CORS_ORIGINS: get("CORS_ORIGINS", "http://127.0.0.1:8788,http://localhost:8788,http://127.0.0.1:4200,http://localhost:4200")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  CATALOG_FILE: path.join(ROOT, "data", "catalog.json"),
  GITHUB_TOKEN: get("GITHUB_TOKEN"),
  GITHUB_ORG: get("GITHUB_ORG", "pichincha-peru"),
};

config.jiraConfigured = Boolean(config.JIRA_EMAIL && config.JIRA_API_TOKEN);
config.githubConfigured = Boolean(config.GITHUB_TOKEN);

module.exports = { config };
