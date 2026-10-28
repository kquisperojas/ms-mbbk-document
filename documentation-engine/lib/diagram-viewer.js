const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Visor standalone para diagramas entregados como imagen, con la paleta
 * dark/light, grilla y barra de herramientas de los viewers Archify.
 */
function imageViewerHtml({ title, subtitle, imageSrc, kind }) {
  return `<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} · Archify</title>
<style>
  :root, [data-theme="dark"] {
    --bg: #020617; --grid: #1e293b; --panel: rgba(15, 23, 42, 0.86); --panel-border: #334155;
    --text: #ffffff; --text-muted: #94a3b8; --accent: #38bdf8; --sheet: #ffffff;
  }
  [data-theme="light"] {
    --bg: #f4f5f7; --grid: #e9edf2; --panel: rgba(255, 255, 255, 0.92); --panel-border: #d5dbe4;
    --text: #111827; --text-muted: #5b6474; --accent: #0f265c; --sheet: #ffffff;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; overflow: hidden; }
  body {
    font-family: "Inter", "Segoe UI", system-ui, sans-serif;
    background-color: var(--bg);
    background-image:
      linear-gradient(var(--grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid) 1px, transparent 1px);
    background-size: 28px 28px;
    color: var(--text);
  }
  header {
    position: fixed; top: 14px; left: 14px; right: 14px; z-index: 5;
    display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;
    pointer-events: none;
  }
  .title, .tools {
    pointer-events: auto;
    background: var(--panel); border: 1px solid var(--panel-border); border-radius: 12px;
    backdrop-filter: blur(8px); padding: 10px 14px;
  }
  .title strong { display: block; font-size: 0.98rem; }
  .title span { font-size: 0.78rem; color: var(--text-muted); }
  .kind {
    display: inline-block; margin-right: 6px; padding: 1px 8px; border-radius: 999px;
    font-size: 0.68rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
    background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent);
  }
  .tools { display: flex; gap: 6px; align-items: center; }
  .tools button, .tools a {
    font: inherit; font-size: 0.82rem; color: var(--text); text-decoration: none;
    background: transparent; border: 1px solid var(--panel-border); border-radius: 8px;
    padding: 6px 10px; cursor: pointer;
  }
  .tools button:hover, .tools a:hover { border-color: var(--accent); color: var(--accent); }
  .zoom { min-width: 48px; text-align: center; font-size: 0.8rem; color: var(--text-muted); }
  #stage { position: absolute; inset: 0; cursor: grab; }
  #stage.dragging { cursor: grabbing; }
  #sheet {
    position: absolute; top: 0; left: 0; transform-origin: 0 0;
    background: var(--sheet); border-radius: 12px; padding: 18px;
    box-shadow: 0 0 0 1px var(--panel-border), 0 24px 60px rgba(2, 6, 23, 0.45);
  }
  #sheet img { display: block; max-width: none; user-select: none; -webkit-user-drag: none; }
  footer {
    position: fixed; bottom: 12px; left: 14px; font-size: 0.74rem; color: var(--text-muted);
    background: var(--panel); border: 1px solid var(--panel-border); border-radius: 8px; padding: 6px 10px;
  }
</style>
</head>
<body>
<header>
  <div class="title">
    <strong>${esc(title)}</strong>
    <span><span class="kind">${esc(kind)}</span>${esc(subtitle)}</span>
  </div>
  <div class="tools">
    <button type="button" id="zoom-out" title="Alejar">−</button>
    <span class="zoom" id="zoom-label">100%</span>
    <button type="button" id="zoom-in" title="Acercar">+</button>
    <button type="button" id="fit">Ajustar</button>
    <button type="button" id="theme">Tema</button>
    <a href="${esc(imageSrc)}" target="_blank" rel="noopener">Original</a>
    <a href="${esc(imageSrc)}" download>Exportar</a>
  </div>
</header>
<div id="stage"><div id="sheet"><img id="img" src="${esc(imageSrc)}" alt="${esc(title)}" /></div></div>
<footer>Visor Archify · arrastra para mover · rueda para zoom · tecla F para ajustar</footer>
<script>
  const stage = document.getElementById("stage");
  const sheet = document.getElementById("sheet");
  const img = document.getElementById("img");
  const label = document.getElementById("zoom-label");
  const view = { x: 0, y: 0, k: 1 };
  function apply() {
    sheet.style.transform = "translate(" + view.x + "px," + view.y + "px) scale(" + view.k + ")";
    label.textContent = Math.round(view.k * 100) + "%";
  }
  function fit() {
    const w = sheet.offsetWidth, h = sheet.offsetHeight;
    const vw = stage.clientWidth, vh = stage.clientHeight - 90;
    view.k = Math.min(vw / w, vh / h, 2) * 0.94;
    view.x = (vw - w * view.k) / 2;
    view.y = 80 + (vh - h * view.k) / 2;
    apply();
  }
  function zoomAt(factor, cx, cy) {
    const k = Math.min(8, Math.max(0.1, view.k * factor));
    view.x = cx - (cx - view.x) * (k / view.k);
    view.y = cy - (cy - view.y) * (k / view.k);
    view.k = k;
    apply();
  }
  const center = () => [stage.clientWidth / 2, stage.clientHeight / 2];
  document.getElementById("zoom-in").onclick = () => zoomAt(1.2, ...center());
  document.getElementById("zoom-out").onclick = () => zoomAt(1 / 1.2, ...center());
  document.getElementById("fit").onclick = fit;
  document.getElementById("theme").onclick = () => {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  };
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY);
  }, { passive: false });
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX - view.x, y: e.clientY - view.y };
    stage.classList.add("dragging");
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    view.x = e.clientX - drag.x;
    view.y = e.clientY - drag.y;
    apply();
  });
  stage.addEventListener("pointerup", () => { drag = null; stage.classList.remove("dragging"); });
  window.addEventListener("keydown", (e) => { if (e.key === "f" || e.key === "F") fit(); });
  window.addEventListener("resize", fit);
  if (img.complete) fit(); else img.addEventListener("load", fit);
</script>
</body>
</html>
`;
}

module.exports = { imageViewerHtml, esc };
