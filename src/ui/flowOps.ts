// Flow editing helpers. Pure functions over the flow JSON; the engine never sees React.
import cardsJson from "../../data/cards.json";
import sentenceJson from "../../data/sentence.json";
import { tierOfData } from "../engine/derive";
import type { EdgeKind, Flow, FlowEdge, FlowNode, NodeType, RuleSet } from "../engine/types";

export const BOUNDARY_X = 700;
export const ZONE_WIDTH = 420;

type Card = { company_id: string; title: string; contract?: string; fields: Record<string, unknown> };
export const cards = cardsJson.cards as Record<string, Card>;
export const art28Clauses = cardsJson.art28_clauses as [string, string][];

let seq = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;

const DEFAULTS: Record<NodeType, { title: string; levers: Record<string, unknown>; fields: Record<string, unknown> }> = {
  people: { title: "People", levers: { age_mix: "all_adults", vulnerable: false }, fields: { group: "other", description: "", size: null } },
  data: {
    title: "Data",
    levers: { identifiability: "named", about_performance: false, special_category: false, free_text_or_audio: false, new_purpose: false, new_collection: false, student_facing: false },
    fields: { categories: ["name"], source_system: "", lawful_basis: null, about: [] },
  },
  purpose: {
    title: "Purpose",
    levers: { scores: false, decides_alone: false, staff_can_override: true, ongoing: false, whole_cohort: false, tracks_behaviour: false, can_block: false, privacy_notice_linked: false },
    fields: { value: "", alternatives: "", should_it_be_done: "", scale: null, privacy_notice_url: null, challenge_route: "" },
  },
  system: {
    title: "System",
    levers: { is_ai: false, output_type: "suggestion", validated_by_person: true, staff_can_override: true, plan: "free" },
    fields: { product_id: null, use_case: null, testing: { date: "", sample: "", result: "" }, fairness_check: { date: "", groups: [], result: "" } },
  },
  company: {
    title: "Company",
    levers: { role: "processor", decides_purpose: false, decides_means: false, own_purposes: false, trains_on_inputs: false, keeps_data: false },
    fields: { company_id: null, card_ref: null, region: "unknown", transfer_mechanism: "unknown", retention: "", deletion_route: "", security_assessment: { status: "none", date: null }, art28: {}, dpa_document: null, prior_dpia: null, owner: "", review_date: null },
  },
};

export function newNode(type: NodeType, position: { x: number; y: number }, flow?: Flow): FlowNode {
  const d = DEFAULTS[type];
  const fields = structuredClone(d.fields);
  if (type === "data" && flow?.organisation.default_lawful_basis) fields.lawful_basis = flow.organisation.default_lawful_basis;
  return { id: uid("n"), type, title: d.title, position, inside: position.x < BOUNDARY_X, levers: { ...d.levers }, fields };
}

export function emptyFlow(retrospective: boolean): Flow {
  return {
    id: uid("flow"),
    title: "Untitled flow",
    story: "",
    mode: "flow_first",
    tier_pinned: null,
    status: "draft",
    retrospective,
    owner: "governance lead",
    organisation: { name: "[organisation]", type: "college", default_lawful_basis: "public_task" },
    dates: { created: new Date().toISOString().slice(0, 10), launch: null, running_since: null, review: null },
    version: 1,
    nodes: [],
    edges: [],
    pinned: null,
    changelog: [{ at: new Date().toISOString(), who: "governance lead", what: "created", reopened: [] }],
  };
}

export function inferKind(from: FlowNode, to: FlowNode): EdgeKind {
  if (from.type === "company" && to.type === "company") return "sub_processor";
  if (from.type === "people") return from.fields.group === "staff" || to.type === "system" ? "by" : "about";
  if (from.type === "system" && to.type === "purpose") return "feeds";
  if (from.type === "purpose" && to.type !== "company") return "feeds";
  return "carries";
}

export function connect(flow: Flow, fromId: string, toId: string): Flow {
  const from = flow.nodes.find((n) => n.id === fromId);
  const to = flow.nodes.find((n) => n.id === toId);
  if (!from || !to || fromId === toId) return flow;
  if (flow.edges.some((e) => e.from === fromId && e.to === toId)) return flow;
  const edge: FlowEdge = { id: uid("e"), from: fromId, to: toId, kind: inferKind(from, to), data_id: null };
  return { ...flow, edges: [...flow.edges, edge] };
}

