const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { config } = require("./env");

const execFileAsync = promisify(execFile);
const gitEnv = Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: "0" });

const SOURCE_RE = /\.(java|kt|kts|xml|yml|yaml|json|properties|sql|ts|js)$/i;
const SKIP_RE = /(?:^|\/)(?:node_modules|target|dist|build|coverage|\.git)(?:\/|$)|(?:\.min\.)/i;
const RELEVANT_RE =
  /(?:^|\/)(?:src|test|tests)\/|openapi|swagger|controller|resource|service|mapper|dto|application\.(?:yml|yaml|properties)|routes?\.js/i;

function ghRequest(urlPath, { raw = false, accept } = {}) {
  const headers = {
    "User-Agent": "ms-mbbk-documentation",
    Accept: accept || (raw ? "application/vnd.github.raw" : "application/vnd.github+json"),
  };
  if (config.GITHUB_TOKEN) headers.Authorization = "Bearer " + config.GITHUB_TOKEN;
  return new Promise((resolve, reject) => {
    const req = https
      .get("https://api.github.com" + urlPath, { headers }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (res.statusCode === 204) return resolve(null);
          if (raw && res.statusCode < 400) {
            const text = buf.toString("utf8");
            if (text.startsWith("{") && /"encoding"\s*:\s*"base64"/.test(text)) {
              try {
                const json = JSON.parse(text);
                return resolve(Buffer.from(String(json.content || "").replace(/\n/g, ""), "base64").toString("utf8"));
              } catch (_) {
                return resolve(text);
              }
            }
            return resolve(text);
          }
          let json = null;
          try {
            json = buf.length ? JSON.parse(buf.toString("utf8")) : null;
          } catch (_) {
            json = null;
          }
          if (res.statusCode >= 400) {
            const msg = (json && json.message) || buf.toString("utf8") || "HTTP " + res.statusCode;
            const err = new Error(msg);
            err.status = res.statusCode === 404 ? 404 : res.statusCode;
            reject(err);
            return;
          }
          resolve(json);
        });
      })
      .on("error", reject);
    req.setTimeout(25000, () => {
      req.destroy();
      const err = new Error("GitHub no respondió a tiempo.");
      err.status = 504;
      reject(err);
    });
  });
}

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function parseFeatureBranchUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) fail("Indica el link de la rama feature de la solución.");
  const compare = value.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/compare\/[^.]+\.\.\.([^?#\s]+)/i
  );
  if (compare) {
    return { owner: compare[1], repo: compare[2].replace(/\.git$/, ""), ref: decodeURIComponent(compare[3]) };
  }
  const tree = value.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:tree|blob|commits?)\/([^?#]+)/i
  );
  if (tree) {
    const rest = decodeURIComponent(tree[3].replace(/\/+$/, ""));
    const cut = rest.search(/\/(?:src|app|backend|frontend|docs|test|tests)\b/i);
    return {
      owner: tree[1],
      repo: tree[2].replace(/\.git$/, ""),
      ref: cut > 0 ? rest.slice(0, cut) : rest,
    };
  }
  const at = value.match(/^([^/\s]+)\/([^@\s]+)@(.+)$/);
  if (at) return { owner: at[1], repo: at[2].replace(/\.git$/, ""), ref: at[3].trim() };
  const repoOnly = value.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?\s]+?)(?:\.git)?\/?$/i);
  if (repoOnly) {
    return { owner: repoOnly[1], repo: repoOnly[2].replace(/\.git$/, ""), ref: "" };
  }
  fail("Usa un link de GitHub a la rama feature (ej. https://github.com/org/repo/tree/feature/mi-rama).");
}

function isSourcePath(filePath) {
  return SOURCE_RE.test(filePath) && !SKIP_RE.test(filePath) && RELEVANT_RE.test(filePath);
}

function rankPath(filePath) {
  const p = filePath.toLowerCase();
  if (/openapi|swagger/.test(p)) return 0;
  if (/controller|resource/.test(p)) return 1;
  if (/mapper|constants|properties/.test(p)) return 1;
  if (/service/.test(p)) return 2;
  if (/(?:^|\/)(?:test|tests)\//.test(p)) return 3;
  if (/dto|mapper|entity/.test(p)) return 4;
  return 5;
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, worker));
  return out;
}

function extractOpenApiPaths(text) {
  const paths = [];
  const block = String(text || "").match(/\npaths:\s*\n([\s\S]*?)(?:\n(?:components|servers|tags|security|info):|$)/);
  const body = block ? block[1] : String(text || "");
  for (const m of body.matchAll(/^\s{2}(\/[^\s:]+):\s*$/gm)) paths.push(m[1]);
  return paths;
}

function corpusFromFiles(owner, repo, ref, files) {
  return {
    owner,
    repo,
    ref,
    sha: "",
    url: `https://github.com/${owner}/${repo}/tree/${ref}`,
    files,
    openApiPaths: [...new Set(files.flatMap((f) => f.openApiPaths))],
  };
}

async function git(args, opts = {}) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      timeout: opts.timeout || 30000,
      maxBuffer: 16 * 1024 * 1024,
      env: gitEnv,
      cwd: opts.cwd,
    });
    return String(stdout || "");
  } catch (e) {
    const msg = String((e.stderr || e.stdout || e.message || "")).slice(0, 500);
    const err = new Error(msg);
    err.status = 400;
    throw err;
  }
}

