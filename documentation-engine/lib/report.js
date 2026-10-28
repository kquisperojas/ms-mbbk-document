const { loadShell } = require("./shell");
const { esc } = require("./diagram-viewer");
const { config } = require("./env");

const EXTRA_CSS = `
    details.det-extract { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; margin-top: 12px; }
    details.det-extract summary { cursor: pointer; font-weight: 600; color: var(--bp-blue); }
    details.det-extract h4 { margin: 16px 0 6px; color: var(--bp-blue); }
    details.det-extract p { font-size: 0.92rem; }
    .jira-meta td:first-child { width: 190px; font-weight: 600; color: var(--bp-blue); }
    .tag.new { background: #daeedf; color: #1f7a3a; }
    .tag.pending { background: var(--warn-bg); color: var(--warn); }
    .pruebas-head { margin: 0 0 12px; container-type: inline-size; }
    .pruebas-head h1 { margin: 0 0 6px; }
    .pruebas-lede { margin: 0; line-height: 1.35; white-space: nowrap; max-width: 100%; font-size: min(0.95rem, 1.28cqw); }
    .tests-upload-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; margin: 12px 0 18px; }
    .tests-upload-grid { display: flex; justify-content: space-between; align-items: center; gap: 16px 24px; flex-wrap: wrap; }
    .pruebas-actions-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .tests-upload-card .btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; padding: 8px 14px; font: inherit; font-weight: 700; cursor: pointer; min-height: 38px; }
    .tests-upload-card .btn.secondary { background: #fff; color: var(--bp-blue); border: 1px solid var(--bp-blue); }
    .tests-upload-card .btn.primary { background: var(--bp-yellow); color: var(--bp-blue); border: 1px solid transparent; }
    .tests-upload-card .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .tests-upload-card .tertiary { margin: 8px 0 0; }
    .field-branch { display: flex; flex-direction: row; align-items: center; gap: 10px; min-width: min(280px, 100%); flex: 1; max-width: 520px; }
    .field-branch span { font-weight: 700; color: var(--bp-blue); font-size: 0.92rem; white-space: nowrap; }
    .field-branch input { border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font: inherit; min-height: 38px; height: 38px; background: #fff; flex: 1; min-width: 0; }
    .panel-pruebas td:nth-child(2) { min-width: 280px; }
    .panel-pruebas td:last-child { max-width: 420px; }
`;

const tagClass = { Nuevo: "new", Modificado: "mod", Reutilizado: "reuse", Core: "core" };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const li = (items) => items.map((t) => `<li>${esc(t)}</li>`).join("");
const jsString = (s) => JSON.stringify(String(s)).slice(1, -1);

function primaryMs(analysis) {
  const changed = analysis.microservices.filter((ms) => ms.tag === "Modificado" || ms.tag === "Nuevo");
  return changed.find((ms) => /^j?ch-/.test(ms.name)) || changed[0] || analysis.microservices[0];
}

function pendingList(text) {
  return `<li class="tertiary">${esc(text)}</li>`;
}