/**
 * Which way a wire runs between two boxes, from what they are: people and data feed the tool,
 * the tool feeds the purpose and the companies, a company can have a company behind it.
 */
export function smartConnect(flow: Flow, aId: string, bId: string): Flow {
  const a = flow.nodes.find((n) => n.id === aId);
  const b = flow.nodes.find((n) => n.id === bId);
  if (!a || !b || a.id === b.id) return flow;
  const rank: Record<NodeType, number> = { people: 0, data: 1, system: 2, purpose: 3, company: 4 };
  let from = a, to = b;
  if (a.type === b.type) {
    // Two of a kind: the one asked for the connection is the source (a company behind a company, say).
  } else if (a.type === "purpose" && b.type === "company") {
    // Sharing with a partner: the purpose sends to the company.
  } else if (b.type === "purpose" && a.type === "company") {
    from = b; to = a;
  } else if (rank[a.type] > rank[b.type]) {
    from = b; to = a;
  }
  return connect(flow, from.id, to.id);
}

export function disconnect(flow: Flow, edgeId: string): Flow {
  return { ...flow, edges: flow.edges.filter((e) => e.id !== edgeId) };
}

/** Add a box and wire it in, so it changes the answer straight away instead of floating. */
export function addNode(flow: Flow, type: NodeType): { flow: Flow; node: FlowNode; wiredTo: string[] } {
  const outside = type === "company";
  const x = outside ? BOUNDARY_X + 60 : type === "people" || type === "data" ? 40 : 360;
  // Below the lowest box already in that column, so nothing lands on top of anything.
  const column = flow.nodes.filter((n) => Math.abs(n.position.x - x) < 200);
  const y = column.length ? Math.max(...column.map((n) => n.position.y + (n.collapse === "pill" ? 62 : EST_HEIGHT[n.type]))) + 48 : 40;
  const node = newNode(type, { x, y }, flow);
  const first = (t: NodeType, pred: (n: FlowNode) => boolean = () => true) => flow.nodes.find((n) => n.type === t && pred(n));
  const subjects = flow.nodes.filter((n) => n.type === "people" && n.fields.group !== "staff").map((n) => n.id);
  let out: Flow = { ...flow, nodes: [...flow.nodes, node] };
  const targets: FlowNode[] = [];
  const system = first("system");
  const purpose = first("purpose");
  const data = first("data");
  if (type === "data") {
    node.fields.about = subjects;
    if (system) targets.push(system);
    else if (purpose) targets.push(purpose);
  }
  if (type === "people") {
    node.title = "People";
    if (purpose) targets.push(purpose);
  }
  if (type === "system") {
    if (data) out = connect(out, data.id, node.id);
    if (purpose) targets.push(purpose);
  }
  if (type === "purpose") {
    if (system) out = connect(out, system.id, node.id);
    else if (data) out = connect(out, data.id, node.id);
    for (const id of subjects) out = connect(out, id, node.id);
  }
  if (type === "company") {
    if (system) out = connect(out, system.id, node.id);
    else if (data) out = connect(out, data.id, node.id);
  }
  for (const t of targets) out = connect(out, node.id, t.id);
  const wiredTo = out.edges.filter((e) => e.from === node.id || e.to === node.id).map((e) => (e.from === node.id ? e.to : e.from));
  return { flow: out, node, wiredTo: wiredTo.map((id) => flow.nodes.find((n) => n.id === id)?.title ?? id) };
}

export function companyFromCard(companyId: string, set: RuleSet, position: { x: number; y: number }, role = "processor"): FlowNode {
  const n = newNode("company", position);
  const company = set.products.companies[companyId];
  const cardEntry = Object.entries(cards).find(([, c]) => c.company_id === companyId);
  n.title = company?.name ?? companyId;
  n.levers.role = role;
  n.fields.company_id = companyId;
  n.fields.region = company?.region_default ?? "unknown";
  if (cardEntry) {
    const [cardId, card] = cardEntry;
    Object.assign(n.fields, structuredClone(card.fields), { card_ref: cardId });
  }
  // A card saved in this browser from an earlier flow wins over the seed card.
  try {
    const saved = (JSON.parse(localStorage.getItem("plainflow.cards") ?? "{}") as Record<string, { fields: Record<string, unknown> }>)[companyId];
    if (saved) Object.assign(n.fields, structuredClone(saved.fields), { card_ref: `library:${companyId}` });
  } catch {
    /* no library, or not in a browser */
  }
  return n;
}

