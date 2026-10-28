const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ORG = "pichincha-peru";
const LOCAL_BACK = "C:\\WORKSPACE\\BACK";
const JARVIS_DIR = path.join(LOCAL_BACK, "jarvis-services-properties");
const CONTACT_REF = "develop";
const SWAGGER_REF = "desarrollo";
const OPENAPI_PATHS = [
  "src/main/resources/static/openapi.yaml",
  "src/main/resources/static/openapi.yml",
  "src/main/resources/openapi.yaml",
  "src/main/resources/openapi.yml",
  "openapi.yaml",
  "openapi.yml",
  "swagger.yaml",
  "swagger.yml",
  "src/main/resources/static/swagger.yaml",
  "src/main/resources/static/swagger.yml"
];
const APP_YML_PATHS = [
  "src/main/resources/application.yml",
  "src/main/resources/application.yaml"
];

function loadEnv() {
  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return;
  fs.readFileSync(envFile, "utf8").split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) return;
    const key = m[1].trim();
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  });
}

function ghGet(urlPath) {
  const token = process.env.GITHUB_TOKEN || "";
  const headers = {
    "User-Agent": "ms-mbbk-documentation-catalog",
    Accept: "application/vnd.github+json"
  };
  if (token) headers.Authorization = "Bearer " + token;
  const url = "https://api.github.com" + urlPath;
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode === 204) return resolve(null);
        let json = null;
        try { json = body ? JSON.parse(body) : null; } catch (e) { json = null; }
        if (res.statusCode >= 400) {
          const msg = (json && json.message) || body || ("HTTP " + res.statusCode);
          const err = new Error(msg);
          err.status = res.statusCode;
          return reject(err);
        }
        resolve(json);
      });
    }).on("error", reject);
  });
}

async function listOrgRepos() {
  const repos = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await ghGet("/orgs/" + ORG + "/repos?per_page=100&page=" + page + "&type=all&sort=full_name");
    if (!Array.isArray(batch) || !batch.length) break;
    repos.push.apply(repos, batch);
    if (batch.length < 100) break;
  }
  return repos;
}

function classify(name) {
  const n = String(name || "").toLowerCase().replace(/-des$/, "");
  if (n.indexOf("mbbk") === -1 && n.indexOf("support-channel") === -1) return null;
  if (n.indexOf("jsc-mbbk-") === 0 || n.indexOf("jarvis-support-channel-mbbk-") === 0) return "soporteCanal";
  if (n.indexOf("ch-mbbk-") === 0 || n.indexOf("jch-mbbk-") === 0) return "experiencia";
  return "soporte";
}