function sectionIniciativa(m) {
  const a = m.analysis;
  const jira = m.jira;
  const objective = a.objective || (jira && jira.description.split(/\n\n/)[0]) || a.inScope[0] || "";
  const endpointsRows = a.endpoints
    .map((e) => `<tr><td>${esc(e.method)}</td><td><code>${esc(e.path)}</code></td><td>${esc(e.description || "—")}</td></tr>`)
    .join("");
  const msCards = a.microservices
    .map(
      (ms) =>
        `<div class="card"><span class="tag ${tagClass[ms.tag] || ""}">${esc(ms.tag)}</span><h3>${esc(ms.name)}</h3><p>${esc(ms.context || "Mencionado en el DET.")}</p></div>`
    )
    .join("");
  const children = jira && jira.children.length
    ? `<h2>Historias de la épica</h2>
      <table class="api">
        <thead><tr><th>Clave</th><th>Resumen</th><th>Responsable</th><th>Estado</th></tr></thead>
        <tbody>${jira.children
          .map((c) => `<tr><td><a class="link" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.key)}</a></td><td>${esc(c.summary)}</td><td>${esc(c.assignee)}</td><td>${esc(c.status)}</td></tr>`)
          .join("")}</tbody>
      </table>`
    : "";

  const artefactLinks = [
    `<li>Épica Jira: <a class="link" href="${esc(m.jiraUrl)}" target="_blank" rel="noopener">${esc(m.key)}</a></li>`,
    m.figmaUrl
      ? `<li>Figma: <a class="link" href="${esc(m.figmaUrl)}" target="_blank" rel="noopener">${esc(m.figmaUrl)}</a></li>`
      : pendingList("Figma: no entregado."),
    ...m.attachments.map((f) => `<li><a class="link" href="${esc(f.href)}" download="${esc(f.name)}">${esc(f.name)}</a> <span class="tertiary">· ${esc(f.groupLabel)}</span></li>`),
  ].join("");

  const extract = m.detSections.length
    ? `<details class="det-extract"><summary>Extracto del documento técnico (${esc(m.detName)})</summary>${m.detSections
        .map((s) => `${s.title ? `<h4>${esc(s.title)}</h4>` : ""}${s.items.slice(0, 30).map((p) => `<p>${esc(p.text)}</p>`).join("")}`)
        .join("")}</details>`
    : "";

  return `
    <section id="iniciativa" class="panel active">
      <h1>Iniciativa</h1>
      <p class="lede muted">Qué solicita ${esc(m.key)} según ${m.detName ? "el Documento de Definición Técnica" : "la épica de Jira"} y los artefactos entregados.</p>

      ${objective
        ? `<div class="callout"><strong>Objetivo:</strong> ${esc(objective)}</div>`
        : `<div class="callout warn"><strong>Objetivo pendiente:</strong> no se identificó en el DET ni en la descripción de Jira.</div>`}

      ${jira ? `<h2>Épica en Jira</h2>
      <table class="api jira-meta"><tbody>
        <tr><td>Clave</td><td><a class="link" href="${esc(jira.url)}" target="_blank" rel="noopener">${esc(jira.key)}</a> · ${esc(jira.issueType)}</td></tr>
        <tr><td>Resumen</td><td>${esc(jira.summary)}</td></tr>
        <tr><td>Responsable</td><td>${esc(jira.assignee)}</td></tr>
        <tr><td>Estado</td><td>${esc(jira.status)}</td></tr>
        <tr><td>Creada / resuelta</td><td>${fmtDate(jira.created)} · ${fmtDate(jira.resolutionDate)}</td></tr>
        ${jira.components.length ? `<tr><td>Componentes</td><td>${esc(jira.components.join(", "))}</td></tr>` : ""}
        ${jira.labels.length ? `<tr><td>Etiquetas</td><td>${esc(jira.labels.join(", "))}</td></tr>` : ""}
      </tbody></table>` : `<div class="callout warn"><strong>Jira sin conexión:</strong> no se pudo leer la épica; se documentó solo con los artefactos.</div>`}

      <div class="grid-2" style="margin-top:16px">
        <div class="card"><h3>En alcance</h3><ul class="clean">${a.inScope.length ? li(a.inScope) : pendingList("No identificado en el DET — completar.")}</ul></div>
        <div class="card"><h3>Fuera de alcance</h3><ul class="clean">${a.outScope.length ? li(a.outScope) : pendingList("No identificado en el DET — completar.")}</ul></div>
      </div>

      <h2>Endpoints solicitados (DET)</h2>
      ${endpointsRows
        ? `<table class="api"><thead><tr><th>Método</th><th>Path (DET)</th><th>Descripción</th></tr></thead><tbody>${endpointsRows}</tbody></table>`
        : `<div class="callout warn"><strong>Pendiente:</strong> el DET no expone endpoints reconocibles (método + path).</div>`}

      <h2>Microservicios previstos en arquitectura</h2>
      ${msCards ? `<div class="grid-3">${msCards}</div><p class="tertiary">Clasificación inferida del texto del DET; confirmar con arquitectura.</p>` : `<div class="callout warn"><strong>Pendiente:</strong> no se detectaron microservicios en el DET.</div>`}

      ${children}

      <h2>Artefactos de referencia</h2>
      <ul class="clean">${artefactLinks}</ul>
      ${extract}
    </section>`;
}