/** Picking a product sets the system's AI lever and brings its company and sub-processors onto the canvas. */
export function applyProduct(flow: Flow, systemId: string, productId: string | null, set: RuleSet): Flow {
  const sys = flow.nodes.find((n) => n.id === systemId);
  if (!sys) return flow;
  const product = productId ? set.products.products[productId] : null;
  let nodes = flow.nodes.map((n) =>
    n.id === systemId
      ? { ...n, title: product ? product.name.replace(/^Microsoft 365 /, "") : n.title, levers: { ...n.levers, is_ai: product ? product.is_ai : n.levers.is_ai }, fields: { ...n.fields, product_id: productId } }
      : n,
  );
  let edges = flow.edges;
  if (product?.company) {
    let company = nodes.find((n) => n.type === "company" && n.fields.company_id === product.company);
    if (!company) {
      company = companyFromCard(product.company, set, { x: BOUNDARY_X + 60, y: Math.max(40, sys.position.y - 40) });
      company.levers.keeps_data = typeof product.keeps_data_default === "string" && !/^none/.test(product.keeps_data_default);
      company.levers.trains_on_inputs = product.trains_on_inputs_default === true;
      nodes = [...nodes, company];
    }
    if (!edges.some((e) => e.from === systemId && e.to === company!.id)) {
      edges = [...edges, { id: uid("e"), from: systemId, to: company.id, kind: "carries", data_id: null }];
    }
    product.sub_processors.forEach((sp, i) => {
      if (nodes.some((n) => n.type === "company" && n.fields.company_id === sp)) return;
      const child = companyFromCard(sp, set, { x: BOUNDARY_X + 60, y: company!.position.y + 320 + i * 180 }, "sub_processor");
      if (sp === "openai_azure") Object.assign(child.fields, { dpa_document: "covered by Microsoft DPA", deletion_route: "via Microsoft", retention: "none" });
      nodes = [...nodes, child];
      edges = [...edges, { id: uid("e"), from: company!.id, to: child.id, kind: "sub_processor", data_id: null }];
    });
  }
  return { ...flow, nodes, edges };
}

export interface Sentence {
  role: string;
  /** Each kind of data: a choice from sentence.json, or typed in. */
  data: { kind: string | null; label: string }[];
  about: { kind: string | null; label: string };
  under18: "all_adults" | "some_under_18" | "under_16" | "under_13";
  /** A product from the directory, or a tool typed in. */
  product: string | null;
  otherTool: { name: string; ai: boolean } | null;
  purpose: { kind: string | null; label: string };
}

type SentenceChoices = typeof sentenceJson;
export const sentenceChoices = sentenceJson as SentenceChoices;

export function emptySentence(): Sentence {
  return { role: "", data: [{ kind: null, label: "" }], about: { kind: null, label: "" }, under18: "some_under_18", product: null, otherTool: null, purpose: { kind: null, label: "" } };
}

export function exampleSentence(): Sentence {
  const ex = sentenceChoices.example;
  const kind = (id: string) => sentenceChoices.data.find((d) => d.id === id)!;
  const about = sentenceChoices.about.find((a) => a.id === ex.about)!;
  return {
    role: ex.role,
    data: ex.data.map((id) => ({ kind: id, label: kind(id).label })),
    about: { kind: about.id, label: about.label },
    under18: about.age_mix as Sentence["under18"],
    product: ex.product,
    otherTool: null,
    purpose: { kind: ex.purpose, label: sentenceChoices.purposes.find((x) => x.id === ex.purpose)!.label },
  };
}

export function sentenceComplete(s: Sentence): boolean {
  return !!s.role.trim() && s.data.every((d) => d.label.trim()) && !!s.about.label.trim() && (!!s.product || !!s.otherTool?.name.trim()) && !!s.purpose.label.trim();
}

const short = (label: string) => label.replace(/\s*\(.*\)$/, "");

/** Lower case for the middle of a sentence, but SEND, HR and IT keep their capitals. */
export function keepAcronyms(s: string): string {
  return s.split(" ").map((w) => (/[A-Z].*[A-Z]/.test(w) ? w : w.toLowerCase())).join(" ");
}