async function listHeads(owner, repo) {
  const out = await git(["ls-remote", "--heads", `git@github.com:${owner}/${repo}.git`], { timeout: 25000 });
  return [...out.matchAll(/refs\/heads\/(.+)$/gm)].map((m) => m[1].trim()).filter(Boolean);
}

function walkSources(root) {
  const acc = [];
  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = path.relative(root, full).replace(/\\/g, "/");
      if (ent.isDirectory()) {
        if (!SKIP_RE.test(rel + "/")) walk(full);
      } else if (isSourcePath(rel)) {
        acc.push(rel);
      }
    }
  };
  walk(root);
  return acc;
}

async function loadViaGit(parsed) {
  const { owner, repo } = parsed;
  let ref = String(parsed.ref || "").trim();
  let heads = [];
  try {
    heads = await listHeads(owner, repo);
  } catch (e) {
    fail(
      `No se pudo acceder a ${owner}/${repo} por GitHub API ni por git SSH. ${String(e.message || "").slice(0, 180)}`
    );
  }
  if (!heads.length) fail(`El repositorio ${owner}/${repo} no tiene ramas visibles por SSH.`);
  if (!ref) ref = heads.includes("develop") ? "develop" : heads.includes("desarrollo") ? "desarrollo" : heads[0];
  if (!heads.includes(ref)) {
    const hint = heads.filter((h) => h.toLowerCase().includes(ref.toLowerCase().split("/").pop() || ref)).slice(0, 8);
    fail(
      `No está la rama "${ref}" en ${owner}/${repo}. Ramas cercanas: ${
        hint.length ? hint.join(", ") : heads.slice(0, 8).join(", ")
      }.`
    );
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mbbk-docs-"));
  try {
    await git(
      ["clone", "--depth", "1", "--single-branch", "--branch", ref, `git@github.com:${owner}/${repo}.git`, dir],
      { timeout: 120000 }
    );
    const selected = walkSources(dir).sort((a, b) => rankPath(a) - rankPath(b) || a.localeCompare(b)).slice(0, 90);
    if (!selected.length) {
      fail(`La rama ${ref} de ${owner}/${repo} no tiene código fuente reconocible (Java, OpenAPI, tests).`);
    }
    const files = [];
    for (const rel of selected) {
      try {
        const text = fs.readFileSync(path.join(dir, rel), "utf8");
        if (!text || text.length > 400000) continue;
        files.push({
          path: rel,
          text,
          lower: text.toLowerCase(),
          openApiPaths: /openapi|swagger/i.test(rel) ? extractOpenApiPaths(text) : [],
        });
      } catch (_) {
        /* archivo individual */
      }
    }
    if (!files.length) fail(`No se pudo leer el código de ${owner}/${repo}@${ref}.`);
    return corpusFromFiles(owner, repo, ref, files);
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_) {
      /* temp */
    }
  }
}

async function resolveRef(owner, repo, ref) {
  const commit = await ghRequest(`/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`);
  return { sha: commit.sha, treeSha: commit.commit && commit.commit.tree && commit.commit.tree.sha };
}

async function loadViaApi(parsed) {
  const { owner, repo } = parsed;
  let ref = String(parsed.ref || "").trim();
  if (!ref) {
    const repoInfo = await ghRequest(`/repos/${owner}/${repo}`);
    ref = repoInfo.default_branch || "develop";
  }
  const resolved = await resolveRef(owner, repo, ref);
  const tree = await ghRequest(
    `/repos/${owner}/${repo}/git/trees/${resolved.treeSha || encodeURIComponent(ref)}?recursive=1`
  );
  const blobs = (tree.tree || []).filter((n) => n.type === "blob" && n.path && isSourcePath(n.path));
  blobs.sort((a, b) => rankPath(a.path) - rankPath(b.path) || a.path.localeCompare(b.path));
  const selected = blobs.slice(0, 90);
  if (!selected.length) {
    fail(`La rama ${ref} de ${owner}/${repo} no tiene código fuente reconocible (Java, OpenAPI, tests).`);
  }
  const files = [];
  await mapPool(selected, 6, async (entry) => {
    try {
      const text = await ghRequest(`/repos/${owner}/${repo}/git/blobs/${entry.sha}`, { raw: true });
      if (!text || text.length > 400000) return;
      files.push({
        path: entry.path,
        text,
        lower: text.toLowerCase(),
        openApiPaths: /openapi|swagger/i.test(entry.path) ? extractOpenApiPaths(text) : [],
      });
    } catch (_) {
      /* archivo individual no bloquea la validación */
    }
  });
  if (!files.length) fail(`No se pudo leer el código de ${owner}/${repo}@${ref}.`);
  const corpus = corpusFromFiles(owner, repo, ref, files);
  corpus.sha = resolved.sha;
  return corpus;
}

async function loadBranchCorpus(featureBranchUrl) {
  const parsed = parseFeatureBranchUrl(featureBranchUrl);
  try {
    return await loadViaApi(parsed);
  } catch (e) {
    if (![401, 403, 404, 400].includes(Number(e.status))) throw e;
    return loadViaGit(parsed);
  }
}

module.exports = { parseFeatureBranchUrl, loadBranchCorpus };