function sectionSolucion(m) {
  const a = m.analysis;
  const owner = primaryMs(a);
  const ownerName = owner ? owner.name : "Por definir";
  const supporting = a.microservices.filter((ms) => ms !== owner);

  const endpointRows = a.endpoints
    .map((e) => `<tr><td>${esc(e.method)}</td><td><code>${esc(e.path)}</code></td><td><code>${esc(ownerName)}</code></td></tr>`)
    .join("");

  const contrastSource =
    Array.isArray(m.contrast) && m.contrast.length
      ? m.contrast.map((row) => [row.tema || row[0] || "", row.det || row[1] || "", row.propuesta || row[2] || ""])
      : [
          ["Endpoints", a.endpoints.length ? `${a.endpoints.length} endpoint(s) descritos` : "No especificado", `Exponer en ${ownerName} con contrato OpenAPI-first.`],
          ["Integraciones", supporting.length ? esc(supporting.map((s) => s.name).join(", ")) : "No especificado", "Consumir vía conectores dedicados con timeouts y manejo de errores por servicio."],
          ["Contrato JSON", a.mentions && a.mentions.contract ? "Mencionado en el DET" : "No documentado en DET", "Definir request/response y códigos de error en OpenAPI antes del desarrollo."],
          ["Sesión / seguridad", (a.mentions && (a.mentions.session || a.mentions.security)) ? "Mencionado en el DET" : "No documentado en DET", "Validar headers y sesión en el filtro del canal; no exponer datos sensibles en logs."],
          ["Errores", a.mentions && a.mentions.errors ? "Mencionado en el DET" : "No documentado en DET", "Catálogo de errores de negocio alineado al canal y a los mensajes oficiales."],
        ];
  const contrast = contrastSource.map(([t, det, prop]) => `<tr><td>${esc(t)}</td><td>${esc(det)}</td><td>${esc(prop)}</td></tr>`).join("");

  const chains = m.diagrams
    .filter((d) => d.steps && d.steps.length)
    .map((d, i) => `<div class="card"><h3>${i + 1}) ${esc(d.label)}</h3><ol>${d.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>`)
    .join("");
  const seqLinks = m.diagrams
    .filter((d) => d.kind === "Secuencia" && !(d.steps && d.steps.length))
    .map((d) => `<li>${esc(d.label)} — ver pestaña en <a class="link" href="#diagramas">Diagramas</a></li>`)
    .join("");

  return `
    <section id="solucion" class="panel">
      <h1>Solución</h1>
      <p class="lede muted">Propuesta de solución para ${esc(m.key)} elaborada a partir del DET, la épica y los diagramas entregados.</p>

      ${m.solutionLead
        ? `<div class="callout"><strong>Propuesta:</strong> ${esc(m.solutionLead)}</div>`
        : `<div class="callout warn"><strong>Borrador generado por MBBK-HUB:</strong> valida endpoints, responsables y reglas con el equipo antes de tomarlo como definitivo.</div>`}

      <h2>Endpoints propuestos</h2>
      ${endpointRows
        ? `<table class="api"><thead><tr><th>Método</th><th>Path</th><th>Microservicio responsable</th></tr></thead><tbody>${endpointRows}</tbody></table>`
        : `<div class="callout warn"><strong>Pendiente:</strong> sin endpoints en el DET; definir contrato.</div>`}

      <h2>Contraste DET vs propuesta</h2>
      <table class="contrast"><thead><tr><th>Tema</th><th>DET / arquitectura</th><th>Propuesta</th></tr></thead><tbody>${contrast}</tbody></table>

      <h2>Cadenas de llamada</h2>
      ${chains ? `<div class="grid-2">${chains}</div>` : ""}
      ${seqLinks ? `<ul class="clean">${seqLinks}</ul>` : ""}
      ${!chains && !seqLinks ? `<div class="callout warn"><strong>Pendiente:</strong> sin diagramas de secuencia para derivar las cadenas.</div>` : ""}

      <h2>Reglas de negocio clave</h2>
      ${a.rules.length ? `<ul class="clean">${li(a.rules)}</ul>` : `<div class="callout warn"><strong>Pendiente:</strong> el DET no tiene una sección de reglas reconocible.</div>`}

      <h2>Componentes principales</h2>
      <p class="mono">${a.microservices.length ? esc(a.microservices.map((ms) => ms.name).join(" · ")) : "Por definir"}</p>

      ${a.risks.length ? `<div class="callout warn"><strong>Riesgos / dependencias del DET:</strong><ul class="clean">${li(a.risks)}</ul></div>` : ""}
    </section>`;
}