/** How a role starts a sentence: "A teacher", "An admin officer", "Admin staff" (plural, no article), "HR" (a team, no article). */
export function roleParts(role: string): { article: string; plural: boolean } {
  const r = role.trim();
  if (/\b(staff|team|teachers|tutors|lecturers|students|people|governors)$/i.test(r)) return { article: "", plural: true };
  if (/^[A-Z]{2,}$/.test(r) || /^(marketing|finance|admissions|estates|exams)$/i.test(r)) return { article: "", plural: false };
  return { article: /^[aeiou]/i.test(r) ? "An " : "A ", plural: false };
}

/** The start of the story as text. */
export function subject(role: string): { text: string; plural: boolean } {
  const r = role.trim();
  if (!r) return { text: "Someone", plural: false };
  const { article, plural } = roleParts(r);
  const lower = keepAcronyms(r);
  return { text: article ? article + lower : lower[0].toUpperCase() + lower.slice(1), plural };
}

/** The story builder: each slot becomes a node, laid out like the worked example. */
export function flowFromSentence(s: Sentence, set: RuleSet, retrospective: boolean, tierPinned: number | null = null): Flow {
  let flow = emptyFlow(retrospective);
  const product = s.product ? set.products.products[s.product] : null;
  const toolName = product?.name.replace(/^Microsoft 365 /, "") ?? s.otherTool?.name.trim() ?? "Tool";
  const dataTitles = s.data.map((d) => short(d.label).trim()).filter(Boolean);
  const purposeLabel = s.purpose.label.trim();
  flow.title = `${toolName} ${purposeLabel ? "for " + purposeLabel.toLowerCase() : ""}`.trim();
  const aboutLabel = keepAcronyms(s.about.label.trim());
  const who = subject(s.role);
  const verb = retrospective ? (who.plural ? "have been putting" : "has been putting") : who.plural ? "put" : "puts";
  flow.story = `${who.text} ${verb} ${keepAcronyms(dataTitles.join(" and "))}${aboutLabel ? ` about ${aboutLabel}` : ""} into ${(product?.name ?? toolName).replace(/^(An?) /, (m) => m.toLowerCase())}${product?.company ? `, run by ${set.products.companies[product.company]?.name}` : ""}, to ${keepAcronyms(purposeLabel)}.`;

  const aboutKind = sentenceChoices.about.find((a) => a.id === s.about.kind);
  const subjects = newNode("people", { x: 40, y: 30 });
  subjects.title = s.about.label.trim() ? s.about.label.trim()[0].toUpperCase() + s.about.label.trim().slice(1) : "People";
  subjects.levers.age_mix = s.under18;
  subjects.fields.group = aboutKind?.group ?? "other";

  const actor = newNode("people", { x: 40, y: 250 + dataTitles.length * 300 });
  actor.title = s.role.trim() || "Staff";
  actor.levers.age_mix = "all_adults";
  actor.fields.group = "staff";

  const purposeKind = sentenceChoices.purposes.find((x) => x.id === s.purpose.kind);
  const purpose = newNode("purpose", { x: 360, y: 460 });
  purpose.title = purposeLabel ? purposeLabel[0].toUpperCase() + purposeLabel.slice(1) : "Purpose";
  if (purposeKind) Object.assign(purpose.levers, purposeKind.levers);
  if (purposeKind) purpose.fields.kind = purposeKind.id;
  if (purposeKind && (purposeKind as { fields?: Record<string, unknown> }).fields) Object.assign(purpose.fields, (purposeKind as { fields?: Record<string, unknown> }).fields);
  else purpose.levers.scores = /mark|grade|score|rank|predict|assess/i.test(purposeLabel);

  const system = newNode("system", { x: 360, y: 160 });
  system.title = toolName;
  if (s.otherTool) system.levers.is_ai = s.otherTool.ai;

  const dataNodes = s.data.filter((d) => d.label.trim()).map((entry, i) => {
    const t = short(entry.label).trim();
    const kind = sentenceChoices.data.find((x) => x.id === entry.kind);
    const d = newNode("data", { x: 40, y: 220 + i * 300 }, flow);
    d.title = t[0].toUpperCase() + t.slice(1);
    if (kind) {
      Object.assign(d.levers, kind.levers);
      d.fields.categories = [...kind.categories];
      d.fields.kind = kind.id;
    } else {
      d.levers.about_performance = /work|mark|grade|attend|progress|behaviour|support|note|assess/i.test(t);
      d.levers.free_text_or_audio = /work|essay|note|comment|record|audio|recording/i.test(t);
      d.levers.special_category = /health|send|medical|safeguard|disab|religio|ethnic/i.test(t);
    }
    d.fields.about = [subjects.id];
    // Starting from a tier: begin inside it, so the Q&A only offers what that tier allows.
    if (tierPinned != null) {
      const steps: [string, unknown][] = [["special_category", false], ["about_performance", false], ["identifiability", "anonymised"]];
      for (const [lever, value] of steps) if (tierOfData(d, set) > tierPinned) d.levers[lever] = value;
    }
    return d;
  });

  flow.nodes = [subjects, ...dataNodes, actor, system, purpose];
  flow = connect(flow, subjects.id, purpose.id);
  flow = connect(flow, actor.id, purpose.id);
  for (const d of dataNodes) flow = connect(flow, d.id, system.id);
  flow = connect(flow, system.id, purpose.id);
  if (s.product) flow = applyProduct(flow, system.id, s.product, set);
  if (purposeKind && (purposeKind as { partner?: boolean }).partner) {
    // Sharing with a partner: they decide things too, so they're a joint controller, not a supplier.
    const partner = newNode("company", { x: BOUNDARY_X + 60, y: 460 });
    partner.title = "Partner organisation";
    partner.levers.role = "joint_controller";
    partner.levers.decides_purpose = true;
    partner.fields.region = "UK";
    partner.fields.transfer_mechanism = "none_needed";
    flow.nodes = [...flow.nodes, partner];
    flow = connect(flow, purpose.id, partner.id);
  }
  if (!s.product && s.otherTool?.name.trim()) {
    // A tool we don't know: the company behind it is unknown too, so it gets the supplier questions and Tier 1 at most.
    const company = newNode("company", { x: BOUNDARY_X + 60, y: 120 });
    company.title = s.otherTool.name.trim();
    // Nobody has asked them yet, so whether they train on it is unknown, not "no".
    company.levers.trains_on_inputs = null;
    flow.nodes = [...flow.nodes, company];
    flow = connect(flow, system.id, company.id);
  }
  if (tierPinned != null) Object.assign(flow, { mode: "tier_first", tier_pinned: tierPinned });
  flow.changelog = [{ at: new Date().toISOString(), who: flow.owner ?? "", what: "created from sentence builder", reopened: [] }];
  return flow;
}

