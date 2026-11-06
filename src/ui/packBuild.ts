// The pack: what people leave with. Three documents built from the same derivation, so they always agree.
// Pure: no React. The Finish page renders it; packText flattens it for an email or a Teams message.
import { stepsFor } from "./questions";
import { policyAnswer } from "./plain";
import { art28Clauses } from "./flowOps";
import type { Derivation, Flow, Law, Requirement, RuleSet } from "../engine/types";

export interface ActionItem {
  n: number;
  what: string;
  meaning: string;
  who: string;
  howLong: string;
  why: string;
  law: Law | null;
  person: string;
}

export interface CompanyCardOut {
  id: string;
  title: string;
  role: string;
  plan: string | null;
  planNeeded: string | null;
  dpa: string;
  region: string;
  transfer: string;
  retention: string;
  art28: { evidenced: number; of: number; missing: string[] };
  open: string[];
  questions: string[];
  tier: number;
}

export interface Pack {
  title: string;
  story: string;
  date: string;
  owner: string;
  status: string;
  retrospective: boolean;
  source: string | null;
  forPerson: {
    verdict: string;
    say: string;
    notes: string[];
    facts: { label: string; value: string; detail: string; laws: Law[] }[];
    hardLines: { title: string; say: string; waysOut: string[]; law: Law | null }[];
    easier: { change: string; cost: string; how: string } | null;
    actions: ActionItem[];
    needsPerson: string[];
    effort: string;
    signoff: string;
  };
  forDpo: {
    tiers: { title: string; tier: number; because: string; rule: string }[];
    screening: { id: string; text: string; yes: boolean; because: string; law: string | null }[];
    outcome: string;
    crossings: { from: string; to: string; tier: number; blocked: boolean }[];
    cards: CompanyCardOut[];
    asked: { ask: string; about: string; answer: string | null }[];
    laws: Law[];
  };
  forNext: {
    riskOwner: string | null;
    assumed: string[];
    bring: string[];
    agreed: string[];
    changes: string[];
  };
}

const ROLE: Record<string, string> = { processor: "processor (works on your instructions)", joint_controller: "joint controller (decides with you)", independent_controller: "independent controller (decides for itself)", sub_processor: "sub-processor (works for your supplier)" };