function sectionDiagramas(m) {
  const a = m.analysis;
  const cards = a.microservices
    .map(
      (ms) => `<div class="card"><span class="tag ${tagClass[ms.tag] || ""}">${esc(ms.tag)}</span><h3>${esc(ms.name)}</h3>
          <p><strong>Qué hace:</strong> ${esc(ms.context || "Mencionado en el DET.")}</p>
          <p><strong>Para qué lo usamos:</strong> participa en el flujo de ${esc(m.key)} según la arquitectura entregada.</p></div>`
    )
    .join("");
  const tabs = m.diagrams
    .map((d, i) => `<button type="button" data-diagram="${esc(d.id)}"${i === 0 ? ' class="active"' : ""}>${esc(d.kind)} · ${esc(d.label)}</button>`)
    .join("");
  const views = m.diagrams
    .map(
      (d, i) => `<div class="diagram-view${i === 0 ? " active" : ""}" data-diagram-panel="${esc(d.id)}">
        <p class="tertiary">${esc(d.description)}</p>
        <iframe class="diagram-frame" title="${esc(d.label)}" src="${esc(d.src)}" loading="lazy"></iframe>
      </div>`
    )
    .join("");
  const pending = m.pendingDiagrams
    .map((p) => `<div class="callout warn"><strong>Pendiente de diagrama:</strong> ${esc(p)}.</div>`)
    .join("");

  return `
    <section id="diagramas" class="panel">
      <h1>Diagramas</h1>
      <p class="lede muted">Arquitectura y secuencias de ${esc(m.key)} en visores Archify. Cada microservicio indica qué hace y para qué se usa.</p>

      ${cards ? `<h2>Microservicios y componentes</h2><div class="grid-2 ms-list">${cards}</div>` : ""}

      <h2>Visores Archify</h2>
      ${tabs ? `<div class="diagram-tabs" id="diagram-tabs">${tabs}</div>${views}` : '<div class="diagram-tabs" id="diagram-tabs"></div>'}
      ${pending}

      <p class="tertiary" style="margin-top:12px;">También puedes abrir cada diagrama en pestaña nueva desde la carpeta <code>diagrams/</code>. Los diagramas entregados como imagen usan el visor Archify (zoom, tema, exportar); adjunta el <code>candidate.json</code> para obtener el diagrama Archify interactivo.</p>
    </section>`;
}

function pruebasLede() {
  return `<p class="pruebas-lede muted">Si en la primera generación no adjuntaste el Excel, súbelo aquí e indica el link de la rama feature de la solución para contrastar los casos de prueba con el código.</p>`;
}

function testsUploadBlock(m) {
  return `
      <div class="tests-upload-card" data-doc-key="${esc(m.key)}">
        <div class="tests-upload-grid">
          <div class="pruebas-actions-row">
            <label class="btn secondary">Elegir Excel o CSV
              <input id="tests-file" type="file" accept=".csv,.txt,.xlsx" hidden />
            </label>
            <button type="button" class="btn primary" id="tests-upload-btn" disabled>Regenerar pruebas</button>
          </div>
          <label class="field-branch">
            <span>Rama Feature</span>
            <input id="tests-branch" type="url" placeholder="https://github.com/org/repo/tree/feature/..." value="${esc(m.featureBranchUrl || "")}" />
          </label>
        </div>
        <p class="tertiary" id="tests-file-name">Ningún archivo seleccionado.</p>
        <div class="callout warn" id="tests-upload-error" hidden style="margin-top:12px"></div>
      </div>`;
}

