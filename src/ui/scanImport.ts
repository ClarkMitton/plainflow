// Open a GDPR Repo Scanner report as a flow.
// The scanner (github.com/ClarkMitton/Node-TypeScript-API) reads an app's code and reports where personal
// data goes. This turns that report into the same picture Plainflow draws from a sentence, so the person
// gets the same answer: the app is the system, each outside service is a company, each kind of data it
// found is a data node. What code can't tell (ages, lawful basis, who signs) is left for the Q&A.
import type { Flow, FlowNode, RuleSet } from "../engine/types";
import { BOUNDARY_X, connect, emptyFlow, newNode } from "./flowOps";

/** The parts of the scanner's RepoIndex (CLI file) or scan record (web API) that we read. */
export interface ScanReport {
  repo?: string;
  repoName?: string;
  githubUrl?: string;
  description?: string | null;
  scannedAt?: string;
  createdAt?: string;
  summary?: { gdprScore?: number; riskLevel?: string };
  gdprScore?: number | null;
  riskLevel?: string | null;
  verifiedFlows?: { source?: string; sink?: string; dataType?: string; tags?: string[]; isAI?: boolean; aiProvider?: string }[];
  auditCards?: { tags?: string[] }[];
  findings?: { category?: string; tags?: string[] }[];
  auditSummary?: {
    aiFlowCount?: number;
    thirdPartyServices?: { name: string; category?: string; isAI?: boolean; regionHint?: string; residencyKnown?: boolean }[];
    dpiaScreening?: { dpiaRecommended?: boolean; detectedTriggers?: string[] };
    mediaCapture?: { detected?: boolean };
    conclusion?: string;
  } | null;
}

export function isScanReport(x: unknown): x is ScanReport {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return ("verifiedFlows" in o || "auditSummary" in o || "findings" in o) && !("nodes" in o);
}

/** Scanner service names that match a company in the product directory. Anything else is an unknown supplier. */
const COMPANY_IDS: Record<string, string> = { Supabase: "supabase", AWS: "aws", "Google Gemini": "google", Firebase: "google", "Google Analytics": "google" };

function regionOf(hint: string | undefined, known: boolean | undefined): string {
  if (!hint) return known ? "UK" : "unknown";
  const h = hint.toLowerCase();
  if (h.startsWith("eu-west-2") || h.includes("london") || h.startsWith("uk")) return "UK";
  if (h.startsWith("eu") || h.includes("europe")) return "EU";
  if (h.startsWith("us")) return "US";
  return "other";
}

