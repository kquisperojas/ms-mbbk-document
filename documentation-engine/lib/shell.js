const fs = require("fs");
const path = require("path");
const { config } = require("./env");

const CACHE = path.join(config.ROOT, "templates", "informe-shell.html");

function readCanonical() {
  if (fs.existsSync(CACHE)) return fs.readFileSync(CACHE, "utf8");
  try {
    return fs.readFileSync(config.CANONICAL_REPORT, "utf8");
  } catch (_) {
    return "";
  }
}

/** CSS y JS (navegación, tabs de diagramas, compartir) del informe canónico NEG-1678. */
function loadShell() {
  const html = readCanonical();
  const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";
  const script = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || "";
  const cut = script.indexOf("/* Pruebas");
  return { css, navScript: cut > 0 ? script.slice(0, cut) : script };
}

module.exports = { loadShell };
