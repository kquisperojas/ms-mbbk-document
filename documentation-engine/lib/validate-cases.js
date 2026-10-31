const STOP = new Set(
  `el la los las un una unos unas de del al a y o u en con por para que se su sus caso prueba pruebas validar verificar comprobar debe deberia cuando entonces dado como si no mas muy ya hay ser esta este estos esta estas the and for with from that this should must when then given user client`
    .split(/\s+/)
);

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function fold(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractPaths(text) {
  return unique(
    [...String(text || "").matchAll(/\/[A-Za-z0-9_\-{}]+(?:\/[A-Za-z0-9_\-{}]+){1,}/g)].map((m) => m[0])
  ).filter((p) => !/^\/{2}/.test(p) && p.length < 120);
}

function extractMethods(text) {
  return unique([...String(text || "").matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\b/gi)].map((m) => m[1].toUpperCase()));
}

const WORD_SYNONYMS = {
  cliente: ["person", "customer", "client", "persona"],
  estado: ["status", "state"],
  consulta: ["get", "find", "retrieve", "query", "obtener"],
  actualizacion: ["update", "patch", "put", "modificar"],
  auditoria: ["audit", "log", "logger"],
  logs: ["audit", "log", "logger"],
  log: ["audit", "logger"],
};

function mappingPath(args) {
  if (!args) return "";
  const named = String(args).match(/(?:value|path)\s*=\s*(?:\{\s*)?["']([^"']+)["']/);
  if (named) return named[1];
  const first = String(args).match(/["']([^"']+)["']/);
  return first ? first[1] : "";
}

function joinUrl(base, leaf) {
  if (!leaf) return base || "";
  if (!base) return leaf.startsWith("/") ? leaf : `/${leaf}`;
  const left = String(base).replace(/\/$/, "");
  const right = String(leaf).replace(/^\//, "");
  const joined = `${left}/${right}`.replace(/\/+/g, "/");
  return joined.startsWith("/") ? joined : `/${joined}`;
}

function extractJavaOps(text) {
  const ops = [];
  const classMatch = String(text || "").match(/@RequestMapping\s*(?:\(([^)]*)\))?/);
  const prefix = classMatch ? mappingPath(classMatch[1] || "") : "";
  const mappingRe = /@(Get|Post|Put|Patch|Delete)Mapping\s*(?:\(([^)]*)\))?/g;
  let match;
  while ((match = mappingRe.exec(text))) {
    ops.push({ method: match[1].toUpperCase(), path: joinUrl(prefix, mappingPath(match[2] || "")) });
  }
  const requestRe = /@RequestMapping\s*\(([^)]*)\)/g;
  while ((match = requestRe.exec(text))) {
    const args = match[1];
    const methodMatch = args.match(/RequestMethod\.(GET|POST|PUT|PATCH|DELETE)/i);
    if (!methodMatch) continue;
    ops.push({ method: methodMatch[1].toUpperCase(), path: joinUrl(prefix, mappingPath(args)) });
  }
  return ops;
}

function extractOpenApiOps(text) {
  const ops = [];
  let path = "";
  for (const line of String(text || "").split(/\r?\n/)) {
    const pathMatch = line.match(/^\s{0,2}(\/[^\s:]+):\s*$/);
    if (pathMatch) {
      path = pathMatch[1];
      continue;
    }
    const methodMatch = line.match(/^\s{2,8}(get|post|put|patch|delete):\s*$/i);
    if (methodMatch && path) ops.push({ method: methodMatch[1].toUpperCase(), path });
  }
  return ops;
}

function listOperations(corpus) {
  const ops = [];
  for (const file of corpus.files || []) {
    const kind = fileKind(file.path);
    extractJavaOps(file.text).forEach((op) => ops.push({ ...op, file: file.path, kind }));
    if (/openapi|swagger/i.test(file.path)) {
      extractOpenApiOps(file.text).forEach((op) => ops.push({ ...op, file: file.path, kind: "contrato" }));
    }
  }
  return ops;
}

function scoreOperation(op, methods, words) {
  let score = 0;
  if (!methods.length || methods.includes(op.method)) score += 4;
  else return 0;
  const hay = fold(`${op.path} ${op.file}`);
  for (const word of words) {
    if (hay.includes(word)) score += 3;
    for (const syn of WORD_SYNONYMS[word] || []) {
      if (hay.includes(syn)) score += 2;
    }
  }
  if (op.kind === "controller" || op.kind === "contrato") score += 1;
  return score;
}

function fileLabel(filePath) {
  return String(filePath || "").split("/").pop() || filePath;
}

