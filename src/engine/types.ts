import type { NodeType } from "./expr";

export type { NodeType };

export interface FlowNode {
  id: string;
  type: NodeType;
  title: string;
  position: { x: number; y: number };
  inside: boolean;
  collapse?: "pill" | "standard" | "detail";
  levers: Record<string, unknown>;
  fields: Record<string, unknown>;
}

export type EdgeKind = "carries" | "about" | "by" | "runs" | "sub_processor" | "feeds";

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  data_id?: string | null;
}

export interface ChangeEntry {
  at: string;
  who: string;
  what: string;
  reopened?: string[];
}

export interface Flow {
  id: string;
  title: string;
  story?: string;
  mode: "flow_first" | "tier_first";
  tier_pinned: number | null;
  status: "draft" | "with_dpo" | "approved" | "live" | "review_due" | "retired";
  retrospective?: boolean;
  owner?: string;
  organisation: { name: string; type: string; default_lawful_basis?: string; /** Which Microsoft 365 licence, for the lighter route's costs. */ m365_licence?: string };
  dates?: { created?: string; launch?: string | null; running_since?: string | null; review?: string | null };
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  pinned?: { nodes: FlowNode[]; edges: FlowEdge[] } | null;
  /** A role, not a name: the person with authority to change the project, who accepts the risk that's left. */
  risk_owner?: string | null;
  /** What was asked in the Q&A and how it was answered, keyed by question and node. Anything not here was assumed. */
  answers?: Record<string, string>;
  /** The front-door sentence this flow was built from, kept so it can be changed after the questions. */
  sentence_input?: SentenceInput | null;
  /** True until the first Check it: boxes are folded to their titles so the shape shows before the detail. */
  first_draw?: boolean;
  /** False until the person has looked at the picture and asked for the answer. The rail stays quiet until then. */
  checked?: boolean;
  /** Where the flow came from when it wasn't drawn by hand: a code scan. */
  source?: { kind: "scan"; repo: string; score: number | null; risk: string | null; triggers: string[]; scanned_at: string | null; /** The scanner's full report, for the Report tab. */ report?: unknown } | null;
  changelog?: ChangeEntry[];
}

export interface Source { label: string; url: string }

/** The front-door sentence: who puts which data about whom into which tool, to do what. Roles and groups, never names. */
export interface SentenceInput {
  role: string;
  data: { kind: string | null; label: string }[];
  about: { kind: string | null; label: string };
  under18: "all_adults" | "some_under_18" | "under_16" | "under_13";
  product: string | null;
  otherTool: { name: string; ai: boolean } | null;
  purpose: { kind: string | null; label: string };
}

export interface Law { id: string; ref: string; name: string; says: string; why: string; url: string }

export interface LeverDef {
  id: string;
  label: string;
  kind: "toggle" | "choice";
  face: boolean;
  options?: [string, string][];
  sentence: string;
  example: string;
}

export interface Rules {
  version: string;
  owner: string;
  review_date: string;
  expression_help: string;
  sources: Record<string, Source>;
  tier1_categories: string[];
  tier3_categories: string[];
  safety_categories: string[];
  large_scale_threshold: number;
  tier_rules: { note: string; rules: { tier: number; when: string; because: string }[] };
  pseudonymisation_credit: { enabled: boolean; applies_when: string; effect: string; why: string };
  tiers: Record<string, { label: string; rule: string; plain: string; examples: string; can: string; law?: string[]; basis?: TierBasis }>;
  /** Why the levels are what they are: shown on the Rules page and in the pack's tier note. */
  tiers_about: { why: string; crosswalk_note: string; limits: string[] };
  policy: { note: string; source: string; unowned: string; allowed: string; allowed_plan: string; unlisted: string; allowed_inside: string; allowed_partner: string; no: string; no_unlisted: string; yes_title: string; no_title: string };
  sanctioned: { note: string; unlisted_max_tier: number; list: Record<string, { max_tier: number; ai: boolean }> };
  blocked: { note: string; rules: { id: string; when: string; message: string; ways_out: string[] }[] };
  locks: { type: NodeType; lever: string; when: string; value: unknown; reason: string }[];
  screening: { id: string; group: "mandatory" | "criteria"; text: string; type: NodeType; when: string; because: string; source: string; law?: string }[];
  outcome: { order: string[]; labels: Record<string, string>; plain: Record<string, string>; none_if?: string; required_if: string; recommended_if: string };
  use_case_floor: { note: string; levels: { id: string; label: string; min_outcome: string }[]; by_use_case: Record<string, string> };
  risk: { level: string; when: string }[];
  effort: { rules: { when: string; signoff: string; time: string }[]; signoff_labels: Record<string, string>; time_labels: Record<string, string> };
  verdict: { id: string; label: string; when: string; say: string }[];
  bright_lines: { note: string; power_imbalance_groups: string[]; rules: { id: string; kind: "stop" | "consult"; type: NodeType | "flow"; when: string; title: string; say: string; ways_out: string[]; source: string; law?: string }[] };
  notes: { when: string; say: string }[];
  assumptions: { note: string; rules: { id: string; when: string; text: string; who: string; if_wrong: string }[] };
  always_human: { note: string; always: string[]; when_full_dpia: string[] };
  cheapest_change: { note: string; candidates: { type: NodeType; lever: string; to: unknown; when: string; cost: string; how: string }[] };
  levers: Record<NodeType, LeverDef[]> & { note: string };
  role_hints: { note: string; rules: { when: string; say: string }[] };
  categories: [string, string][];
}

