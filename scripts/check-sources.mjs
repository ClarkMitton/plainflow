// Checks whether the pages the rules rest on have changed since they were last looked at.
// It never changes a rule: it fetches each source page, hashes its text, and records in
// data/sources-status.json whether it's unchanged, changed, new, or unreachable, so a person
// knows which pages to re-read. Run with: npm run check-sources
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, "data", p), "utf8"));
const rules = read("rules.json");
const law = read("law.json");
const products = read("products.json");
const statusPath = join(root, "data", "sources-status.json");
let status = {};
try { status = JSON.parse(readFileSync(statusPath, "utf8")); } catch { status = {}; }

const sources = [];
for (const [id, l] of Object.entries(law.laws)) sources.push({ id: `law:${id}`, label: `${l.ref}: ${l.name}`, kind: "law", url: l.url });
for (const [id, s] of Object.entries(rules.sources)) if (s.url.startsWith("http")) sources.push({ id: `guidance:${id}`, label: s.label, kind: "guidance", url: s.url });
for (const [id, c] of Object.entries(products.companies)) if (c.dpa_url && c.dpa_url.startsWith("http")) sources.push({ id: `supplier:${id}`, label: `${c.name}: data protection terms`, kind: "supplier", url: c.dpa_url });

const today = new Date().toISOString().slice(0, 10);
const UA = "Plainflow source check (a personal data protection tool; checks whether a page changed)";

function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function check(src) {
  const prev = status[src.id] ?? {};
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(src.url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    if (!res.ok) return { ...src, ...prev, last_checked: today, status: "unreachable", note: `HTTP ${res.status}` };
    const hash = createHash("sha256").update(textOf(await res.text())).digest("hex").slice(0, 16);
    if (!prev.hash) return { ...src, last_checked: today, hash, status: "new", first_seen: today };
    if (prev.hash !== hash) return { ...src, ...prev, last_checked: today, hash, status: "changed", changed_at: today, previous_hash: prev.hash };
    return { ...src, ...prev, last_checked: today, hash, status: prev.status === "changed" && !prev.reviewed_at ? "changed" : "unchanged" };
  } catch (err) {
    return { ...src, ...prev, last_checked: today, status: "unreachable", note: err instanceof Error ? err.message : String(err) };
  }
}

const results = [];
for (const src of sources) results.push(await check(src));
const next = {};
for (const r of results) next[r.id] = r;
writeFileSync(statusPath, JSON.stringify({ note: "Written by scripts/check-sources.mjs. 'changed' means the page's text differs from the last check: a person re-reads it, decides whether a rule needs changing, and sets reviewed_at. Nothing here changes a rule by itself.", checked_at: today, sources: next }, null, 2));

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nSources checked ${today}\n`);
for (const r of results) console.log(`${pad(r.status, 12)} ${pad(r.kind, 9)} ${r.label}${r.note ? `  (${r.note})` : ""}`);
const changed = results.filter((r) => r.status === "changed");
console.log(`\n${results.length} sources: ${changed.length} changed, ${results.filter((r) => r.status === "unreachable").length} unreachable.`);
if (changed.length) console.log("Re-read the changed pages and decide whether a rule needs to change. Then set reviewed_at in data/sources-status.json.");