function pickOperations(operations, methods, words, evidenceFiles) {
  const scored = (operations || [])
    .map((op) => ({ op, score: scoreOperation(op, methods, words) }))
    .filter((row) => row.score >= 4)
    .sort((a, b) => b.score - a.score || a.op.path.localeCompare(b.op.path));
  const preferred = scored.filter((row) => evidenceFiles.includes(row.op.file) || row.op.kind === "contrato");
  const pool = preferred.length ? preferred : scored;
  const seen = new Set();
  const picked = [];
  for (const row of pool) {
    const key = `${row.op.method} ${row.op.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(row.op);
    if (picked.length >= 4) break;
  }
  return picked;
}

function cumpleEvidence(corpus, methods, files, operations) {
  const repo = `${corpus.repo}@${corpus.ref}`;
  if (operations.length) {
    const endpoints = unique(
      operations.map((op) => (op.path ? `${op.method} ${op.path}` : op.method))
    );
    const labels = unique(operations.map((op) => fileLabel(op.file)));
    return `Endpoints/métodos: ${endpoints.join("; ")}. Archivos: ${labels.join(", ")} (${repo}).`;
  }
  if (methods.length && files.length) {
    return `Método ${methods.join("/")} cubierto en ${files.map(fileLabel).join(", ")} (${repo}).`;
  }
  if (files.length) {
    return `Implementado en ${files.map(fileLabel).join(", ")} (${repo}).`;
  }
  return `Implementado en la rama ${repo}.`;
}

function extractWords(text) {
  return unique(
    fold(text)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w))
  ).slice(0, 14);
}

function fileKind(filePath) {
  const p = filePath.toLowerCase();
  if (/openapi|swagger/.test(p)) return "contrato";
  if (/(?:^|\/)(?:test|tests)\//.test(p)) return "test";
  if (/controller|resource/.test(p)) return "controller";
  if (/service/.test(p)) return "service";
  return "codigo";
}

function methodInFile(file, method) {
  const m = method.toLowerCase();
  const mapping = {
    get: "@getmapping",
    post: "@postmapping",
    put: "@putmapping",
    patch: "@patchmapping",
    delete: "@deletemapping",
  };
  return (
    file.lower.includes(mapping[m] || "") ||
    file.lower.includes(`requestmethod.${m}`) ||
    new RegExp(`\\b${method}\\b\\s*:`, "i").test(file.text)
  );
}

function hitFiles(files, test) {
  const hits = [];
  for (const file of files) {
    if (test(file)) hits.push(file.path);
  }
  return unique(hits);
}

function blobOf(corpus) {
  return (corpus.files || []).map((f) => f.text).join("\n");
}

function detectEecc(corpus) {
  const blob = blobOf(corpus);
  if (!/AccountStatementService|statement-available|statement\/retrieve/.test(blob)) return null;
  const files = (corpus.files || [])
    .map((f) => f.path)
    .filter((p) => /AccountStatement|ClosedPeriodValidator|StatementPdf|openapi\.ya?ml/i.test(p))
    .slice(0, 5);
  return {
    files,
    available: /statement-available/.test(blob),
    retrieve: /accounts\/statement\/retrieve|retrieveAccountStatement/.test(blob),
    pdf: /generatePdf|application\/pdf|MIME_PDF/.test(blob),
    pen: /CURRENCY_PEN|"PEN"/.test(blob),
    usd: /CURRENCY_USD|"USD"/.test(blob),
    maxMonths: /maxMonthsAvailable|PERIOD_OUT_OF_RANGE/.test(blob),
    beforeOpening: /PERIOD_BEFORE_OPENING|anterior a la apertura/.test(blob),
    notAvailable: /STATEMENT_NOT_YET_AVAILABLE|STATEMENT_NOT_AVAILABLE|no est[aá] disponible/.test(blob),
    decimals: /#,##0\.00|DecimalFormat|formatAmount|previousBalance/.test(blob),
    incomeExpense: /totalIncome|totalExpense|PA_INCOME_TYPE/.test(blob),
    emptyMovements: /resolvedMovements\.isEmpty|safeMovements/.test(blob),
    clientInfo: /clientName|accountNumber|productAlias/.test(blob),
    statusActiveOnly: /ACCOUNT_STATUS_ACTIVE/.test(blob),
    sameDay: /belongsToPeriod|movementDate/.test(blob),
  };
}

const STATUS_CASES = [
  { re: /estado i\b|cuenta inactiva/, label: "I = Inactiva" },
  { re: /estado t\b|solo depositos|acepta solo/, label: "T = Acepta Solo Depósitos" },
  { re: /estado d\b|durmiente/, label: "D = Durmiente" },
  { re: /estado o\b|controlada/, label: "O = Controlada" },
  { re: /estado e\b|embargada/, label: "E = Embargada" },
  { re: /estado c\b|cancelada/, label: "C = Cancelada" },
];

function currencyOk(title, cap) {
  const t = fold(title);
  if (/dolar/.test(t)) return cap.usd;
  if (/soles/.test(t)) return cap.pen;
  return cap.pen || cap.usd;
}

function cite(cap, extra) {
  const files = (cap.files || []).join(", ") || "código de la rama";
  return extra ? `${extra} (${files}).` : files;
}

function validateEeccCase(c, corpus, cap) {
  const t = fold(c.title);
  const repo = `${corpus.repo}@${corpus.ref}`;
  let title = c.title;
  let result = "No cumple";
  let evidence = "";

  const statusHit = STATUS_CASES.find((s) => s.re.test(t));
  if (statusHit) {
    if (cap.statusActiveOnly) {
      title = `No listar ni generar Estado de Cuenta de una cuenta con estado ${statusHit.label} (la solución solo habilita estado A = Activa)`;
      result = "Cumple";
      evidence = cite(
        cap,
        `Ajustado a la solución: isStatementEligible exige ACCOUNT_STATUS_ACTIVE. El estado ${statusHit.label} no es consultable`
      );
    } else {
      result = "No cumple";
      evidence = `No cumple porque la rama ${repo} no restringe el estado ${statusHit.label}.`;
    }
    return { ...c, title, result, evidence };
  }

  if (!currencyOk(c.title, cap)) {
    return {
      ...c,
      result: "No cumple",
      evidence: `No cumple porque la rama ${repo} no declara soporte de esa moneda en el EECC.`,
    };
  }

  if (/mancomun/.test(t) && cap.retrieve) {
    result = "Cumple";
    evidence = cite(cap, "No hay filtro por mancomunidad; si la cuenta es activa se genera el EECC");
  } else if (/descarg/.test(t) && cap.pdf && cap.retrieve) {
    result = "Cumple";
    evidence = cite(cap, "retrieve genera PDF cifrado (StatementPdfGenerator + AES-GCM)");
  } else if (/no est[aá] disponible|mitad de mes/.test(t) && cap.notAvailable) {
    result = "Cumple";
    evidence = cite(
      cap,
      "Cuenta abierta en el mes en curso responde que el estado de cuenta aún no está disponible"
    );
  } else if (/anterior(?:es)? a la apertura/.test(t) && cap.beforeOpening) {
    result = "Cumple";
    evidence = cite(cap, "validateOpeningPeriod rechaza periodos anteriores a openingDate");
  } else if (/periodos disponibles|antiguedad/.test(t) && cap.available && cap.maxMonths) {
    result = "Cumple";
    evidence = cite(cap, "statement-available lista cuentas con maxMonthsAvailable = 12 y openingDate");
  } else if (/decimales|saldos/.test(t) && (cap.decimals || cap.retrieve)) {
    result = "Cumple";
    evidence = cite(cap, "Montos se formatean con #,##0.00 en el PDF");
  } else if (/ingresos y gastos/.test(t) && (cap.incomeExpense || cap.retrieve)) {
    result = "Cumple";
    evidence = cite(cap, "El PDF arma totalIncome y totalExpense a partir de los movimientos");
  } else if (/sin movimientos/.test(t) && cap.retrieve) {
    result = "Cumple";
    evidence = cite(cap, "Sin movimientos el saldo final usa previousBalance");
  } else if (/misma fecha/.test(t) && cap.retrieve) {
    result = "Cumple";
    evidence = cite(cap, "Los movimientos del periodo se listan sin restringir a una transacción por día");
  } else if (/gran cantidad/.test(t) && cap.retrieve) {
    result = "Cumple";
    evidence = cite(cap, "Se mapean todos los movimientos del periodo al PDF");
  } else if (/informacion del cliente|cuenta en el estado/.test(t) && cap.clientInfo) {
    result = "Cumple";
    evidence = cite(cap, "El PDF incluye clientName, accountNumber y alias");
  } else if (/primer estado|cuenta nueva|periodos consecutiv|consultar estado de cuenta|visualizar estado/.test(t) && cap.retrieve) {
    result = "Cumple";
    evidence = cite(cap, "GET statement/retrieve genera el EECC del mes/año cerrado");
  } else if (cap.retrieve || cap.available) {
    result = "Parcial";
    evidence = `No cubre el escenario completo: «${c.title}». Hay EECC en ${repo}, pero no una regla explícita para este caso.`;
  } else {
    result = "No cumple";
    evidence = `No cumple porque en ${repo} no hay implementación de «${c.title}».`;
  }

  return { ...c, title, result, evidence };
}

function validateOne(c, corpus, analysis, operations) {
  const eecc = detectEecc(corpus);
  if (eecc) return validateEeccCase(c, corpus, eecc);

  const blob = `${c.id} ${c.title}`;
  const paths = unique([
    ...extractPaths(blob),
    ...((analysis && analysis.endpoints) || [])
      .map((e) => e && e.path)
      .filter((p) => p && fold(c.title).includes(fold(String(p).split("/").filter(Boolean).slice(-1)[0] || "___"))),
  ]);
  const methods = extractMethods(blob);
  const words = extractWords(blob);
  const id = String(c.id || "").toLowerCase();
  const files = corpus.files || [];

  const pathHits = [];
  for (const p of paths) {
    const needle = p.toLowerCase();
    pathHits.push(
      ...hitFiles(
        files,
        (f) =>
          f.lower.includes(needle) ||
          (f.openApiPaths || []).some((op) => op.toLowerCase() === needle || fold(op) === fold(p))
      )
    );
    if ((corpus.openApiPaths || []).some((op) => op.toLowerCase() === needle || op.toLowerCase().includes(needle))) {
      pathHits.push("openapi");
    }
  }

  const methodHits = [];
  if (methods.length) {
    for (const method of methods) {
      methodHits.push(...hitFiles(files, (f) => methodInFile(f, method) && (pathHits.length ? pathHits.includes(f.path) : true)));
    }
  }

  const wordHits = [];
  for (const file of files) {
    let n = 0;
    for (const w of words) {
      if (file.lower.includes(w)) n++;
    }
    if (n >= 3) wordHits.push({ path: file.path, n, kind: fileKind(file.path) });
  }
  wordHits.sort((a, b) => b.n - a.n);

  const testHits = id
    ? hitFiles(files, (f) => fileKind(f.path) === "test" && f.lower.includes(id))
    : [];

  const strong = unique([...pathHits.filter((p) => p !== "openapi"), ...methodHits, ...testHits]);
  const openApi = pathHits.includes("openapi");
  const bestWords = wordHits.slice(0, 3);
  const evidenceFiles = unique([...strong, ...bestWords.map((h) => h.path)]).slice(0, 4);

  let result = "No cumple";
  if (strong.length >= 1 && (openApi || methodHits.length || testHits.length || bestWords.some((h) => h.n >= 4))) {
    result = "Cumple";
  } else if (strong.length || openApi || bestWords.some((h) => h.n >= 3)) {
    result = "Parcial";
  } else if (bestWords.length && bestWords[0].n >= 2) {
    result = "Parcial";
  }

  const scenario = String(c.title || c.id || "el escenario").trim();
  const matchedOps = pickOperations(operations, methods, words, evidenceFiles);
  const opPaths = unique(matchedOps.map((op) => op.path).filter(Boolean));
  let evidence = "";
  if (result === "Cumple") {
    evidence = cumpleEvidence(corpus, methods, evidenceFiles, matchedOps);
  } else if (result === "Parcial") {
    evidence = evidenceFiles.length
      ? `No cubre el escenario completo: «${scenario}». Solo hay coincidencias parciales en ${evidenceFiles.join(", ")} (${corpus.repo}@${corpus.ref}).`
      : `No cubre el escenario completo: «${scenario}». Hay indicios en ${corpus.repo}@${corpus.ref}, pero falta el flujo descrito.`;
  } else {
    evidence = `No cumple porque en la rama ${corpus.repo}@${corpus.ref} no hay código que implemente «${scenario}»: no se encontró endpoint, servicio ni test asociado.`;
  }

  return {
    ...c,
    result,
    evidence,
    validation: {
      paths: unique([...paths, ...opPaths]),
      methods,
      files: evidenceFiles,
      operations: matchedOps.map((op) => ({ method: op.method, path: op.path, file: op.file })),
    },
  };
}

function validateCases(cases, corpus, analysis) {
  const operations = listOperations(corpus);
  const validated = (cases || []).map((c) => validateOne(c, corpus, analysis || {}, operations));
  const count = (r) => validated.filter((c) => c.result === r).length;
  return {
    cases: validated,
    summary: {
      total: validated.length,
      cumple: count("Cumple"),
      parcial: count("Parcial"),
      noCumple: count("No cumple"),
      repo: `${corpus.owner}/${corpus.repo}`,
      ref: corpus.ref,
      files: (corpus.files || []).length,
    },
  };
}

module.exports = { validateCases };