function sectionPruebas(m) {
  if (!m.cases || !m.cases.length) {
    return `
    <section id="pruebas" class="panel panel-pruebas">
      <div class="pruebas-head">
        <h1>Pruebas</h1>
        ${pruebasLede()}
      </div>
      ${testsUploadBlock(m)}
      <div class="callout warn">
        <strong>Pendientes:</strong> escenarios de prueba no entregados.
        Esta sección se completa cuando se entreguen todos los escenarios.
      </div>
      <div class="stats">
        <div class="stat"><strong>0</strong><span>Cumplen</span></div>
        <div class="stat"><strong>0</strong><span>Parciales</span></div>
        <div class="stat"><strong>0</strong><span>No cumplen</span></div>
        <div class="stat"><strong>—</strong><span>Cobertura</span></div>
      </div>
    </section>`;
  }
  const count = (r) => m.cases.filter((c) => c.result === r).length;
  const total = m.cases.length;
  const ok = count("Cumple");
  return `
    <section id="pruebas" class="panel panel-pruebas">
      <div class="pruebas-head">
        <h1>Pruebas</h1>
        ${pruebasLede()}
      </div>
      ${testsUploadBlock(m)}
      <p class="muted">Catálogo de ${total} casos de prueba entregados para ${esc(m.key)}.</p>
      ${
        m.featureBranchUrl
          ? `<div class="callout"><strong>Validación de código:</strong> contrastado con <a class="link" href="${esc(m.featureBranchUrl)}" target="_blank" rel="noopener">${esc(m.featureBranch || m.featureBranchUrl)}</a>${m.testsValidatedAt ? ` · ${esc(m.testsValidatedAt)}` : ""}.</div>`
          : ""
      }
      <div class="stats">
        <div class="stat success"><strong>${ok}</strong><span>Cumplen</span></div>
        <div class="stat warn"><strong>${count("Parcial")}</strong><span>Parciales</span></div>
        <div class="stat danger"><strong>${count("No cumple")}</strong><span>No cumplen</span></div>
        <div class="stat"><strong>${count("Pendiente")}</strong><span>Pendientes</span></div>
        <div class="stat"><strong>${Math.round((ok / total) * 100)}%</strong><span>Cobertura (${ok} de ${total})</span></div>
      </div>
      <div class="usage">
        <div class="usage-labels"><span>${ok} de ${total} cumplen</span><span>${total - ok} restantes</span></div>
        <div class="usage-track"><div class="usage-seg green" style="width:${((ok / total) * 100).toFixed(1)}%"></div></div>
      </div>
      <div class="filters-block"><div class="filters-label">Resultado</div><div class="filters" id="filter-result"></div></div>
      <div style="margin-top:18px">
        <h2>Detalle de casos</h2>
        <p class="tertiary" id="table-caption"></p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Caso de prueba</th><th>Resultado</th><th>Evidencia</th></tr></thead>
            <tbody id="cases-body"></tbody>
          </table>
        </div>
        <div class="empty" id="empty" hidden>Ningún caso coincide con los filtros.</div>
      </div>
    </section>`;
}

function pruebasScript(cases, key) {
  const upload = `
    (function () {
      const input = document.getElementById("tests-file");
      const btn = document.getElementById("tests-upload-btn");
      const nameEl = document.getElementById("tests-file-name");
      const errEl = document.getElementById("tests-upload-error");
      const branchEl = document.getElementById("tests-branch");
      if (!input || !btn) return;
      const key = ${JSON.stringify(key)};
      const syncBtn = () => {
        const file = input.files && input.files[0];
        const branch = branchEl && branchEl.value.trim();
        btn.disabled = !file || !branch;
      };
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        nameEl.textContent = file ? file.name : "Ningún archivo seleccionado.";
        errEl.hidden = true;
        syncBtn();
      });
      if (branchEl) branchEl.addEventListener("input", syncBtn);
      syncBtn();
      btn.addEventListener("click", async () => {
        const file = input.files && input.files[0];
        const branch = branchEl && branchEl.value.trim();
        if (!file) return;
        if (!branch) {
          errEl.hidden = false;
          errEl.innerHTML = "<strong>Falta la rama feature:</strong> pega el link de GitHub de la rama de tu solución.";
          return;
        }
        errEl.hidden = true;
        btn.disabled = true;
        btn.textContent = "Validando código…";
        try {
          const form = new FormData();
          form.append("tests", file);
          form.append("featureBranch", branch);
          const res = await fetch("/api/v1/docs/" + encodeURIComponent(key) + "/tests", { method: "POST", body: form });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || data.detail || "No se pudieron regenerar las pruebas.");
          location.hash = "pruebas";
          location.reload();
        } catch (e) {
          errEl.hidden = false;
          errEl.innerHTML = "<strong>No se pudo actualizar:</strong> " + (e.message || e);
          btn.disabled = false;
          btn.textContent = "Regenerar pruebas";
        }
      });
    })();
  `;
  if (!cases || !cases.length) return upload;
  return `
    /* Pruebas */
    const CASES = ${JSON.stringify(cases).replace(/</g, "\\u003c")};
    const RESULTS = ["Todos", "Cumple", "Parcial", "No cumple", "Pendiente"];
    const state = { result: "Todos" };
    const escHtml = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const badge = (r) => (r === "Cumple" ? "success" : r === "Parcial" || r === "Pendiente" ? "warn" : "danger");
    const tone = (r) => (r === "Cumple" ? "tone-success" : r === "Parcial" || r === "Pendiente" ? "tone-warning" : "tone-danger");
    function pills(rootId, items, key) {
      const root = document.getElementById(rootId);
      root.innerHTML = items.map((i) => '<button type="button" class="pill' + (state[key] === i ? " active" : "") + '" data-value="' + escHtml(i) + '">' + escHtml(i) + "</button>").join("");
      root.querySelectorAll(".pill").forEach((b) => b.addEventListener("click", () => { state[key] = b.getAttribute("data-value"); renderCases(); }));
    }
    function renderCases() {
      pills("filter-result", RESULTS, "result");
      const rows = CASES.filter((c) => state.result === "Todos" || c.result === state.result);
      document.getElementById("table-caption").textContent = rows.length + " de " + CASES.length + " casos";
      const body = document.getElementById("cases-body");
      const table = body.closest("table");
      table.hidden = rows.length === 0;
      document.getElementById("empty").hidden = rows.length !== 0;
      body.innerHTML = rows.map((c) => '<tr class="' + tone(c.result) + '"><td class="id">' + escHtml(c.id) + "</td><td>" + escHtml(c.title) + '</td><td><span class="badge ' + badge(c.result) + '">' + escHtml(c.result) + "</span></td><td>" + escHtml(c.evidence) + "</td></tr>").join("");
    }
    renderCases();
    ${upload}
`;
}