export function downloadJson(name: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const EST_HEIGHT: Record<NodeType, number> = { people: 170, data: 290, system: 250, purpose: 300, company: 230 };

/**
 * Lay the flow out left to right in the order data travels: who it's about and the data itself,
 * then the systems and what they're for, then the companies outside, each followed by the companies behind it.
 * Heights come from what's on screen when known.
 */
export function tidy(flow: Flow, heightOf: (id: string) => number | undefined): Flow {
  const gap = 48;
  // A folded node is just its header, whatever was last measured.
  const h = (n: FlowNode) => (n.collapse === "pill" ? 62 : heightOf(n.id) ?? EST_HEIGHT[n.type]);
  const pos = new Map<string, { x: number; y: number }>();
  const stack = (ns: FlowNode[], x: number) => {
    let y = 40;
    for (const n of ns) { pos.set(n.id, { x, y }); y += h(n) + gap; }
  };
  const of = (pred: (n: FlowNode) => boolean) => flow.nodes.filter(pred);
  stack([...of((n) => n.type === "people" && n.fields.group !== "staff"), ...of((n) => n.type === "data"), ...of((n) => n.type === "people" && n.fields.group === "staff")], 40);
  stack([...of((n) => n.type === "system"), ...of((n) => n.type === "purpose")], 360);
  const subOf = (id: string) => flow.edges.filter((e) => e.kind === "sub_processor" && e.from === id).map((e) => flow.nodes.find((n) => n.id === e.to)!).filter(Boolean);
  const hasParent = new Set(flow.edges.filter((e) => e.kind === "sub_processor").map((e) => e.to));
  const outside: FlowNode[] = [];
  for (const c of of((n) => n.type === "company" && !hasParent.has(n.id))) outside.push(c, ...subOf(c.id).filter((x) => !outside.includes(x)));
  outside.push(...of((n) => n.type === "company" && !outside.includes(n)));
  stack(outside, BOUNDARY_X + 60);
  return {
    ...flow,
    nodes: flow.nodes.map((n) => {
      const p = pos.get(n.id) ?? n.position;
      return { ...n, position: p, inside: p.x + 140 < BOUNDARY_X };
    }),
  };
}