export function buildPack(flow: Flow, d: Derivation, set: RuleSet): Pack {
  const { rules, requirements: cat } = set;
  const title = (id: string) => flow.nodes.find((n) => n.id === id)?.title ?? id;
  const policy = policyAnswer(flow, d, set);
  const tier = rules.tiers[String(d.highest_tier)];
  const lawsOf = (ids: (string | undefined)[]) => ids.filter((x): x is string => !!x).map((id) => set.laws[id]).filter(Boolean);

  const toDo = d.requirements.filter((r) => r.rail && (r.status === "to_do" || r.status === "partial")).sort((a, b) => a.build_order - b.build_order);
  const actions: ActionItem[] = toDo.map((r: Requirement, i) => ({
    n: i + 1,
    what: r.title,
    meaning: r.meaning,
    who: cat.owner_labels[r.owner] ?? r.owner,
    howLong: cat.effort_labels[r.effort] ?? r.effort,
    why: r.cause.text.replace(/A\d{1,2}: /g, ""),
    law: r.law,
    person: r.left_for_person,
  }));

  const cc = d.cheapest_change;
  const ccLever = cc ? rules.levers[flow.nodes.find((n) => n.id === cc.node)!.type].find((l) => l.id === cc.lever) : undefined;
  const ccTo = cc
    ? cc.lever === "company_id"
      ? set.products.companies[String(cc.to)]?.name ?? String(cc.to)
      : cc.lever === "plan"
        ? set.products.plan_labels[String(cc.to)] ?? String(cc.to)
        : typeof cc.to === "boolean"
          ? cc.to ? "on" : "off"
          : ccLever?.options?.find(([v]) => v === cc.to)?.[1] ?? String(cc.to)
    : "";

  // Every company outside the organisation, sub-processors included: the DPO wants the company behind the company too.
  const outsideCompanies = flow.nodes.filter((n) => n.type === "company" && !n.inside);
  const cards: CompanyCardOut[] = outsideCompanies.map((n) => {
    const f = n.fields;
    const facts = d.facts[n.id] ?? {};
    const art28 = (f.art28 ?? {}) as Record<string, string | null>;
    const missing = art28Clauses.filter(([k]) => !art28[k]).map(([, label]) => label);
    const dpa = d.requirements.find((r) => r.id === "dpa_card" && r.node === n.id);
    const dsa = d.requirements.find((r) => r.id === "dsa_outline" && r.node === n.id);
    const open = d.requirements.filter((r) => r.node === n.id && r.status !== "on_file" && r.status !== "covered").map((r) => r.title);
    return {
      id: n.id,
      title: n.title,
      role: ROLE[String(n.levers.role)] ?? String(n.levers.role),
      plan: facts.plan_label ? String(facts.plan_label) : null,
      planNeeded: facts.plan_needed && facts.plan_needed !== facts.plan_label ? `${String(facts.plan_needed)} (${String(facts.plan_needed_cost)})` : null,
      dpa: dsa ? `sharing agreement: ${cat.status_labels[dsa.status]}` : dpa ? `DPA ${cat.status_labels[dpa.status]}` : facts.blocked ? "blocked" : "not needed",
      region: String(f.region ?? "unknown"),
      transfer: String(f.transfer_mechanism ?? "unknown").replace(/_/g, " "),
      retention: String(f.retention || "unknown"),
      art28: { evidenced: art28Clauses.length - missing.length, of: art28Clauses.length, missing },
      open,
      questions: f.card_ref ? [] : set.products.supplier_questions,
      tier: Number(facts.receives_tier ?? -1),
    };
  });

  const steps = stepsFor(flow, d);
  const asked = steps.map((s) => ({ ask: s.ask, about: s.node?.title ?? "the whole idea", answer: flow.answers?.[s.key] ?? null }));
  const assumed = asked.filter((a) => !a.answer).map((a) => a.ask);

  const bring: string[] = [];
  for (const c of cards) {
    if (c.questions.length) bring.push(`Answers from ${c.title} to the supplier questions (no card on file yet).`);
    if (c.art28.missing.length && !c.questions.length) bring.push(`${c.title}: evidence for ${c.art28.missing.length} Article 28 term${c.art28.missing.length === 1 ? "" : "s"} (${c.art28.missing.slice(0, 3).join(", ")}${c.art28.missing.length > 3 ? "…" : ""}).`);
    if (c.retention === "unknown") bring.push(`${c.title}: how long they keep the data, in writing.`);
    if (c.region === "unknown") bring.push(`${c.title}: where the data is hosted.`);
  }
  if (!flow.risk_owner?.trim() && d.outcome !== "not_required") bring.push("The name of the role that will own the risk and sign it off.");
  const agreed: string[] = [];
  if (flow.risk_owner?.trim()) agreed.push(`Risk owner: ${flow.risk_owner.trim()}.`);
  if (cc) agreed.push(`Easier version considered: ${cc.node_title}, ${ccLever?.label ?? cc.lever} to ${ccTo}.`);
  agreed.push(`Answer as it stands: ${d.verdict.label}.`);

  const laws = [...new Map(
    [
      ...Object.values(d.screening).filter((a) => a.yes).map((a) => a.law),
      ...d.requirements.map((r) => r.law),
      ...d.bright_lines.map((b) => b.law),
      ...lawsOf(tier.law ?? []),
    ].filter((l): l is Law => !!l).map((l) => [l.id, l] as const),
  ).values()];

  return {
    title: flow.title,
    story: flow.story ?? "",
    date: new Date().toISOString().slice(0, 10),
    owner: flow.owner ?? "",
    status: flow.status.replace("_", " "),
    retrospective: !!flow.retrospective,
    source: flow.source?.kind === "scan" ? flow.source.repo : null,
    forPerson: {
      verdict: d.verdict.label,
      say: d.verdict.say,
      notes: d.notes,
      facts: [
        { label: "The data", value: `Level ${d.highest_tier}: ${tier.label.toLowerCase()}`, detail: `${tier.plain} ${tier.can}`, laws: lawsOf(tier.law ?? []) },
        { label: "Your policy", value: policy.ok ? "allows it" : "doesn't allow it", detail: `${policy.lines.map((l) => l.text + (l.ways.length ? ` Ways out: ${l.ways.join(" / ")}` : "")).join(" ")} ${policy.source}${policy.unowned ? " " + set.rules.policy.unowned : ""}`, laws: lawsOf(["art28"]) },
        { label: "DPIA", value: rules.outcome.labels[d.outcome], detail: rules.outcome.plain[d.outcome] + (d.floor_raised ? " Your use of AI sets this minimum." : ""), laws: lawsOf(["art35"]) },
      ],
      hardLines: d.bright_lines.map((b) => ({ title: b.title, say: b.say, waysOut: b.ways_out, law: b.law })),
      easier: cc ? { change: `${cc.lever === "company_id" ? "Switch" : "Change"} ${cc.node_title}: ${ccLever?.label ?? cc.lever} to ${ccTo}. ${cc.unblocks ? "That clears the block." : `That lifts ${cc.removes.length} thing${cc.removes.length === 1 ? "" : "s"} to do.`}`, cost: cc.cost, how: cc.how } : null,
      actions,
      needsPerson: d.needs_person,
      effort: rules.effort.time_labels[d.effort.time],
      signoff: rules.effort.signoff_labels[d.effort.signoff],
    },
    forDpo: {
      tiers: flow.nodes.filter((n) => n.type === "data").map((n) => ({ title: n.title, tier: d.tiers[n.id], because: d.tier_because[n.id], rule: rules.tiers[String(d.tiers[n.id])]?.rule ?? "" })),
      screening: Object.values(d.screening).map((a) => ({ id: a.id, text: a.text, yes: a.yes, because: a.because.join("; "), law: a.law?.ref ?? null })),
      outcome: rules.outcome.labels[d.outcome],
      crossings: d.crossings.map((c) => ({ from: title(flow.edges.find((e) => e.id === c.edge)!.from), to: title(c.to), tier: c.tier, blocked: c.blocked })),
      cards,
      asked,
      laws,
    },
    forNext: {
      riskOwner: flow.risk_owner?.trim() || null,
      assumed,
      bring,
      agreed,
      changes: (flow.changelog ?? []).slice(-8).map((c) => `${c.at.slice(0, 16).replace("T", " ")} ${c.what}`),
    },
  };
}