function unwrap(s) {
  return String(s || "").replace(/^["']|["']$/g, "").trim();
}

function stripHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseOpenApiInfo(yaml) {
  const info = String(yaml || "").match(/^info:\n([\s\S]*?)(?=\n[a-zA-Z])/m);
  const block = info ? info[1] : String(yaml || "");
  const title = unwrap((block.match(/^\s+title:\s*(.+)$/m) || [])[1]);
  const version = unwrap((block.match(/^\s+version:\s*(.+)$/m) || [])[1]);
  const contact = block.match(/^\s+contact:\n((?:[ \t]+.+\n)+)/m);
  const owner = unwrap(((contact && contact[1].match(/name:\s*(.+)/)) || [])[1]);
  const email = unwrap(((contact && contact[1].match(/email:\s*(.+)/)) || [])[1]);
  let description = "";
  const folded = block.match(/description:\s*[|>]-?\s*\n([\s\S]*?)(?=\n  [A-Za-z])/);
  if (folded) description = stripHtml(folded[1]);
  else description = stripHtml(unwrap((block.match(/description:\s*(.+)/) || [])[1]));
  if (/^[|>]-?$/.test(description)) description = "";
  description = description
    .replace(/\*\*/g, "")
    .split(/\s*(?:Business Area|<br>)/i)[0]
    .replace(/\s+/g, " ")
    .trim();
  return { title, version, owner, email, description };
}

function parseAppYml(yml) {
  return {
    title: unwrap((yml.match(/title:\s*(.+)/) || [])[1]),
    version: unwrap((yml.match(/version:\s*(.+)/) || [])[1]),
    description: stripHtml(unwrap((yml.match(/description:\s*(.+)/) || [])[1]))
  };
}

async function readFileOnBranch(repo, filePath, ref) {
  try {
    const json = await ghGet("/repos/" + ORG + "/" + repo + "/contents/" + encodeURI(filePath) + "?ref=" + encodeURIComponent(ref));
    if (!json || !json.content) return null;
    const buf = Buffer.from(String(json.content).replace(/\n/g, ""), "base64").toString("utf8");
    return { text: buf, path: filePath, ref: json.sha ? ref : ref };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function findFile(repo, branches, candidates) {
  for (const ref of branches) {
    for (const filePath of candidates) {
      const found = await readFileOnBranch(repo, filePath, ref);
      if (found) return found;
    }
  }
  return null;
}

function blobUrl(repo, ref, filePath) {
  return "https://github.com/" + ORG + "/" + repo + "/blob/" + ref + "/" + filePath;
}

const gitEnv = Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: "0" });
const repoHeadsCache = new Map();
const HEADS_CACHE_FILE = path.join(ROOT, ".cache", "repo-heads.json");

function loadHeadsCache() {
  try {
    const json = JSON.parse(fs.readFileSync(HEADS_CACHE_FILE, "utf8"));
    Object.keys(json).forEach((key) => repoHeadsCache.set(key, json[key]));
  } catch (err) {
    /* first run */
  }
}

function saveHeadsCache() {
  fs.mkdirSync(path.dirname(HEADS_CACHE_FILE), { recursive: true });
  const obj = {};
  repoHeadsCache.forEach((value, key) => { obj[key] = value; });
  fs.writeFileSync(HEADS_CACHE_FILE, JSON.stringify(obj, null, 2), "utf8");
}

function gitOpts(cwd, timeout) {
  return {
    cwd: cwd || ROOT,
    encoding: "utf8",
    timeout: timeout || 25000,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: gitEnv
  };
}

function gitHeads(repo) {
  if (repoHeadsCache.has(repo)) return repoHeadsCache.get(repo);
  try {
    const out = execFileSync(
      "git",
      ["ls-remote", "--heads", "git@github.com:" + ORG + "/" + repo + ".git"],
      gitOpts(ROOT, 25000)
    );
    const heads = String(out).split(/\r?\n/).map((line) => {
      const m = line.match(/refs\/heads\/(.+)$/);
      return m ? m[1].trim() : "";
    }).filter(Boolean);
    repoHeadsCache.set(repo, heads);
    saveHeadsCache();
    return heads;
  } catch (err) {
    repoHeadsCache.set(repo, null);
    saveHeadsCache();
    return null;
  }
}

function repoCandidates(entry) {
  const slug = entry.slug || String(entry.repo || "").replace(/^(ch|jch|jsc)-mbbk-/i, "").replace(/-v\d+$/i, "");
  const major = entry.major || Number((String(entry.repo || "").match(/-v(\d+)$/i) || [])[1] || 1);
  const names = [];
  ["ch-mbbk-", "jch-mbbk-", "jsc-mbbk-"].forEach((prefix) => {
    names.push(prefix + slug + "-v" + major);
    names.push(prefix + slug + "-v" + major + ".0");
    names.push(prefix + slug);
  });
  if (entry.repo) names.unshift(entry.repo);
  return names.filter((name, i, arr) => name && arr.indexOf(name) === i);
}

function resolveGithubRepo(entry) {
  const tried = [];
  for (const name of repoCandidates(entry)) {
    tried.push(name);
    const heads = gitHeads(name);
    if (heads && heads.length) {
      return { name: name, heads: heads };
    }
  }
  return { name: entry.repo, heads: [], tried: tried };
}

function ensureGitCache(repo) {
  const dir = path.join(ROOT, ".cache", "git", repo);
  fs.mkdirSync(dir, { recursive: true });
  const gitDir = path.join(dir, ".git");
  if (!fs.existsSync(gitDir)) {
    execFileSync("git", ["init", "-q"], gitOpts(dir, 15000));
    execFileSync("git", ["remote", "add", "origin", "git@github.com:" + ORG + "/" + repo + ".git"], gitOpts(dir, 15000));
  }
  return dir;
}

function gitFetchRef(repo, ref) {
  const local = path.join(LOCAL_BACK, repo);
  if (fs.existsSync(path.join(local, ".git"))) {
    try {
      execFileSync("git", ["fetch", "--depth", "1", "origin", ref], gitOpts(local, 60000));
      return { cwd: local, spec: "origin/" + ref };
    } catch (err) {
      return { cwd: local, spec: "origin/" + ref };
    }
  }
  const dir = ensureGitCache(repo);
  execFileSync("git", ["fetch", "--depth", "1", "origin", ref], gitOpts(dir, 60000));
  return { cwd: dir, spec: "FETCH_HEAD" };
}

function gitShowPath(fetched, filePath) {
  try {
    const text = execFileSync("git", ["show", fetched.spec + ":" + filePath], gitOpts(fetched.cwd, 15000));
    return text && String(text).trim() ? String(text) : null;
  } catch (err) {
    return null;
  }
}

function gitOpenApi(repo, ref) {
  let fetched;
  try {
    fetched = gitFetchRef(repo, ref);
  } catch (err) {
    return null;
  }
  for (const filePath of OPENAPI_PATHS) {
    const text = gitShowPath(fetched, filePath);
    if (text && /(^|\n)(openapi|swagger):/.test(text)) {
      return { text: text, path: filePath, ref: ref, fetched: fetched };
    }
  }
  return null;
}

function isBotAuthor(name, email) {
  const blob = (String(name || "") + " " + String(email || "")).toLowerCase();
  return /\[bot\]|github-actions|dependabot|renovate|jenkins|gitlab-ci|noreply@github\.com/.test(blob);
}

function parseAuthorLine(line) {
  const raw = String(line || "").trim();
  if (!raw) return { name: "", email: "" };
  const tab = raw.indexOf("\t");
  const name = personFromContact(tab < 0 ? raw : raw.slice(0, tab));
  const email = tab < 0 ? "" : unwrap(raw.slice(tab + 1));
  if (isBotAuthor(name, email)) return { name: "", email: "" };
  return { name: name, email: email };
}

/** Autor humano del último commit en la rama (omite bots). */
function gitLastCommitAuthor(repo, ref) {
  let fetched;
  try {
    fetched = gitFetchRef(repo, ref);
  } catch (err) {
    return { name: "", email: "" };
  }
  try {
    // depth 1 solo trae el tip; si es bot, re-fetch más profundo
    let out = execFileSync(
      "git",
      ["log", "-20", "--format=%an%x09%ae", fetched.spec],
      gitOpts(fetched.cwd, 20000)
    );
    let lines = String(out || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const author = parseAuthorLine(line);
      if (author.name) return author;
    }
    // tip era bot o historial corto: ampliar fetch
    try {
      execFileSync("git", ["fetch", "--depth", "30", "origin", ref], gitOpts(fetched.cwd, 90000));
      out = execFileSync(
        "git",
        ["log", "-30", "--format=%an%x09%ae", "origin/" + ref],
        gitOpts(fetched.cwd, 20000)
      );
      lines = String(out || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const author = parseAuthorLine(line);
        if (author.name) return author;
      }
    } catch (_) {
      /* keep empty */
    }
    return { name: "", email: "" };
  } catch (err) {
    return { name: "", email: "" };
  }
}

function jarvisLastCommitAuthor(jarvisFile) {
  if (!jarvisFile || !fs.existsSync(JARVIS_DIR)) return { name: "", email: "" };
  try {
    const out = execFileSync(
      "git",
      ["log", "-20", "--format=%an%x09%ae", "--", jarvisFile],
      gitOpts(JARVIS_DIR, 20000)
    );
    const lines = String(out || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const author = parseAuthorLine(line);
      if (author.name) return author;
    }
    return { name: "", email: "" };
  } catch (err) {
    return { name: "", email: "" };
  }
}

function applyCommitAuthor(row, author, source) {
  if (!author || !author.name) return;
  row.ultimaModificacion = author.name;
  row.contactSource = source || row.contactSource || CONTACT_REF;
  if (author.email && author.email.indexOf("@") !== -1) {
    row.correo = author.email;
  }
}

function pickRef(heads, preferred, fallbacks) {
  const list = heads || [];
  if (list.indexOf(preferred) !== -1) return preferred;
  for (const name of fallbacks || []) {
    if (list.indexOf(name) !== -1) return name;
  }
  return "";
}

async function describeRepo(repo) {
  const name = repo.name;
  const contactFile = await findFile(name, [CONTACT_REF], OPENAPI_PATHS);
  const swaggerFile = await findFile(name, [SWAGGER_REF], OPENAPI_PATHS);
  const info = contactFile ? parseOpenApiInfo(contactFile.text) : {};
  const swaggerInfo = swaggerFile && !contactFile ? parseOpenApiInfo(swaggerFile.text) : info;
  const slug = name.replace(/^(ch|jch|jsc)-mbbk-/i, "");
  let author = { name: "", email: "" };
  try {
    author = gitLastCommitAuthor(name, CONTACT_REF);
  } catch (_) {
    author = { name: "", email: "" };
  }
  const ultima = author.name || personFromContact(info.owner);
  const correo = author.email || unwrap(info.email);
  return {
    repo: name,
    nombre: titleFromSlug(slug),
    descripcion: descriptionFromSlug(slug, info.description || swaggerInfo.description || repo.description || ""),
    canal: "MBBK",
    owner: ownerForRow(name, "MBBK"),
    ultimaModificacion: ultima,
    correo: correo,
    version: info.version || swaggerInfo.version || "",
    swaggerUrl: swaggerFile
      ? blobUrl(name, SWAGGER_REF, swaggerFile.path)
      : blobUrl(name, SWAGGER_REF, OPENAPI_PATHS[0]),
    repoUrl: "https://github.com/" + ORG + "/" + name,
    ambiente: "desarrollo",
    contactBranch: CONTACT_REF,
    swaggerBranch: SWAGGER_REF,
    contactSource: author.name ? CONTACT_REF : info.owner ? CONTACT_REF : ""
  };
}

function titleFromSlug(slug) {
  return String(slug || "")
    .replace(/-v\d+$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const SLUG_DESCRIPTIONS = {
  "bill-payment": "Pago de servicios y recibos desde banca móvil MBBK.",
  "contact-form": "Formularios de contacto y solicitudes del cliente en el canal MBBK.",
  "correspondence": "Plantillas HTML de correspondencia; estado de cuenta según moneda.",
  "current-account": "Consulta y operación de cuentas corrientes del cliente en el canal MBBK.",
  "customer-agreement-management": "Administrar consentimientos, autorizaciones y acuerdos del cliente. Incluye documentos y estados de cuenta.",
  "customer-operation": "Operaciones del cliente sobre productos y servicios del canal MBBK.",
  "data-retrieve": "Consulta y recuperación de datos del cliente y de productos para el canal MBBK.",
  "deposit-manager": "Gestión de depósitos a plazo del cliente en el canal MBBK.",
  "identification-management": "Gestión de identificación y datos de identidad del cliente en el canal MBBK.",
  "preference-security": "Preferencias de seguridad del cliente: accesos, validaciones y parámetros.",
  "product-management": "Consulta y gestión de productos del cliente en el canal MBBK.",
  "transactions": "Consulta y registro de transacciones del cliente en el canal MBBK.",
  "virtual-keyboards": "Teclados virtuales para captura segura de claves y datos en el canal MBBK.",
  "user-preference": "Gestiona, administra y obtiene las preferencias, tasa de cambio e información principal y de contacto del usuario y el cliente."
};

function descriptionFromSlug(slug, fallback) {
  const key = String(slug || "").replace(/-v\d+$/i, "").toLowerCase();
  const fromOpenApi = String(fallback || "").replace(/\s+/g, " ").trim();
  const looksLikeSpecDump = fromOpenApi.length > 280
    || /implementation notes|operationId:|paths:|\$ref:/i.test(fromOpenApi);
  if (fromOpenApi && !looksLikeSpecDump) return fromOpenApi;
  return SLUG_DESCRIPTIONS[key] || (fromOpenApi && !looksLikeSpecDump ? fromOpenApi : "");
}

const MBBK_OWNER = "Canales digitales";

function isMbbkName(repo, canal) {
  return /m+bbk/i.test(String(repo || "") + " " + String(canal || ""));
}

function personFromContact(contact) {
  return String(contact || "")
    .replace(/^(MBBK|MMBK|MBPB|HBBO)\s*[-–:]\s*/i, "")
    .trim();
}

function ownerForRow(repo, canal) {
  return isMbbkName(repo, canal) ? MBBK_OWNER : "";
}

function readLocalOpenApi(repoName) {
  const dir = path.join(LOCAL_BACK, repoName);
  for (const rel of OPENAPI_PATHS) {
    const full = path.join(dir, rel);
    if (fs.existsSync(full)) {
      return { text: fs.readFileSync(full, "utf8"), rel: rel.replace(/\\/g, "/") };
    }
  }
  return null;
}

function loadJarvisInventory() {
  if (!fs.existsSync(JARVIS_DIR)) return [];
  const files = fs.readdirSync(JARVIS_DIR).filter((f) => /mbbk/i.test(f) && f.endsWith(".yml"));
  const best = new Map();
  files.forEach((file) => {
    const m = file.match(/^jarvis-(channel|support-channel)-mbbk-(.+)-v(\d+)\.0-des\.yml$/i);
    if (!m) return;
    const layer = m[1].toLowerCase();
    const slug = m[2];
    const major = Number(m[3]);
    const key = layer + ":" + slug + ":v" + major;
    if (best.has(key)) return;
    const prefix = layer === "support-channel" ? "jsc-mbbk-" : "ch-mbbk-";
    const repo = prefix + slug + "-v" + major;
    best.set(key, {
      repo: repo,
      slug: slug,
      layer: layer,
      major: major,
      version: major + ".0",
      jarvisFile: file
    });
  });
  return Array.from(best.values());
}

function localRow(entry) {
  const openapi = readLocalOpenApi(entry.repo) || readLocalOpenApi(entry.repo.replace(/-v\d+$/, ""));
  const info = openapi ? parseOpenApiInfo(openapi.text) : {};
  const kind = classify(entry.repo);
  return {
    kind: kind,
    repo: entry.repo,
    nombre: titleFromSlug(entry.slug),
    descripcion: descriptionFromSlug(entry.slug, info.description || ""),
    canal: "MBBK",
    owner: ownerForRow(entry.repo, "MBBK"),
    ultimaModificacion: personFromContact(info.owner),
    correo: unwrap(info.email),
    version: entry.version,
    openApiVersion: info.version || "",
    swaggerUrl: blobUrl(entry.repo, SWAGGER_REF, (openapi && openapi.rel) || OPENAPI_PATHS[0]),
    repoUrl: "https://github.com/" + ORG + "/" + entry.repo,
    source: openapi ? "local-openapi" : "jarvis-inventory",
    ambiente: "desarrollo",
    contactBranch: CONTACT_REF,
    swaggerBranch: SWAGGER_REF,
    slug: entry.slug,
    major: entry.major,
    jarvisFile: entry.jarvisFile || ""
  };
}

function applyOpenApiToRow(row, info, swaggerFile, contactRef, swaggerRef, githubRepo) {
  const slug = String(row.slug || githubRepo || "")
    .replace(/^(ch|jch|jsc)-mbbk-/i, "")
    .replace(/-v\d+$/i, "");
  // Contacto OpenAPI solo como respaldo; el autor del último commit en develop manda.
  if (info && info.owner && !row.ultimaModificacion) {
    row.ultimaModificacion = personFromContact(info.owner);
    row.contactSource = contactRef;
  }
  if (info && info.email && !row.correo) row.correo = unwrap(info.email);
  if (info && info.description) row.descripcion = descriptionFromSlug(slug, info.description);
  if (info && info.version) row.openApiVersion = info.version;
  row.githubRepo = githubRepo;
  row.repoUrl = "https://github.com/" + ORG + "/" + githubRepo;
  row.contactBranch = contactRef || row.contactBranch;
  row.swaggerBranch = swaggerRef || row.swaggerBranch;
  row.swaggerUrl = blobUrl(
    githubRepo,
    swaggerRef || SWAGGER_REF,
    (swaggerFile && swaggerFile.path) || OPENAPI_PATHS[0]
  );
  if (swaggerFile) row.swaggerSource = swaggerRef;
}

function enrichFromGit(catalog) {
  loadHeadsCache();
  const keys = ["soporte", "experiencia", "soporteCanal"];
  for (const key of keys) {
    for (const row of catalog[key]) {
      process.stdout.write("  git " + row.repo + " ... ");
      try {
        const resolved = resolveGithubRepo(row);
        if (!resolved.heads || !resolved.heads.length) {
          row.githubError = "repo-not-found";
          const jarvisAuthor = jarvisLastCommitAuthor(row.jarvisFile);
          applyCommitAuthor(row, jarvisAuthor, "jarvis-git");
          console.log((row.ultimaModificacion || "(sin autor)") + " @ jarvis/" + (row.jarvisFile || "?"));
          continue;
        }
        delete row.githubError;
        const contactRef = pickRef(resolved.heads, CONTACT_REF, [SWAGGER_REF, "master", "main"]);
        const swaggerRef = pickRef(resolved.heads, SWAGGER_REF, [CONTACT_REF, "master", "main"]);
        const contactFile = contactRef ? gitOpenApi(resolved.name, contactRef) : null;
        const swaggerFile = swaggerRef && swaggerRef !== contactRef
          ? gitOpenApi(resolved.name, swaggerRef)
          : contactFile;
        const info = contactFile ? parseOpenApiInfo(contactFile.text) : {};
        const author = contactRef ? gitLastCommitAuthor(resolved.name, contactRef) : { name: "", email: "" };
        applyCommitAuthor(row, author, contactRef || CONTACT_REF);
        applyOpenApiToRow(row, info, swaggerFile || contactFile, contactRef, swaggerRef, resolved.name);
        if (!row.ultimaModificacion) {
          applyCommitAuthor(row, jarvisLastCommitAuthor(row.jarvisFile), "jarvis-git");
        }
        console.log((row.ultimaModificacion || "(sin autor)") + " @ " + resolved.name + "/" + (contactRef || "?"));
      } catch (err) {
        row.githubError = err.status || err.message;
        if (!row.ultimaModificacion) {
          applyCommitAuthor(row, jarvisLastCommitAuthor(row.jarvisFile), "jarvis-git");
        }
        console.log("error: " + err.message);
      }
    }
  }
}

async function enrichFromGitHub(catalog) {
  const keys = ["soporte", "experiencia", "soporteCanal"];
  for (const key of keys) {
    for (const row of catalog[key]) {
      if (row.ultimaModificacion) continue;
      try {
        const contactFile = await findFile(row.repo, [CONTACT_REF], OPENAPI_PATHS);
        if (contactFile) {
          const info = parseOpenApiInfo(contactFile.text);
          applyOpenApiToRow(row, info, null, CONTACT_REF, row.swaggerBranch, row.repo);
        }
        const swaggerFile = await findFile(row.repo, [SWAGGER_REF], OPENAPI_PATHS);
        if (swaggerFile) {
          row.swaggerUrl = blobUrl(row.repo, SWAGGER_REF, swaggerFile.path);
          row.swaggerSource = SWAGGER_REF;
        }
      } catch (err) {
        row.githubError = err.status || err.message;
      }
    }
  }
}

function fillFromLocal(catalog) {
  const rows = loadJarvisInventory().map(localRow).filter((r) => r.kind);
  rows.forEach((row) => catalog[row.kind].push(row));
  catalog.source = "local-jarvis-fallback";
  catalog.error = "GitHub no listó repos de pichincha-peru con este token. Catálogo armado desde jarvis-services-properties.";
  console.log("Fallback local: " + rows.length + " MS");
}

function writeCatalog(payload) {
  const out = path.join(ROOT, "data", "catalog.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(payload, null, 2), "utf8");
  console.log("Wrote " + out);
}

async function main() {
  loadEnv();
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("Falta GITHUB_TOKEN. Crea ms-mbbk-documentation/.env (ver .env.example) y reintenta.");
  }
  const catalog = {
    generatedAt: new Date().toISOString(),
    org: ORG,
    error: null,
    soporte: [],
    experiencia: [],
    soporteCanal: []
  };
  try {
    const repos = (await listOrgRepos()).filter((r) => classify(r.name));
    console.log("Repos MBBK: " + repos.length);
    if (!repos.length) {
      fillFromLocal(catalog);
      enrichFromGit(catalog);
    }
    for (const repo of repos) {
      const kind = classify(repo.name);
      process.stdout.write("  " + repo.name + " -> " + kind + " ... ");
      try {
        const row = await describeRepo(repo);
        catalog[kind].push(row);
        console.log(row.owner || "(sin owner)");
      } catch (err) {
        catalog[kind].push({
          repo: repo.name,
          nombre: titleFromSlug(repo.name.replace(/^(ch|jch|jsc)-mbbk-/i, "")),
          descripcion: descriptionFromSlug(repo.name.replace(/^(ch|jch|jsc)-mbbk-/i, ""), repo.description || ""),
          canal: "MBBK",
          owner: ownerForRow(repo.name, "MBBK"),
          ultimaModificacion: "",
          correo: "",
          version: "",
          swaggerUrl: blobUrl(repo.name, SWAGGER_REF, OPENAPI_PATHS[0]),
          repoUrl: "https://github.com/" + ORG + "/" + repo.name
        });
        console.log("error: " + err.message);
      }
    }
    ["soporte", "experiencia", "soporteCanal"].forEach((key) => {
      catalog[key].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
    });
  } catch (err) {
    catalog.error = err.message;
    console.error("GitHub: " + err.message);
    if (err.status === 401 || err.status === 403 || err.status === 404) {
      console.error("La org pichincha-peru es privada o el token no tiene alcance repo.");
    }
    fillFromLocal(catalog);
    enrichFromGit(catalog);
  }
  writeCatalog(catalog);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
