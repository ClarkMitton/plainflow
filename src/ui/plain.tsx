// Plain-English helpers: jargon explained in place, what an answer changed, and the policy answer.
import { Fragment, type ReactNode } from "react";
import glossary from "../../data/glossary.json";
import { openKeys } from "../engine/derive";
import type { Derivation, Flow, RuleSet } from "../engine/types";

const TERMS = glossary.terms as Record<string, string>;
const termList = Object.keys(TERMS).sort((a, b) => b.length - a.length);
const termRe = new RegExp(`\\b(${termList.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})s?\\b`, "i");

/** A word with a dotted underline that explains itself on hover. */
export function Term({ t, children }: { t: string; children?: ReactNode }) {
  const key = termList.find((k) => k.toLowerCase() === t.toLowerCase()) ?? t;
  return (
    <span className="term tip" tabIndex={0}>
      {children ?? t}
      <span className="tipbox">{TERMS[key]}</span>
    </span>
  );
}

/** Wraps glossary words in a string (first time each appears) so they explain themselves. */
export function Glossed({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const seen = new Set<string>();
  let rest = text;
  let i = 0;
  while (rest) {
    const m = termRe.exec(rest);
    if (!m) { out.push(rest); break; }
    const word = m[1];
    const key = termList.find((k) => k.toLowerCase() === word.toLowerCase())!;
    // Acronyms must match case, so "dpa" inside a word or "tier" in lower case still reads naturally.
    const acronym = key === key.toUpperCase();
    if (seen.has(key) || (acronym && word !== key)) {
      out.push(rest.slice(0, m.index + m[0].length));
    } else {
      seen.add(key);
      out.push(rest.slice(0, m.index));
      out.push(<Term key={i++} t={key}>{m[0]}</Term>);
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return <>{out.map((x, j) => <Fragment key={j}>{x}</Fragment>)}</>;
}

export interface Change {
  kind: "up" | "down" | "info" | "bad" | "good";
  text: string;
}

/** What one answer changed, in plain words. This is the moment people learn why it matters. */
export function describeChange(before: Derivation, after: Derivation, flow: Flow, set: RuleSet): Change[] {
  const out: Change[] = [];
  const title = (id: string) => flow.nodes.find((n) => n.id === id)?.title ?? id;
  for (const [id, t] of Object.entries(after.tiers)) {
    const was = before.tiers[id];
    if (was !== undefined && was !== t) {
      out.push({ kind: t > was ? "up" : "down", text: `${title(id)} is now Tier ${t}. ${set.rules.tiers[String(t)].plain}` });
    }
  }
  const lineKey = (b: Derivation["bright_lines"][number]) => `${b.id}:${b.node}`;
  const hadLines = new Set(before.bright_lines.map(lineKey));
  const hasLines = new Set(after.bright_lines.map(lineKey));
  for (const b of after.bright_lines.filter((x) => !hadLines.has(lineKey(x)))) out.push({ kind: "bad", text: `Hard line: ${b.title}. ${b.say}` });
  for (const b of before.bright_lines.filter((x) => !hasLines.has(lineKey(x)))) out.push({ kind: "good", text: `Cleared: ${b.title}.` });
  if (after.verdict.id !== before.verdict.id) out.push({ kind: "info", text: `Answer now: ${after.verdict.label}.` });
  if (after.blocked.length > before.blocked.length) out.push({ kind: "bad", text: `Policy doesn't allow this now. ${after.blocked[0].message}` });
  if (after.blocked.length < before.blocked.length) out.push({ kind: "good", text: "Policy allows it again." });
  if (after.outcome !== before.outcome) out.push({ kind: set.rules.outcome.order.indexOf(after.outcome) > set.rules.outcome.order.indexOf(before.outcome) ? "up" : "down", text: set.rules.outcome.plain[after.outcome] });
  const was = new Set(openKeys(before));
  const now = new Set(openKeys(after));
  for (const r of after.requirements.filter((x) => now.has(x.key) && !was.has(x.key))) out.push({ kind: "up", text: `Adds: ${r.title}. ${r.meaning}` });
  for (const r of before.requirements.filter((x) => was.has(x.key) && !now.has(x.key))) out.push({ kind: "down", text: `No longer needed: ${r.title}.` });
  return out;
}

export interface PolicyLine { ok: boolean; text: string; ways: string[] }
export interface PolicyAnswer { ok: boolean; title: string; source: string; unowned: boolean; lines: PolicyLine[] }

const placeholder = (v: unknown) => typeof v !== "string" || v.trim() === "" || /^\[.*\]$/.test(v.trim());

/** Whose rule the policy answer rests on, and what would change it. 'Policy' is always this organisation's list. */
export function policyAnswer(flow: Flow, d: Derivation, set: RuleSet): PolicyAnswer {
  const p = set.rules.policy;
  const r = set.rules;
  const title = (id: string) => flow.nodes.find((n) => n.id === id)?.title ?? id;
  const unowned = placeholder(r.owner) || placeholder(r.review_date);
  const source = p.source.replace("{version}", r.version).replace("{owner}", placeholder(r.owner) ? "not set" : r.owner).replace("{review_date}", placeholder(r.review_date) ? "not set" : r.review_date);
  const fillFor = (id: string, text: string, tier: number) => {
    const f = d.facts[id] ?? {};
    return text
      .replace(/\{company\}/g, title(id))
      .replace("{max_tier}", String(f.sanctioned_max_tier ?? ""))
      .replace(/\{tier\}/g, String(tier))
      .replace("{plan}", String(f.plan_label ?? ""))
      .replace("{checked}", set.products.research_checked ?? "unknown date");
  };
  if (d.blocked.length) {
    return {
      ok: false,
      title: p.no_title,
      source,
      unowned,
      lines: d.blocked.map((b) => {
        const f = d.facts[b.to] ?? {};
        const edge = d.edges[b.edge];
        const needed = String(f.plan_needed ?? "");
        const plan = needed ? ` ${needed[0].toUpperCase()}${needed.slice(1)} would take it (${f.plan_needed_cost}).` : "";
        const base = !f.listed && !f.plan_label && edge && edge.tier <= 2 ? p.no_unlisted : p.no;
        return { ok: false, text: fillFor(b.to, base.replace("{message}", b.message), edge?.tier ?? 0) + plan, ways: b.ways_out };
      }),
    };
  }
  const lines: PolicyLine[] = d.crossings
    .filter((c) => c.tier >= 1)
    .map((c) => {
      const node = flow.nodes.find((n) => n.id === c.to);
      const f = d.facts[c.to] ?? {};
      const role = String(node?.levers.role);
      const text = ["joint_controller", "independent_controller"].includes(role) ? p.allowed_partner : f.plan_label ? p.allowed_plan : f.listed ? p.allowed : p.unlisted;
      return { ok: true, text: fillFor(c.to, text, c.tier), ways: [] as string[] };
    });
  return { ok: true, title: p.yes_title, source, unowned, lines: lines.length ? lines : [{ ok: true, text: p.allowed_inside, ways: [] as string[] }] };
}