export function flowFromScan(scan: ScanReport, set: RuleSet): Flow {
  const repo = (scan.repoName ?? scan.repo ?? "the app").replace(/^[^_/]+(__|\/)/, "").replace(/-/g, " ");
  const appName = repo[0].toUpperCase() + repo.slice(1);
  const flows = scan.verifiedFlows ?? [];
  const tags = new Set<string>([
    ...flows.flatMap((f) => f.tags ?? []),
    ...(scan.auditCards ?? []).flatMap((c) => c.tags ?? []),
    ...(scan.findings ?? []).flatMap((f) => f.tags ?? []),
  ]);
  const services = scan.auditSummary?.thirdPartyServices ?? [];
  const usesAI = services.some((s) => s.isAI) || flows.some((f) => f.isAI) || (scan.auditSummary?.aiFlowCount ?? 0) > 0 || tags.has("AI_PROCESSING");
  const identifiable = flows.some((f) => f.dataType === "IDENTIFIABLE") || tags.has("USER_DATA_STORAGE") || tags.has("USER_DATA_TRANSFER") || tags.has("POTENTIAL_IDENTIFIABLE_DATA") || (scan.findings ?? []).some((f) => f.category === "identity");
  const behavioural = flows.some((f) => f.dataType === "BEHAVIOURAL") || tags.has("BEHAVIOURAL_TRACKING") || tags.has("ANALYTICS_USAGE");

  const flow = emptyFlow(true);
  flow.title = appName;
  flow.source = {
    kind: "scan",
    repo: scan.githubUrl ?? scan.repo ?? scan.repoName ?? "",
    score: scan.gdprScore ?? scan.summary?.gdprScore ?? null,
    risk: scan.riskLevel ?? scan.summary?.riskLevel ?? null,
    triggers: scan.auditSummary?.dpiaScreening?.detectedTriggers ?? [],
    scanned_at: scan.scannedAt ?? scan.createdAt ?? null,
  };

  // Who it's about. Code can't tell ages; the Q&A asks. Children's data in the scan is the one strong hint.
  const users = newNode("people", { x: 40, y: 30 });
  users.title = "People who use it";
  users.fields.group = tags.has("CHILDREN_DATA") ? "learners" : "other";
  users.levers.age_mix = tags.has("CHILDREN_DATA") ? "some_under_18" : "all_adults";
  users.fields.description = "Users of the app, as far as the code shows";

  // What it handles: one data node per kind of data the scan could see.
  const dataNodes: FlowNode[] = [];
  const addData = (title: string, levers: Record<string, unknown>, categories: string[]) => {
    const d = newNode("data", { x: 40, y: 220 + dataNodes.length * 300 }, flow);
    d.title = title;
    Object.assign(d.levers, levers);
    d.fields.categories = categories;
    d.fields.source_system = appName;
    d.fields.about = [users.id];
    dataNodes.push(d);
  };
  if (identifiable || flows.length === 0) addData("Account details", {}, ["name", "email", "login"]);
  if (usesAI) addData("What people type in", { free_text_or_audio: true }, ["name", "free_text"]);
  if (behavioural) addData("What people do in it", {}, ["login", "usage_counts"]);
  if (tags.has("SPECIAL_CATEGORY_DATA")) addData("Sensitive details", { special_category: true }, ["name", "health"]);
  if (scan.auditSummary?.mediaCapture?.detected) addData("Photos, audio or video", { free_text_or_audio: true }, ["name", "images", "audio", "video"]);

  // The app itself, inside the organisation.
  const system = newNode("system", { x: 360, y: 160 });
  system.title = appName;
  system.levers.is_ai = usesAI;
  system.fields.use_case = usesAI ? "identifiable_work" : null;

  const purpose = newNode("purpose", { x: 360, y: 460 });
  const described = (scan.description ?? "").trim().split(/[.\n]/)[0];
  purpose.title = described ? described[0].toUpperCase() + described.slice(1, 60) : `Use ${appName}`;
  purpose.levers.decides_alone = tags.has("AUTOMATED_DECISION_MAKING");
  purpose.levers.staff_can_override = !tags.has("AUTOMATED_DECISION_MAKING");
  purpose.levers.tracks_behaviour = tags.has("BEHAVIOURAL_TRACKING");
  purpose.levers.ongoing = true;
  purpose.levers.privacy_notice_linked = false;
  purpose.fields.value = scan.auditSummary?.conclusion ?? "";

  // Every outside service the scan found, as a company. Unknown to our directory means unapproved until a card exists.
  const companies = services
    .filter((s) => s.category !== "Monitoring/Logging" || flows.some((f) => f.sink?.toLowerCase().includes(s.name.toLowerCase())))
    .map((s, i) => {
      const c = newNode("company", { x: BOUNDARY_X + 60, y: 40 + i * 240 });
      c.title = s.name;
      c.levers.role = "processor";
      c.levers.keeps_data = s.category === "Cloud data/storage" || s.category === "AI/LLM";
      c.levers.trains_on_inputs = false;
      c.fields.company_id = COMPANY_IDS[s.name] ?? null;
      c.fields.region = regionOf(s.regionHint, s.residencyKnown);
      c.fields.transfer_mechanism = c.fields.region === "UK" || c.fields.region === "EU" ? "none_needed" : "unknown";
      c.fields.retention = s.category === "Cloud data/storage" ? "until deleted" : "unknown";
      c.fields.deletion_route = "";
      if (!set.products.companies[String(c.fields.company_id ?? "")]) c.fields.company_id = c.fields.company_id ?? null;
      return c;
    });

  flow.nodes = [users, ...dataNodes, system, purpose, ...companies];
  let out = flow;
  out = connect(out, users.id, purpose.id);
  for (const d of dataNodes) out = connect(out, d.id, system.id);
  out = connect(out, system.id, purpose.id);
  for (const c of companies) out = connect(out, system.id, c.id);
  out.story = `${appName} handles ${dataNodes.map((d) => d.title.toLowerCase()).join(", ") || "data"} about ${users.title.toLowerCase()}${companies.length ? `, using ${companies.map((c) => c.title).join(", ")}` : ""}.`;
  out.changelog = [{ at: new Date().toISOString(), who: out.owner ?? "", what: `opened from a scan of ${out.source?.repo ?? "a repository"}`, reopened: [] }];
  return out;
}
