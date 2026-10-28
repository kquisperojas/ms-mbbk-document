const { config } = require("./env");

const LIST_FIELDS = ["summary", "description", "assignee", "status", "issuetype", "updated", "resolutiondate"];
const DETAIL_FIELDS = [...LIST_FIELDS, "created", "labels", "components", "priority", "reporter", "parent", "fixVersions"];

function authHeader() {
  return "Basic " + Buffer.from(`${config.JIRA_EMAIL}:${config.JIRA_API_TOKEN}`).toString("base64");
}

async function jiraFetch(apiPath, init = {}) {
  if (!config.jiraConfigured) {
    const missing = [!config.JIRA_EMAIL && "JIRA_EMAIL", !config.JIRA_API_TOKEN && "JIRA_API_TOKEN"].filter(Boolean);
    const err = new Error(
      `Faltan ${missing.join(" y ")}. Regístralos en Credenciales APIs (tabla credenciales_apis).`
    );
    err.status = 503;
    throw err;
  }
  const res = await fetch(config.JIRA_BASE_URL + apiPath, {
    ...init,
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Jira respondió ${res.status}: ${body.slice(0, 400)}`);
    err.status = res.status === 401 || res.status === 403 ? res.status : 502;
    throw err;
  }
  return res.json();
}

async function searchAll(jql, fields, limit = 500) {
  const issues = [];
  let nextPageToken;
  do {
    const data = await jiraFetch("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify({ jql, fields, maxResults: 100, nextPageToken }),
    });
    issues.push(...(data.issues || []));
    nextPageToken = data.isLast ? undefined : data.nextPageToken;
  } while (nextPageToken && issues.length < limit);
  return issues;
}

const quote = (value) => `"${value.trim().replace(/"/g, '\\"')}"`;
const csvList = (value) => value.split(",").map((v) => v.trim()).filter(Boolean);

const boardFilterCache = { boardId: "", filterId: "" };

async function resolveBoardFilterId() {
  const boardId = String(config.JIRA_BOARD_ID || "").trim();
  if (!boardId) return "";
  if (boardFilterCache.boardId === boardId && boardFilterCache.filterId) {
    return boardFilterCache.filterId;
  }
  if (!config.jiraConfigured) return "";
  const data = await jiraFetch(`/rest/agile/1.0/board/${encodeURIComponent(boardId)}/configuration`);
  const filterId = data?.filter?.id != null ? String(data.filter.id) : "";
  if (!filterId) {
    const err = new Error(`El tablero ${boardId} no expone un filtro Jira (configuration.filter.id)`);
    err.status = 502;
    throw err;
  }
  boardFilterCache.boardId = boardId;
  boardFilterCache.filterId = filterId;
  return filterId;
}

function issueTypeClause() {
  const types = csvList(config.JIRA_ISSUE_TYPES);
  if (types.length) return `issuetype in (${types.map(quote).join(", ")})`;
  return "issuetype = Epic";
}

function statusClause() {
  const statuses = csvList(config.JIRA_STATUS);
  const list = statuses.length ? statuses : ["Solucionado"];
  return `status in (${list.map(quote).join(", ")})`;
}

function assigneeClause(scope) {
  return scope === "mine" ? "assignee = currentUser()" : "assignee IS NOT EMPTY";
}

function boardClause(filterId) {
  if (filterId) return `filter = ${filterId}`;
  if (config.JIRA_BOARD_ID) return `filter = <tablero ${config.JIRA_BOARD_ID}>`;
  return `project = ${quote(config.JIRA_PROJECT)}`;
}

async function buildJql(scope) {
  if (config.JIRA_JQL) return config.JIRA_JQL;
  const filterId = await resolveBoardFilterId();
  return [boardClause(filterId), issueTypeClause(), statusClause(), assigneeClause(scope)].join(" AND ") +
    " ORDER BY updated DESC";
}

function adfToText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfToText).join("");
  switch (node.type) {
    case "text":
      return node.text || "";
    case "hardBreak":
      return "\n";
    case "mention":
      return node.attrs?.text || "";
    case "emoji":
      return node.attrs?.text || "";
    case "inlineCard":
    case "blockCard":
      return node.attrs?.url || "";
    case "paragraph":
    case "heading":
    case "codeBlock":
    case "blockquote":
      return adfToText(node.content) + "\n";
    case "listItem":
      return "- " + adfToText(node.content).trim() + "\n";
    case "tableRow":
      return (node.content || []).map((c) => adfToText(c).trim()).join(" | ") + "\n";
    default:
      return adfToText(node.content);
  }
}

function toInitiative(issue) {
  const f = issue.fields || {};
  return {
    key: issue.key,
    summary: f.summary || "",
    description: adfToText(f.description).replace(/\n{3,}/g, "\n\n").trim(),
    assignee: f.assignee?.displayName || "Sin asignar",
    assigneeEmail: f.assignee?.emailAddress || "",
    status: f.status?.name || "",
    statusCategory: f.status?.statusCategory?.key || "",
    issueType: f.issuetype?.name || "",
    updated: f.updated || "",
    resolutionDate: f.resolutiondate || "",
    url: `${config.JIRA_BASE_URL}/browse/${issue.key}`,
  };
}

async function listInitiatives(scope) {
  const jql = await buildJql(scope);
  const issues = await searchAll(jql, LIST_FIELDS);
  return { jql, items: issues.map(toInitiative) };
}

async function getInitiative(key) {
  const issue = await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=${DETAIL_FIELDS.join(",")}`);
  const f = issue.fields || {};
  const base = toInitiative(issue);
  let children = [];
  try {
    children = (await searchAll(`parent = ${key} ORDER BY key ASC`, LIST_FIELDS, 200)).map(toInitiative);
  } catch (_) {
    children = [];
  }
  return {
    ...base,
    created: f.created || "",
    reporter: f.reporter?.displayName || "",
    priority: f.priority?.name || "",
    labels: f.labels || [],
    components: (f.components || []).map((c) => c.name),
    fixVersions: (f.fixVersions || []).map((v) => v.name),
    parent: f.parent ? { key: f.parent.key, summary: f.parent.fields?.summary || "" } : null,
    children,
  };
}

async function whoAmI() {
  return jiraFetch("/rest/api/3/myself");
}

function extractIssueKey(link) {
  const text = String(link || "").trim();
  const selected = text.match(/[?&]selectedIssue=([A-Z][A-Z0-9_]+-\d+)/i);
  if (selected) return selected[1].toUpperCase();
  const browse = text.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/i);
  if (browse) return browse[1].toUpperCase();
  const any = text.match(/\b([A-Z][A-Z0-9_]+-\d+)\b/i);
  return any ? any[1].toUpperCase() : null;
}

module.exports = { listInitiatives, getInitiative, whoAmI, extractIssueKey, buildJql };
