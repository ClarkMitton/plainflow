// The Q&A logic: which questions to ask, and what each answer does to the flow.
// Only questions that could change the answer get asked; the rest keep the guess and are recorded as assumed.
import questionsJson from "../../data/questions.json";
import { derive, openKeys } from "../engine/derive";
import { test, type Env } from "../engine/expr";
import type { Derivation, Flow, FlowNode, RuleSet } from "../engine/types";

export interface Setting {
  set?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  flow?: Record<string, unknown>;
}

export interface Answer extends Setting {
  label: string;
}

export interface Item {
  label: string;
  hint?: string;
  show_when?: string;
  on: Setting;
  off: Setting;
}

export interface Question {
  id: string;
  type?: "single" | "checklist";
  target: string;
  show_when?: string;
  skip_when?: string;
  ask: string;
  why: string;
  example?: string;
  answers?: Answer[];
  items?: Item[];
}

export const questions = questionsJson.questions as Question[];

export interface Step {
  key: string;
  q: Question;
  /** null for a question about the whole flow. */
  node: FlowNode | null;
  ask: string;
  /** For a checklist: the items that apply to this node. */
  items: Item[];
}

function factsEnv(d: Derivation, flow: Flow, id: string): Env {
  const all = (type: string) => flow.nodes.filter((n) => n.type === type).map((n) => factsEnv(d, flow, n.id));
  return { lookup: (k) => d.facts[id]?.[k], nodes: all };
}

function flowEnv(d: Derivation, flow: Flow): Env {
  const vars: Record<string, unknown> = { outcome: d.outcome, highest_tier: d.highest_tier, risk_owner: flow.risk_owner ?? null };
  for (const a of Object.values(d.screening)) vars[a.id] = a.yes;
  return { lookup: (k) => vars[k], nodes: (type) => flow.nodes.filter((n) => n.type === type).map((n) => factsEnv(d, flow, n.id)) };
}

/** Data is an ordinary noun mid-sentence ("student work"); a purpose is a phrase, so it's quoted; products and companies keep their capitals. */
function inSentence(node: FlowNode): string {
  const lower = node.title[0].toLowerCase() + node.title.slice(1);
  if (node.type === "purpose") return `"${lower}"`;
  return node.type === "data" ? lower : node.title;
}

/** Every question that applies, once per node. Questions we already know the answer to are left out. */
export function stepsFor(flow: Flow, d: Derivation): Step[] {
  const steps: Step[] = [];
  for (const q of questions) {
    if (q.target === "flow") {
      if (q.show_when && !test(q.show_when, flowEnv(d, flow))) continue;
      steps.push({ key: q.id, q, node: null, ask: q.ask, items: q.items ?? [] });
      continue;
    }
    const targets = flow.nodes.filter((n) => (q.target === "subjects" ? n.type === "people" && n.fields.group !== "staff" : n.type === q.target));
    for (const node of targets) {
      const env = factsEnv(d, flow, node.id);
      if (q.show_when && !test(q.show_when, env)) continue;
      if (q.skip_when && test(q.skip_when, env)) continue;
      const items = (q.items ?? []).filter((it) => !it.show_when || test(it.show_when, env));
      steps.push({ key: `${q.id}:${node.id}`, q, node, ask: q.ask.replace("{title}", inSentence(node)), items });
    }
  }
  return steps;
}

export function apply(flow: Flow, nodeId: string | null, s: Setting): Flow {
  return {
    ...flow,
    ...(s.flow ?? {}),
    nodes: flow.nodes.map((n) => (n.id === nodeId ? { ...n, levers: { ...n.levers, ...(s.set ?? {}) }, fields: { ...n.fields, ...(s.fields ?? {}) } } : n)),
  } as Flow;
}

export function matches(flow: Flow, node: FlowNode | null, s: Setting): boolean {
  const same = (x: unknown, y: unknown) => (x ?? null) === (y ?? null);
  const f = flow as unknown as Record<string, unknown>;
  return (
    Object.entries(s.set ?? {}).every(([k, v]) => same(node?.levers[k], v)) &&
    Object.entries(s.fields ?? {}).every(([k, v]) => same(node?.fields[k], v)) &&
    Object.entries(s.flow ?? {}).every(([k, v]) => same(f[k], v))
  );
}

/** Tick the given items, untick the rest. */
export function applyChecklist(flow: Flow, step: Step, ticked: boolean[]): Flow {
  return step.items.reduce((f, it, i) => apply(f, step.node?.id ?? null, ticked[i] ? it.on : it.off), flow);
}

/** What a person would notice: the verdict, tier, outcome, hard lines, policy and to-do list. */
function signature(d: Derivation): string {
  return JSON.stringify([d.verdict.id, d.highest_tier, d.outcome, d.bright_lines.map((b) => b.id + b.node), d.blocked.length, openKeys(d).sort()]);
}

/** Could any answer to this question change what the person sees? If not, don't ask it. */
export function isDecisive(step: Step, flow: Flow, set: RuleSet, base: Derivation): boolean {
  const now = signature(base);
  const nodeId = step.node?.id ?? null;
  const differs = (f: Flow) => signature(derive(f, set, { cheapest: false })) !== now;
  if (step.q.type === "checklist") {
    return step.items.some((it) => differs(apply(flow, nodeId, matches(flow, step.node, it.on) ? it.off : it.on)));
  }
  return (step.q.answers ?? []).some((a) => differs(apply(flow, nodeId, a)));
}