function buildReport(m) {
  const { css, navScript } = loadShell();
  const docsRootParts = config.DOCS_ROOT.split(/[\\/]+/).filter(Boolean);
  const fileUrlBase = "file:///" + [...docsRootParts, m.key, `informe-${m.key}.html`].join("/");
  const script = navScript
    .replace("NEG-1678 · Estado de Cuenta", jsString(`${m.key} · ${m.title}`))
    .replace(/\["C:", "WORKSPACE", "DOCUMENTACION", "NEG-1678", "informe-NEG-1678.html"\]/, JSON.stringify([...docsRootParts, m.key, `informe-${m.key}.html`]))
    .replace(/"file:\/\/\/C:\/WORKSPACE\/DOCUMENTACION\/NEG-1678\/informe-NEG-1678.html"/, JSON.stringify(fileUrlBase))
    .replaceAll("NEG-1678", m.key);

  const shareItem = (id, label) => `
          <div class="share-item" role="none">
            <button type="button" class="share-section" data-section="${id}" role="menuitem" aria-haspopup="true">${label} <span class="arrow">›</span></button>
            <div class="share-submenu" data-submenu="${id}" role="menu"></div>
          </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(m.key)} — ${esc(m.title)} | Documentación</title>
  <style>${css}${EXTRA_CSS}  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <strong>${esc(m.key)} · ${esc(m.title)}</strong>
        <span>Documentación técnica · ${esc(m.subtitle)}</span>
      </div>
      <nav class="nav" aria-label="Secciones">
        <button type="button" data-section="iniciativa" class="active">Iniciativa</button>
        <button type="button" data-section="solucion">Solución</button>
        <button type="button" data-section="diagramas">Diagramas</button>
        <button type="button" data-section="pruebas">Pruebas</button>
      </nav>
      <div class="share-wrap" id="share-wrap">
        <button type="button" class="share-btn" id="share-btn" aria-expanded="false" aria-haspopup="true" aria-controls="share-menu">
          Compartir <span class="chevron" aria-hidden="true">▼</span>
        </button>
        <div class="share-menu" id="share-menu" role="menu" hidden>${shareItem("iniciativa", "Iniciativa")}${shareItem("solucion", "Solución")}${shareItem("diagramas", "Diagramas")}${shareItem("pruebas", "Pruebas")}
        </div>
      </div>
    </div>
  </header>

  <main>
    <!-- INICIATIVA -->${sectionIniciativa(m)}

    <!-- SOLUCION -->${sectionSolucion(m)}

    <!-- DIAGRAMAS -->${sectionDiagramas(m)}

    <!-- PRUEBAS -->${sectionPruebas(m)}

    <footer class="note">
      Portal ${esc(m.key)} · generado por MBBK-HUB desde Jira + DET + insumos (${esc(m.generatedAt)}) · diagramas en <code>diagrams/</code> · artefactos en <code>artefactos/</code>.
    </footer>
  </main>

  <div class="toast" id="toast">Enlace copiado</div>

  <script>${script}${pruebasScript(m.cases, m.key)}
  </script>
</body>
</html>
`;
}

module.exports = { buildReport, primaryMs };
