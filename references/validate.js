#!/usr/bin/env node
/**
 * Validates a generated architecture HTML file.
 *
 *   node references/validate.js docs/architecture/my-system-design.html
 *
 * Catches the failure modes that survive a visual check: arithmetic that does
 * not add up, nodes that skipped Gate 1, edges pointing at nothing, overlapping
 * layout, and external requests that break the self-contained rule.
 *
 * Exit code 0 = pass, 1 = fail.
 */

const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("usage: node validate.js <generated.html>");
  process.exit(1);
}

const html = fs.readFileSync(file, "utf8");
const fail = [];
const warn = [];

/* ---- 1. Self-contained: no external requests ---------------------------- */

const external = [
  [/<script[^>]+\bsrc\s*=\s*["']https?:/gi, "external <script src>"],
  [/<link[^>]+\bhref\s*=\s*["']https?:/gi, "external <link href>"],
  [/<img[^>]+\bsrc\s*=\s*["']https?:/gi, "external <img src>"],
  [/@import\s+url\(\s*["']?https?:/gi, "external CSS @import"],
  [/\bfetch\s*\(\s*["'`]https?:/gi, "runtime fetch to external host"],
];
for (const [re, what] of external) {
  const hits = html.match(re);
  if (hits) fail.push(`${what} (${hits.length}) — file must be self-contained`);
}

/* ---- 2. Extract the DATA block ------------------------------------------ */

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!scripts.length) {
  fail.push("no <script> block found");
  report();
}
const js = scripts[scripts.length - 1];

// Cut at the comment that opens the END DATA banner, not at the words
// themselves — slicing mid-comment leaves an unterminated /* and breaks eval.
let cut = js.indexOf("END DATA");
if (cut > -1) {
  const open = js.lastIndexOf("/*", cut);
  cut = open > -1 ? open : cut;
} else {
  cut = js.indexOf("function renderTier");
}
const dataBlock = cut > -1 ? js.slice(0, cut) : js;

let SYSTEM, TIERS;
try {
  ({ SYSTEM, TIERS } = new Function(dataBlock + "\nreturn { SYSTEM, TIERS };")());
} catch (e) {
  fail.push(`DATA block does not evaluate: ${e.message}`);
  report();
}

/* ---- 3. Structural checks ----------------------------------------------- */

if (!SYSTEM || !TIERS) fail.push("SYSTEM or TIERS missing from DATA block");

const REQUIRED_NODE_FIELDS = ["why", "ceiling", "size", "cost", "rejected"];
const KINDS = ["client", "edge", "compute", "data", "cache", "queue", "external"];

for (const [key, t] of Object.entries(TIERS || {})) {
  if (!t.nodes || !t.nodes.length) { fail.push(`${key}: no nodes`); continue; }

  const byId = Object.fromEntries(t.nodes.map(n => [n.id, n]));

  // Gate 1: every node justifies itself
  for (const n of t.nodes) {
    for (const f of REQUIRED_NODE_FIELDS) {
      if (!n[f]) fail.push(`${key}/${n.id}: missing "${f}" — has not passed Gate 1`);
    }
    if (!KINDS.includes(n.kind)) fail.push(`${key}/${n.id}: unknown kind "${n.kind}"`);
    if (typeof n.col !== "number" || typeof n.row !== "number")
      fail.push(`${key}/${n.id}: col/row must be numbers`);
    if (/^(good practice|best practice|standard|industry standard)/i.test(n.why || ""))
      fail.push(`${key}/${n.id}: "why" cites convention, not a profile line`);
  }

  // Layout: no two nodes in one cell
  const cells = new Map();
  for (const n of t.nodes) {
    const k = `${n.col},${n.row}`;
    if (cells.has(k)) fail.push(`${key}: "${n.id}" overlaps "${cells.get(k)}" at ${k}`);
    cells.set(k, n.id);
  }

  // Edges resolve
  for (const [a, b] of t.edges || []) {
    if (!byId[a]) fail.push(`${key}: edge from unknown node "${a}"`);
    if (!byId[b]) fail.push(`${key}: edge to unknown node "${b}"`);
  }

  // Router limitation: the elbow router does not path around obstacles, so a
  // same-row edge that skips a column draws straight through whatever sits
  // between. Reroute via an adjacent column or move the nodes.
  for (const [a, b] of t.edges || []) {
    const s = byId[a], d = byId[b];
    if (!s || !d || s.row !== d.row) continue;
    const [lo, hi] = s.col < d.col ? [s.col, d.col] : [d.col, s.col];
    const blocker = t.nodes.find(n => n.row === s.row && n.col > lo && n.col < hi);
    if (blocker)
      fail.push(`${key}: edge ${a}->${b} draws through "${blocker.id}" — same-row edges cannot skip an occupied column`);
  }

  // Orphans
  const touched = new Set((t.edges || []).flatMap(([a, b]) => [a, b]));
  for (const n of t.nodes) {
    if (!touched.has(n.id) && t.nodes.length > 1)
      warn.push(`${key}/${n.id}: not connected by any edge`);
  }

  // Arithmetic
  if (t.costrows) {
    const sum = t.costrows.reduce((s, r) => s + r[2], 0);
    if (sum !== t.cost)
      fail.push(`${key}: costrows sum to $${sum} but headline says $${t.cost}`);
  } else {
    fail.push(`${key}: no costrows`);
  }

  // Tier metadata
  if (!t.trigger) fail.push(`${key}: no trigger metric — tier is incomplete`);
  if (!t.scaledown) fail.push(`${key}: no scale-down path`);
  if (t.trigger && !/\d/.test(t.trigger) && key !== "scale")
    warn.push(`${key}: trigger metric has no number in it`);
}

/* ---- 4. Budget gate ------------------------------------------------------ */

const budgetRow = (SYSTEM?.profile || []).find(r => /budget/i.test(r[0]));
if (budgetRow && TIERS?.mvp) {
  const ceiling = parseInt(String(budgetRow[1]).replace(/[^\d]/g, ""), 10);
  if (ceiling && TIERS.mvp.cost > ceiling)
    fail.push(`MVP tier costs $${TIERS.mvp.cost} but budget ceiling is $${ceiling} — Gate 3 violated`);
}

/* ---- 5. Assumptions surfaced -------------------------------------------- */

if (SYSTEM?.profile && !SYSTEM.profile.some(r => r[2]))
  warn.push("no profile field marked [assumed] — verify nothing was silently asserted");

if (!SYSTEM?.checklist?.length) fail.push("no start-here checklist");
if (!SYSTEM?.checked) fail.push("no price-check date on SYSTEM.checked");

/* ---- report -------------------------------------------------------------- */

function report() {
  for (const w of warn) console.log(`warn  ${w}`);
  for (const f of fail) console.log(`FAIL  ${f}`);
  if (fail.length) {
    console.log(`\n${fail.length} failure(s), ${warn.length} warning(s)`);
    process.exit(1);
  }
  console.log(`\nPASS — ${Object.keys(TIERS || {}).length} tiers valid, ${warn.length} warning(s)`);
  process.exit(0);
}

report();
