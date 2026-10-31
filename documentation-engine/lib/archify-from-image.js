const zlib = require("zlib");

const MS_RE = /\b(?:jch|ch|jsc|jbs|bs|sp|sb|jsp)-[a-z0-9]+(?:-[a-z0-9]+)+-v?\d+(?:\.\d+)*\b/gi;
const METHOD_RE = /\b(GET|POST|PUT|PATCH|DELETE)\b\s*:?\s*(\/?[\w\-/{}.]+)?/i;

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripHtml(value) {
  return decodeEntities(String(value || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function makeId(label, used) {
  let base = String(label || "nodo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!/^[a-z]/.test(base)) base = `n-${base}`;
  if (!base || base === "n-") base = "nodo";
  let id = base;
  let i = 2;
  while (used.has(id)) id = `${base}-${i++}`;
  used.add(id);
  return id;
}

function componentType(name) {
  const n = String(name || "").toLowerCase();
  if (/^(jch|ch)-/.test(n)) return "frontend";
  if (/security|token|oauth|jwt|detect|clave/.test(n)) return "security";
  if (/^(jsc|jbs|bs|jsp)-/.test(n)) return "backend";
  if (/\b(actor|usuario|backoffice|\bbo\b|browser)\b/.test(n)) return "external";
  if (/\b(db|base de datos|postgres|oracle|as400|mongo|redis|cnl_)/.test(n)) return "database";
  if (/queue|kafka|mq|bus|topic/.test(n)) return "messagebus";
  if (/cloud|s3|cdn|ocp|openshift/.test(n)) return "cloud";
  if (/frontend|experiencia|canal /.test(n)) return "frontend";
  if (/backend|soporte/.test(n)) return "backend";
  return "backend";
}

function attr(block, name) {
  const match = String(block || "").match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decodeEntities(match[1]) : "";
}

function numAttr(attrs, name) {
  const value = attr(attrs, name);
  return value === "" ? null : Number(value);
}

function parseMxCells(xml) {
  const cells = [];
  const re = /<mxCell\b([^>]*?)\s*\/>|<mxCell\b([^>]*)>([\s\S]*?)<\/mxCell>/g;
  let match;
  while ((match = re.exec(xml))) {
    const raw = match[1] != null ? match[1] : match[2];
    const inner = match[3] || "";
    const geom = inner.match(/<mxGeometry\b([^>]*)/);
    const g = geom ? geom[1] : "";
    let sx = null;
    let sy = null;
    let tx = null;
    let ty = null;
    const points = [];
    const pointRe = /<mxPoint\b([^>]*)\/?>/g;
    let point;
    while ((point = pointRe.exec(inner))) {
      const pa = point[1];
      const as = attr(pa, "as");
      const x = numAttr(pa, "x");
      const y = numAttr(pa, "y");
      if (as === "sourcePoint") {
        sx = x;
        sy = y;
      } else if (as === "targetPoint") {
        tx = x;
        ty = y;
      } else {
        points.push({ x: x || 0, y: y || 0 });
      }
    }
    cells.push({
      id: attr(raw, "id"),
      value: stripHtml(attr(raw, "value")),
      source: attr(raw, "source"),
      target: attr(raw, "target"),
      parent: attr(raw, "parent"),
      style: attr(raw, "style"),
      vertex: attr(raw, "vertex") === "1",
      edge: attr(raw, "edge") === "1",
      x: numAttr(g, "x"),
      y: numAttr(g, "y"),
      w: numAttr(g, "width"),
      h: numAttr(g, "height"),
      sx,
      sy,
      tx,
      ty,
      points,
    });
  }
  return cells;
}

function fitParticipant(name) {
  const raw = String(name || "Participante").replace(/\s+/g, " ").trim();
  const ms = raw.match(/^(jch|ch|jsc|jbs|bs|jsp|sb|sp)-(.+?)(-v\d+(?:\.\d+)*)?$/i);
  if (ms) {
    const prefix = ms[1].toLowerCase();
    const rest = ms[2].toLowerCase();
    const ver = (ms[3] || "").replace(/^-/i, "");
    let role = /^(jch|ch)$/.test(prefix) ? "Canal" : "Soporte";
    if (/security|token|oauth|jwt|clave/.test(rest)) role = "Seguridad";
    else if (/customer|client|persona/.test(rest) && /^(jch|ch)$/.test(prefix)) role = "Canal";
    else if (/customer|client|persona/.test(rest)) role = "Soporte";
    const label = ver ? `${role} ${ver}` : role;
    return { label: label.slice(0, 22), sublabel: raw.slice(0, 48) };
  }
  if (/^db\b|base de datos|\[cnl_/i.test(raw)) {
    return { label: "Base de datos", sublabel: raw.replace(/[\[\]]/g, "").slice(0, 48) };
  }
  if (/^(actor|usuario|user|cliente)$/i.test(raw)) return { label: "Actor" };
  if (raw.length <= 20) return { label: raw };
  return { label: raw.slice(0, 18), sublabel: raw.slice(0, 48) };
}

function withFit(raw, extra = {}) {
  const fitted = fitParticipant(raw);
  const node = { ...extra, label: fitted.label };
  if (fitted.sublabel) node.sublabel = fitted.sublabel;
  return node;
}

function fitMessage(label) {
  let text = String(label || "llamada").replace(/\s+/g, " ").trim();
  text = text.replace(/\{[^}]+\}/g, "{id}");
  const method = text.match(/^(GET|POST|PUT|PATCH|DELETE)\s*:?\s*(.*)$/i);
  if (method) {
    const path = String(method[2] || "")
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean)
      .slice(0, 3)
      .join("/");
    text = path ? `${method[1].toUpperCase()} /${path}` : method[1].toUpperCase();
  }
  if (text.length > 36) text = text.slice(0, 34);
  return text || "llamada";
}

function midX(cell) {
  if (!cell || cell.x == null) return null;
  return cell.x + (cell.w || 0) / 2;
}

function edgeY(edge) {
  const ys = [edge.sy, edge.ty, edge.y, ...(edge.points || []).map((point) => point.y)].filter((y) => y != null && Number.isFinite(y));
  if (!ys.length) return 200;
  return ys.reduce((sum, y) => sum + y, 0) / ys.length;
}

function readPngChunks(buffer) {
  const chunks = [];
  if (!buffer || buffer.length < 24) return chunks;
  const sig = buffer.slice(0, 8).toString("hex");
  if (sig !== "89504e470d0a1a0a") return chunks;
  let i = 8;
  while (i + 12 <= buffer.length) {
    const len = buffer.readUInt32BE(i);
    const type = buffer.slice(i + 4, i + 8).toString("ascii");
    const data = buffer.slice(i + 8, i + 8 + len);
    chunks.push({ type, data });
    i += 12 + len;
    if (type === "IEND") break;
  }
  return chunks;
}

function extractMxfile(saved) {
  if (!saved || !saved.buffer) return "";
  if (saved.ext === ".svg") {
    const xml = saved.buffer.toString("utf8");
    const embedded = xml.match(/mxfile[^>]*>[\s\S]*<\/mxfile>/i);
    return embedded ? `<${embedded[0]}` : xml;
  }
  if (![".png", ".jpg", ".jpeg"].includes(saved.ext)) return "";
  for (const chunk of readPngChunks(saved.buffer)) {
    if (chunk.type !== "tEXt" && chunk.type !== "zTXt") continue;
    const z = chunk.data.indexOf(0);
    if (z < 0) continue;
    const key = chunk.data.slice(0, z).toString("ascii");
    if (key !== "mxfile" && key !== "mxGraphModel") continue;
    let raw;
    try {
      raw = chunk.type === "zTXt" ? zlib.inflateSync(chunk.data.slice(z + 2)).toString("utf8") : chunk.data.slice(z + 1).toString("utf8");
    } catch {
      continue;
    }
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return "";
}

function isLifeline(cell) {
  return /umlLifeline|umlActor|shape=actor/i.test(cell.style || "");
}

function isText(cell) {
  return /(?:^|;)text;|strokeColor=none/i.test(cell.style || "") && !isLifeline(cell);
}

function nearestByX(items, x) {
  if (!items.length) return null;
  return items.reduce((best, item) => {
    const mid = (item.x || 0) + (item.w || 0) / 2;
    const dist = Math.abs(mid - x);
    return !best || dist < best.dist ? { item, dist } : best;
  }, null).item;
}

function candidateFromSequenceCells(cells, title, output) {
  const used = new Set();
  const lifelines = cells
    .filter((cell) => cell.vertex && isLifeline(cell) && (cell.value || /umlActor/i.test(cell.style || "")))
    .sort((a, b) => (a.x || 0) - (b.x || 0));
  const boxes = cells
    .filter((cell) => cell.vertex && !isText(cell) && !isLifeline(cell) && cell.value && (cell.w || 0) > 40)
    .sort((a, b) => (a.x || 0) - (b.x || 0));
  const heads = lifelines.length ? lifelines : boxes;
  if (heads.length < 2) return null;

  const byId = Object.fromEntries(cells.map((cell) => [cell.id, cell]));
  const idOf = new Map();
  const participants = heads.map((cell) => {
    const raw = cell.value || (/umlActor/i.test(cell.style || "") ? "Actor" : "Participante");
    const id = makeId(raw, used);
    idOf.set(cell.id, id);
    return withFit(raw, { id, type: componentType(raw) });
  });

  const resolve = (cellId, fallbackX) => {
    let current = byId[cellId];
    while (current) {
      if (idOf.has(current.id)) return idOf.get(current.id);
      current = byId[current.parent];
    }
    if (fallbackX == null || !Number.isFinite(fallbackX)) return null;
    const near = nearestByX(heads, fallbackX);
    return near ? idOf.get(near.id) : null;
  };

  const texts = cells.filter((cell) => cell.vertex && isText(cell) && cell.value);
  const usedText = new Set();
  const pickLabel = (edge, fromX, toX, y) => {
    if (edge.value) return edge.value;
    const minX = Math.min(fromX, toX);
    const maxX = Math.max(fromX, toX);
    let best = null;
    texts.forEach((text) => {
      if (usedText.has(text.id)) return;
      const tx = midX(text);
      if (tx == null || tx < minX - 30 || tx > maxX + 30) return;
      const dist = Math.abs((text.y || 0) - y) + Math.abs(tx - (minX + maxX) / 2) * 0.25;
      if (!best || dist < best.dist) best = { text, dist };
    });
    if (best && best.dist < 90) {
      usedText.add(best.text.id);
      return best.text.value;
    }
    return "llamada";
  };

  const messages = [];
  cells
    .filter((cell) => cell.edge)
    .map((edge) => {
      const fromX = edge.sx != null ? edge.sx : midX(byId[edge.source]);
      const toX = edge.tx != null ? edge.tx : midX(byId[edge.target]);
      const from = resolve(edge.source, fromX);
      const to = resolve(edge.target, toX);
      if (!from || !to || from === to) return null;
      const y = edgeY(edge);
      const fromIdx = participants.findIndex((item) => item.id === from);
      const toIdx = participants.findIndex((item) => item.id === to);
      const variant = /dashed=1/i.test(edge.style || "") || toIdx < fromIdx ? ( /dashed=1/i.test(edge.style || "") ? "dashed" : "return") : "default";
      return {
        from,
        to,
        y,
        label: fitMessage(pickLabel(edge, fromX || 0, toX || 0, y)),
        variant,
      };
    })
    .filter(Boolean)
    .filter((msg) => msg.from && msg.to && msg.from !== msg.to)
    .sort((a, b) => a.y - b.y)
    .forEach((msg, index) => {
      if (messages.some((existing) => existing.from === msg.from && existing.to === msg.to && existing.label === msg.label)) return;
      messages.push({
        id: `m${index + 1}`,
        from: msg.from,
        to: msg.to,
        y: 160 + messages.length * 40,
        label: msg.label,
        variant: msg.variant,
      });
    });

  if (!messages.length) return null;
  const lastY = messages[messages.length - 1].y + 80;
  return {
    schema_version: 1,
    diagram_type: "sequence",
    meta: {
      title,
      output,
      quality_profile: "standard",
      column_fit: "spread",
      viewBox: [Math.max(1080, participants.length * 240), Math.max(520, lastY + 40)],
    },
    participants,
    messages,
    cards: [
      {
        dot: "cyan",
        title: "Origen",
        items: [`Reconstruido desde el modelo de la imagen (${messages.length} llamadas).`],
      },
    ],
  };
}

function candidateFromArchitectureCells(cells, title, output) {
  const used = new Set();
  const nodes = cells
    .filter((cell) => cell.vertex && !isText(cell) && !isLifeline(cell) && cell.value && (cell.w || 0) >= 48 && (cell.h || 0) >= 24)
    .sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
  if (!nodes.length) return null;
  const idOf = new Map();
  const components = nodes.slice(0, 16).map((cell, index) => {
    const id = makeId(cell.value, used);
    idOf.set(cell.id, id);
    const col = index % 3;
    const row = Math.floor(index / 3);
    return withFit(cell.value, {
      id,
      type: componentType(cell.value),
      pos: [48 + col * 280, 80 + row * 150],
      size: [220, 76],
    });
  });
  const connections = [];
  cells
    .filter((cell) => cell.edge)
    .forEach((edge, index) => {
      const from = idOf.get(edge.source);
      const to = idOf.get(edge.target);
      if (!from || !to || from === to) return;
      connections.push({
        id: `c${index + 1}`,
        from,
        to,
        route: "orthogonal-h",
        labelDy: 56,
        label: edge.value ? fitMessage(edge.value) : undefined,
      });
    });
  if (!connections.length && components.length > 1) {
    for (let i = 0; i < components.length - 1; i++) {
      connections.push({ id: `c${i + 1}`, from: components[i].id, to: components[i + 1].id, route: "auto" });
    }
  }
  return {
    schema_version: 1,
    diagram_type: "architecture",
    meta: { title, output, quality_profile: "standard", viewBox: [1080, Math.max(560, 120 + Math.ceil(components.length / 3) * 160)] },
    components,
    connections,
    cards: [{ dot: "emerald", title: "Origen", items: ["Reconstruido desde la imagen de arquitectura adjunta."] }],
  };
}

function candidateFromAnalysis(analysis, kind, title, output) {
  const ms = Array.isArray(analysis && analysis.microservices) ? analysis.microservices : [];
  const endpoints = Array.isArray(analysis && analysis.endpoints) ? analysis.endpoints : [];
  const names = ms.map((item) => item.name).filter(Boolean);
  if (kind === "Secuencia") {
    const used = new Set();
    const labels = ["Actor", ...names.slice(0, 5)];
    if (labels.length < 3) labels.push("Base de datos");
    const participants = labels.map((label) => withFit(label, { id: makeId(label, used), type: componentType(label) }));
    const messages = [];
    const calls = endpoints.length ? endpoints.slice(0, 6) : [{ method: "GET", path: "/flujo" }];
    calls.forEach((ep, index) => {
      const from = participants[Math.min(index, participants.length - 2)].id;
      const to = participants[Math.min(index + 1, participants.length - 1)].id;
      messages.push({
        id: `m${index + 1}`,
        from,
        to,
        y: 160 + index * 48,
        label: fitMessage(`${ep.method || "GET"} ${ep.path || ""}`.trim()),
        variant: index === 0 ? "emphasis" : "default",
      });
      messages.push({
        id: `r${index + 1}`,
        from: to,
        to: from,
        y: 184 + index * 48,
        label: "200 OK",
        variant: "return",
      });
    });
    return {
      schema_version: 1,
      diagram_type: "sequence",
      meta: {
        title,
        output,
        quality_profile: "standard",
        column_fit: "spread",
        viewBox: [Math.max(1080, participants.length * 200), Math.max(520, 220 + messages.length * 28)],
      },
      participants,
      messages,
      cards: [{ dot: "orange", title: "Origen", items: ["La imagen no traía el XML de draw.io; el flujo se reconstruyó con el DET y los componentes visibles de la iniciativa."] }],
    };
  }

  const used = new Set();
  const labels = names.length ? names.slice(0, 9) : ["Canal digital", "Microservicio de experiencia", "Microservicio de soporte"];
  const components = labels.map((label, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    return withFit(label, {
      id: makeId(label, used),
      type: componentType(label),
      tag: (ms[index] && ms[index].tag) || undefined,
      pos: [48 + col * 280, 80 + row * 160],
      size: [220, 76],
    });
  });
  const connections = [];
  for (let i = 0; i < components.length - 1; i++) {
    const ep = endpoints[i];
    const conn = {
      id: `c${i + 1}`,
      from: components[i].id,
      to: components[i + 1].id,
      route: "orthogonal-h",
    };
    if (ep) {
      conn.label = fitMessage(`${ep.method} ${String(ep.path || "").split("/").slice(-2).join("/")}`);
      conn.labelDy = 64;
    }
    connections.push(conn);
  }
  return {
    schema_version: 1,
    diagram_type: "architecture",
    meta: { title, output, quality_profile: "standard", viewBox: [1080, Math.max(560, 120 + Math.ceil(components.length / 3) * 160)] },
    components,
    connections,
    cards: [{ dot: "orange", title: "Origen", items: ["La imagen no traía el modelo draw.io; Archify se armó con los microservicios y endpoints del DET."] }],
  };
}

function buildArchifyCandidate(saved, kind, analysis, outputRel) {
  const title = (saved.name || kind).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || kind;
  const mx = extractMxfile(saved);
  if (mx) {
    const cells = parseMxCells(mx);
    const fromImage =
      kind === "Secuencia" ? candidateFromSequenceCells(cells, title, outputRel) : candidateFromArchitectureCells(cells, title, outputRel);
    if (fromImage) return { candidate: fromImage, source: "drawio" };
  }
  const fallback = candidateFromAnalysis(analysis || {}, kind, title, outputRel);
  return fallback ? { candidate: fallback, source: "det" } : null;
}

module.exports = { buildArchifyCandidate, extractMxfile };