export interface RequirementDef {
  id: string;
  title: string;
  short: string;
  rail?: boolean;
  per?: NodeType;
  for: string;
  when: string;
  status?: { when: string; status: string }[];
  cause?: { text?: string; screening?: string[]; type?: NodeType; where?: string; floor?: boolean };
  filled_from: string;
  left_for_person: string;
  meaning: string;
  owner: string;
  effort: string;
  source: string;
  law?: string;
  build_order: number;
}

export interface RequirementsCatalogue {
  note: string;
  owner_labels: Record<string, string>;
  effort_labels: Record<string, string>;
  status_labels: Record<string, string>;
  requirements: RequirementDef[];
}

export interface Plan { max_tier: number; ai: boolean; dpa: boolean; trains: boolean; cost: string; note: string }

export interface Product {
  name: string;
  company: string | null;
  sub_processors: string[];
  is_ai: boolean;
  keeps_data_default: string;
  trains_on_inputs_default: boolean | string;
  notes?: string;
  /** The same product is a different thing on each plan; the plan decides the tier it may take. */
  plans?: Record<string, Plan>;
  /** "An app we're building": the hosting question follows. */
  hosting_question?: boolean;
}

export interface Products {
  note: string;
  /** When the plan and supplier facts were last researched; shown wherever an answer rests on them. */
  research_checked?: string;
  plan_labels: Record<string, string>;
  companies: Record<string, { name: string; region_default: string; dpa_url: string | null; notes: string }>;
  products: Record<string, Product>;
  custom_app_hosting: { note: string; options: [string, string][] };
  supplier_questions: string[];
}

/** The evidence behind one level: law ids, guidance ids, and the sentence that is this organisation's choice. */
export interface TierBasis {
  law: string[];
  guidance: string[];
  policy: string;
  harm: string;
  crosswalk: string;
}

export interface RuleSet {
  rules: Rules;
  laws: Record<string, Law>;
  requirements: RequirementsCatalogue;
  products: Products;
}

export interface Requirement {
  key: string;
  id: string;
  title: string;
  short: string;
  status: string;
  rail: boolean;
  node: string | null;
  cause: { text: string; nodes: string[] };
  meaning: string;
  owner: string;
  effort: string;
  source: Source | null;
  law: Law | null;
  left_for_person: string;
  build_order: number;
}

export interface EdgeInfo {
  tier: number;
  data: string[];
  crosses: boolean;
  blocked: null | { rule: string; message: string; ways_out: string[] };
}

export interface ScreeningAnswer {
  id: string;
  yes: boolean;
  group: "mandatory" | "criteria";
  text: string;
  because: string[];
  nodes: string[];
  source: Source | null;
  law: Law | null;
}

export interface CheapestChange {
  node: string;
  node_title: string;
  lever: string;
  to: unknown;
  removes: string[];
  unblocks: number;
  cost: string;
  how: string;
}

export interface Derivation {
  tiers: Record<string, number>;
  tier_because: Record<string, string>;
  screening_tiers: Record<string, number>;
  highest_tier: number;
  reach: Record<string, string[]>;
  edges: Record<string, EdgeInfo>;
  crossings: { edge: string; tier: number; to: string; blocked: boolean }[];
  blocked: { edge: string; from: string; to: string; message: string; ways_out: string[] }[];
  locks: Record<string, Record<string, string>>;
  facts: Record<string, Record<string, unknown>>;
  screening: Record<string, ScreeningAnswer>;
  mandatory_yes: number;
  criteria_yes: number;
  outcome_from_screening: string;
  credit_applied: boolean;
  use_case_floor: string | null;
  floor_raised: boolean;
  outcome: string;
  requirements: Requirement[];
  open_count: number;
  risk: string;
  effort: { signoff: string; time: string };
  verdict: { id: string; label: string; say: string };
  bright_lines: { id: string; kind: "stop" | "consult"; node: string | null; title: string; say: string; ways_out: string[]; source: Source | null; law: Law | null }[];
  notes: string[];
  /** Standing assumptions the answer rests on, for the pack to ask people to check. */
  assumptions: { id: string; text: string; who: string; if_wrong: string }[];
  needs_person: string[];
  role_hints: Record<string, string[]>;
  cheapest_change: CheapestChange | null;
}