/** The pack as plain text, for pasting into an email or a Teams message. */
export function packText(p: Pack): string {
  const L: string[] = [];
  L.push(`${p.title.toUpperCase()}`, p.story, `Checked ${p.date}${p.retrospective ? " (already in use)" : ""}${p.source ? ` · from a code scan of ${p.source}` : ""}`, "");
  L.push("CAN I DO IT?", p.forPerson.verdict, p.forPerson.say, ...p.forPerson.notes, "");
  for (const f of p.forPerson.facts) L.push(`${f.label}: ${f.value}. ${f.detail}`);
  L.push("");
  for (const h of p.forPerson.hardLines) L.push(`HARD LINE: ${h.title}`, h.say, ...h.waysOut.map((w) => `  - ${w}`), "");
  if (p.forPerson.easier) L.push("THE EASIER VERSION", p.forPerson.easier.change, `You'd give up: ${p.forPerson.easier.cost}`, `How: ${p.forPerson.easier.how}`, "");
  L.push(`WHAT TO DO (${p.forPerson.effort}; sign-off: ${p.forPerson.signoff})`);
  for (const a of p.forPerson.actions) L.push(`${a.n}. ${a.what} (${a.who}, ${a.howLong}): ${a.meaning}${a.why ? ` Because ${a.why}.` : ""}${a.law ? ` [${a.law.ref}]` : ""}`);
  if (!p.forPerson.actions.length) L.push("Nothing to do.");
  L.push("", "STILL NEEDS A PERSON", ...p.forPerson.needsPerson.map((x) => `- ${x}`), "");
  L.push("FOR THE DPO", `Screening outcome: ${p.forDpo.outcome}`);
  for (const t of p.forDpo.tiers) L.push(`${t.title}: Level ${t.tier}, because ${t.because}.`);
  for (const s of p.forDpo.screening.filter((x) => x.yes)) L.push(`${s.id} yes: ${s.because}${s.law ? ` [${s.law}]` : ""}`);
  for (const c of p.forDpo.cards) L.push(`${c.title}: ${c.role}; ${c.plan ? `plan: ${c.plan}; ` : ""}${c.dpa}; region ${c.region}; keeps ${c.retention}; Article 28 ${c.art28.evidenced}/${c.art28.of}${c.open.length ? `; open: ${c.open.join(", ")}` : ""}`);
  L.push("", "NEXT TIME");
  if (p.forNext.riskOwner) L.push(`Risk owner: ${p.forNext.riskOwner}`);
  if (p.forNext.bring.length) L.push("Bring:", ...p.forNext.bring.map((b) => `- ${b}`));
  if (p.forNext.assumed.length) L.push(`Assumed, not asked (${p.forNext.assumed.length}):`, ...p.forNext.assumed.map((a) => `- ${a}`));
  L.push("", "This is a screening, not legal advice. Plainflow never says a flow is lawful; it says what still needs a person.");
  return L.join("\n");
}
