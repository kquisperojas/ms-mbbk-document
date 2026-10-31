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
    .pruebas-lede { margin: 0; line-height: 1.35; max-width: 100%; }
    html { scroll-padding-top: 120px; }
    .section-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin: 0 0 16px; flex-wrap: nowrap; }
    .section-toolbar > div { flex: 1 1 auto; min-width: 0; }
    .section-toolbar h1 { margin: 0 0 6px; }
    .section-toolbar .lede { margin: 0; max-width: 52rem; }
    .reprocess-open { flex: 0 0 auto; min-width: 148px; margin-top: 2px; }
    .panel-pruebas td:nth-child(2) { min-width: 280px; }
    .panel-pruebas td:last-child { max-width: 420px; }
    .btn {
      border: 0;
      border-radius: 8px;
      padding: 11px 18px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn.primary { background: var(--bp-yellow); color: var(--bp-blue); }
    .btn.primary:hover { background: var(--bp-yellow-dark); }
    .btn.secondary { background: var(--bp-blue); color: #fff; box-shadow: inset 0 -2px 0 var(--bp-yellow); }
    .btn.secondary:hover { background: var(--bp-blue-dark); }
    .btn[disabled] { opacity: 0.6; cursor: progress; }
    .reprocess-field { margin: 0 0 14px; text-align: left; }
    .reprocess-field > label:not(.btn), .reprocess-field .label { display: block; font-size: 0.82rem; font-weight: 700; color: var(--bp-blue); margin-bottom: 6px; }
    .reprocess-field input[type="url"], .reprocess-field input[type="text"] { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 11px 12px; font: inherit; }
    .reprocess-check { display: flex; align-items: flex-start; gap: 10px; text-align: left; font-weight: 600; color: var(--bp-blue); margin: 4px 0 8px; }
    .reprocess-check input { margin-top: 3px; }
    .reprocess-file { display: inline-flex; }
    .reprocess-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--border); }
    .reprocess-actions .btn { width: auto; min-width: 132px; flex: 0 0 auto; }
    .tests-overlay {
      position: fixed;
      inset: 0;
      background: rgba(10, 28, 68, 0.55);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 400;
    }
    .tests-overlay.show { display: flex; }
    .tests-overlay[hidden] { display: none !important; }
    .tests-modal {
      width: min(560px, 100%);
      max-height: min(90vh, 760px);
      overflow: auto;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px 26px 24px;
      text-align: left;
      box-shadow: 0 16px 40px rgba(3, 16, 45, 0.28);
    }
    .tests-modal h2 { margin: 0 0 8px; color: var(--bp-blue); }
    .tests-modal p { margin: 0 0 8px; }
    .tests-modal .busy { text-align: center; padding: 12px 0 4px; }
    .tests-spinner {
      width: 44px;
      height: 44px;
      border: 4px solid #e9ecf3;
      border-top-color: var(--bp-blue);
      border-radius: 50%;
      animation: tests-spin 0.9s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes tests-spin { to { transform: rotate(360deg); } }
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

function sectionToolbar(title, lede, section) {
  return `
      <div class="section-toolbar">
        <div>
          <h1>${title}</h1>
          ${lede}
        </div>
        <button type="button" class="btn primary reprocess-open" data-section="${section}">Reprocesar</button>
      </div>`;
}

function sectionIniciativa(m) {
  const a = m.analysis;
  const jira = m.jira && String(m.jira.summary || "").trim() ? m.jira : null;
  const objective = a.objective || (jira && String(jira.description || "").split(/\n\n/)[0]) || a.inScope[0] || "";
  const endpointsRows = a.endpoints
    .map((e) => `<tr><td>${esc(e.method)}</td><td><code>${esc(e.path)}</code></td><td>${esc(e.description || "—")}</td></tr>`)
    .join("");
  const msCards = a.microservices
    .map(
      (ms) =>
        `<div class="card"><span class="tag ${tagClass[ms.tag] || ""}">${esc(ms.tag)}</span><h3>${esc(ms.name)}</h3><p>${esc(ms.context || "Mencionado en el DET.")}</p></div>`
    )
    .join("");
  const children = jira && Array.isArray(jira.children) && jira.children.length
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
      ${sectionToolbar(
        "Iniciativa",
        `<p class="lede muted">Qué solicita ${esc(m.key)} según ${m.detName ? "el Documento de Definición Técnica" : "la épica de Jira"} y los artefactos entregados.</p>`,
        "iniciativa"
      )}

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
      ${sectionToolbar(
        "Diagramas",
        `<p class="lede muted">Arquitectura y secuencias de ${esc(m.key)}. Cada microservicio indica qué hace y para qué se usa.</p>`,
        "diagramas"
      )}

      ${cards ? `<h2>Microservicios y componentes</h2><div class="grid-2 ms-list">${cards}</div>` : ""}

      <h2>Visores</h2>
      ${tabs ? `<div class="diagram-tabs" id="diagram-tabs">${tabs}</div>${views}` : '<div class="diagram-tabs" id="diagram-tabs"></div>'}
      ${pending}

      <p class="tertiary" style="margin-top:12px;">Sin el check de Archify se publican las imágenes adjuntas. Si lo marcas, el portal reconstruye un diagrama Archify interactivo a partir de la imagen.</p>
    </section>`;
}

function pruebasLede() {
  return `<p class="lede muted pruebas-lede">Catálogo de casos de prueba. Usa <strong>Reprocesar</strong> para adjuntar el Excel y contrastarlos con la rama feature.</p>`;
}

function sectionPruebas(m) {
  const head = sectionToolbar("Pruebas", pruebasLede(), "pruebas");
  if (!m.cases || !m.cases.length) {
    return `
    <section id="pruebas" class="panel panel-pruebas">
      ${head}
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
      ${head}
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

function reprocessScript(m) {
  return `
    (function () {
      const key = ${JSON.stringify(m.key)};
      const defaults = {
        jiraUrl: ${JSON.stringify(m.jiraUrl || "")},
        featureBranch: ${JSON.stringify(m.featureBranchUrl || "")}
      };
      const overlay = document.getElementById("reprocess-overlay");
      const formBox = document.getElementById("reprocess-form");
      const busyBox = document.getElementById("reprocess-busy");
      const fields = document.getElementById("reprocess-fields");
      const titleEl = document.getElementById("reprocess-title");
      const ledeEl = document.getElementById("reprocess-lede");
      const errEl = document.getElementById("reprocess-error");
      const busyTitle = document.getElementById("reprocess-busy-title");
      const busyText = document.getElementById("reprocess-busy-text");
      const submitBtn = document.getElementById("reprocess-submit");
      if (!overlay || !formBox || !fields) return;
      const sections = {
        iniciativa: {
          title: "Reprocesar iniciativa",
          lede: "Adjunta el documento técnico y el link de la épica.",
          busy: "Se está reprocesando la iniciativa para su validación.",
          hash: "iniciativa",
          endpoint: "/iniciativa",
          fields: '<div class="reprocess-field"><span class="label">Documento técnico (DET)</span><label class="btn secondary reprocess-file">Elegir DET<input id="rp-det" type="file" accept=".docx,.pdf" hidden /></label><p class="tertiary" id="rp-det-name">Ningún archivo seleccionado.</p></div><div class="reprocess-field"><label for="rp-link">Link de la épica</label><input id="rp-link" type="url" placeholder="https://pichinchaperu.atlassian.net/browse/' + key + '" value="' + (defaults.jiraUrl || "") + '" /></div>'
        },
        diagramas: {
          title: "Reprocesar diagramas",
          lede: "Adjunta secuencia y/o arquitectura. Archify es opcional.",
          busy: "Se están reprocesando los diagramas para su validación.",
          hash: "diagramas",
          endpoint: "/diagramas",
          fields: '<div class="reprocess-field"><span class="label">Diagramas de secuencia</span><label class="btn secondary reprocess-file">Elegir secuencia<input id="rp-seq" type="file" accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.json" multiple hidden /></label><p class="tertiary" id="rp-seq-name">Ningún archivo seleccionado.</p></div><div class="reprocess-field"><span class="label">Arquitectura</span><label class="btn secondary reprocess-file">Elegir arquitectura<input id="rp-arch" type="file" accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.json" multiple hidden /></label><p class="tertiary" id="rp-arch-name">Ningún archivo seleccionado.</p></div><label class="reprocess-check"><input id="rp-archify" type="checkbox" /><span>¿Quieres generar diagramas Archify?</span></label><p class="tertiary">Opcional. Si lo marcas, Archify reconstruye el diagrama a partir de la imagen (XML de draw.io embebido o el DET). Si no, se publica la imagen tal cual.</p>'
        },
        pruebas: {
          title: "Reprocesar pruebas",
          lede: "Adjunta el Excel o CSV y el link de la rama feature.",
          busy: "Se están reprocesando las pruebas para su validación.",
          hash: "pruebas",
          endpoint: "/tests",
          fields: '<div class="reprocess-field"><span class="label">Excel o CSV de casos</span><label class="btn secondary reprocess-file">Elegir Excel o CSV<input id="rp-tests" type="file" accept=".csv,.txt,.xlsx" hidden /></label><p class="tertiary" id="rp-tests-name">Ningún archivo seleccionado.</p></div><div class="reprocess-field"><label for="rp-branch">Rama Feature</label><input id="rp-branch" type="url" placeholder="https://github.com/org/repo/tree/feature/..." value="' + (defaults.featureBranch || "") + '" /></div>'
        }
      };
      let current = "pruebas";
      const fileNames = (input) => {
        if (!input || !input.files || !input.files.length) return "Ningún archivo seleccionado.";
        return Array.from(input.files).map((f) => f.name).join(", ");
      };
      const bindNames = () => {
        [["rp-det","rp-det-name"],["rp-seq","rp-seq-name"],["rp-arch","rp-arch-name"],["rp-tests","rp-tests-name"]].forEach(([id, nameId]) => {
          const input = document.getElementById(id);
          const label = document.getElementById(nameId);
          if (!input || !label) return;
          input.addEventListener("change", () => { label.textContent = fileNames(input); errEl.hidden = true; });
        });
      };
      const show = (on) => {
        overlay.hidden = !on;
        overlay.classList.toggle("show", on);
        if (!on) {
          formBox.hidden = false;
          busyBox.hidden = true;
          submitBtn.disabled = false;
        }
      };
      const open = (section) => {
        const cfg = sections[section];
        if (!cfg) return;
        current = section;
        titleEl.textContent = cfg.title;
        ledeEl.textContent = cfg.lede;
        fields.innerHTML = cfg.fields;
        errEl.hidden = true;
        errEl.textContent = "";
        formBox.hidden = false;
        busyBox.hidden = true;
        bindNames();
        show(true);
      };
      document.querySelectorAll(".reprocess-open").forEach((btn) => {
        btn.addEventListener("click", () => open(btn.getAttribute("data-section")));
      });
      document.getElementById("reprocess-cancel").addEventListener("click", () => show(false));
      overlay.addEventListener("click", (e) => { if (e.target === overlay && busyBox.hidden) show(false); });
      formBox.addEventListener("submit", async (event) => {
        event.preventDefault();
        const cfg = sections[current];
        const form = new FormData();
        try {
          if (current === "iniciativa") {
            const det = document.getElementById("rp-det");
            const link = (document.getElementById("rp-link") || {}).value || "";
            if (!det || !det.files || !det.files[0]) throw new Error("Adjunta el documento técnico (DET).");
            if (!link.trim()) throw new Error("Indica el link de la épica.");
            form.append("det", det.files[0]);
            form.append("link", link.trim());
          } else if (current === "diagramas") {
            const seq = document.getElementById("rp-seq");
            const arch = document.getElementById("rp-arch");
            const seqFiles = seq && seq.files ? Array.from(seq.files) : [];
            const archFiles = arch && arch.files ? Array.from(arch.files) : [];
            if (!seqFiles.length && !archFiles.length) throw new Error("Adjunta diagramas de secuencia y/o arquitectura.");
            seqFiles.forEach((f) => form.append("sequence", f));
            archFiles.forEach((f) => form.append("architecture", f));
            if (document.getElementById("rp-archify") && document.getElementById("rp-archify").checked) form.append("useArchify", "true");
          } else {
            const tests = document.getElementById("rp-tests");
            const branch = (document.getElementById("rp-branch") || {}).value || "";
            if (!tests || !tests.files || !tests.files[0]) throw new Error("Adjunta el Excel o CSV de casos de prueba.");
            if (!branch.trim()) throw new Error("Indica el link de la rama feature.");
            form.append("tests", tests.files[0]);
            form.append("featureBranch", branch.trim());
          }
        } catch (e) {
          errEl.hidden = false;
          errEl.innerHTML = "<strong>Falta un dato:</strong> " + (e.message || e);
          return;
        }
        errEl.hidden = true;
        formBox.hidden = true;
        busyBox.hidden = false;
        busyTitle.textContent = cfg.title.replace("Reprocesar", "Reprocesando");
        busyText.textContent = cfg.busy;
        submitBtn.disabled = true;
        try {
          const res = await fetch("/api/v1/docs/" + encodeURIComponent(key) + cfg.endpoint, { method: "POST", body: form });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || data.detail || "No se pudo reprocesar la sección.");
          location.hash = cfg.hash;
          location.reload();
        } catch (e) {
          formBox.hidden = false;
          busyBox.hidden = true;
          submitBtn.disabled = false;
          errEl.hidden = false;
          errEl.innerHTML = "<strong>No se pudo actualizar:</strong> " + (e.message || e);
        }
      });
    })();
  `;
}

function wordDownloadScript() {
  return `
    (function () {
      const btn = document.getElementById("share-word");
      const menu = document.getElementById("share-menu");
      if (!btn) return;
      const requestWord = (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (menu) {
          menu.classList.remove("open");
          menu.hidden = true;
        }
        const shareBtn = document.getElementById("share-btn");
        if (shareBtn) shareBtn.setAttribute("aria-expanded", "false");
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: "mbbk-download-word" }, window.parent.location.origin || "*");
            return;
          }
        } catch (_) {
          try { window.parent.postMessage({ type: "mbbk-download-word" }, "*"); return; } catch (e) {}
        }
        const toast = document.getElementById("toast");
        if (toast) {
          toast.textContent = "Abre el informe desde el portal para descargar el Word.";
          toast.classList.add("show");
          setTimeout(() => toast.classList.remove("show"), 2800);
        }
      };
      btn.addEventListener("click", requestWord);
      if (menu) {
        menu.addEventListener("click", (event) => {
          const target = event.target && event.target.closest ? event.target.closest("#share-word, .share-word") : null;
          if (target) requestWord(event);
        }, true);
      }
    })();
  `;
}

function pruebasScript(cases, m) {
  const reprocess = reprocessScript(m);
  if (!cases || !cases.length) return reprocess;
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
      if (!root) return;
      root.innerHTML = items.map((i) => '<button type="button" class="pill' + (state[key] === i ? " active" : "") + '" data-value="' + escHtml(i) + '">' + escHtml(i) + "</button>").join("");
      root.querySelectorAll(".pill").forEach((b) => b.addEventListener("click", () => { state[key] = b.getAttribute("data-value"); renderCases(); }));
    }
    function renderCases() {
      pills("filter-result", RESULTS, "result");
      const rows = CASES.filter((c) => state.result === "Todos" || c.result === state.result);
      const caption = document.getElementById("table-caption");
      const body = document.getElementById("cases-body");
      if (!body) return;
      if (caption) caption.textContent = rows.length + " de " + CASES.length + " casos";
      const table = body.closest("table");
      if (table) table.hidden = rows.length === 0;
      const empty = document.getElementById("empty");
      if (empty) empty.hidden = rows.length !== 0;
      body.innerHTML = rows.map((c) => '<tr class="' + tone(c.result) + '"><td class="id">' + escHtml(c.id) + "</td><td>" + escHtml(c.title) + '</td><td><span class="badge ' + badge(c.result) + '">' + escHtml(c.result) + "</span></td><td>" + escHtml(c.evidence) + "</td></tr>").join("");
    }
    renderCases();
    ${reprocess}
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
          <div class="share-item" role="none">
            <button type="button" class="share-section share-word" id="share-word" role="menuitem">Descargar Word</button>
          </div>
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

  <div class="tests-overlay" id="reprocess-overlay" hidden>
    <div class="tests-modal" role="dialog" aria-modal="true" aria-labelledby="reprocess-title">
      <form id="reprocess-form" novalidate>
        <h2 id="reprocess-title">Reprocesar</h2>
        <p class="muted" id="reprocess-lede"></p>
        <div id="reprocess-fields"></div>
        <div class="callout warn" id="reprocess-error" hidden style="margin-top:12px"></div>
        <div class="reprocess-actions">
          <button type="button" class="btn secondary" id="reprocess-cancel">Cancelar</button>
          <button type="submit" class="btn primary" id="reprocess-submit">Reprocesar</button>
        </div>
      </form>
      <div id="reprocess-busy" class="busy" hidden>
        <div class="tests-spinner" aria-hidden="true"></div>
        <h2 id="reprocess-busy-title">Reprocesando</h2>
        <p id="reprocess-busy-text">Se está reprocesando la sección para su validación.</p>
      </div>
    </div>
  </div>

  <script>${script}${pruebasScript(m.cases, m)}${wordDownloadScript()}
  </script>
</body>
</html>
`;
}

module.exports = { buildReport, primaryMs };
