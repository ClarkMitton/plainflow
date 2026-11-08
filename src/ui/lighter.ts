// The lighter route: for a tool outside the organisation, the part of the tenant they already pay for
// (Microsoft 365 or Google Workspace) that does the same job, with the four weights side by side: things to do,
// contracts to sign, level of risk, cost. It never overrules: "Try it" pins their way as A so they can compare and go back.
import m365 from "../../data/m365.json";
import google from "../../data/google.json";
import { derive } from "../engine/derive";
import type { Derivation, Flow, RuleSet } from "../engine/types";
import { applyProduct } from "./flowOps";

type Feature = { label: string; product: string; does: string; caveat: string; addon_cost: string | null; included_note: string | null };
interface TenantData {
  checked: string;
  licences: Record<string, { label: string; sector: string; includes: string[] }>;
  features: Record<string, Feature>;
  equivalents: { by_product: Record<string, string[]>; by_purpose: Record<string, string[]>; by_data: Record<string, string[]> };
}
export type TenantId = "m365" | "google";
/** The two platforms that act as an organisation's tenant, each with the data file that says what it includes. */
export const tenants: Record<TenantId, { label: string; company: string; licenceLabel: string; data: TenantData }> = {
  m365: { label: "Microsoft 365", company: "microsoft", licenceLabel: "Your Microsoft 365 licence", data: m365 as TenantData },
  google: { label: "Google Workspace", company: "google_workspace", licenceLabel: "Your Google Workspace edition", data: google as TenantData },
};

/** Which tenant this organisation is on: what they said, else the one already on the canvas, else Microsoft. */
export function tenantFor(flow: Flow): TenantId {
  const said = flow.organisation.tenant as TenantId | undefined;
  if (said && tenants[said]) return said;
  const companies = new Set(flow.nodes.filter((n) => n.type === "company").map((n) => String(n.fields.company_id ?? "")));
  if (companies.has("google_workspace") && !companies.has("microsoft")) return "google";
  return "m365";
}
export const licencesFor = (t: TenantId) => tenants[t].data.licences;
export const checkedFor = (t: TenantId) => tenants[t].data.checked;
/** Kept for callers that only know Microsoft. */
export const licences = tenants.m365.data.licences;
export const m365Checked = tenants.m365.data.checked;

export interface Weights {
  verdict: string;
  verdictId: string;
  levelAllowed: number | null;
  toDo: number;
  contracts: number;
  hardLines: number;
  blocked: number;
  cost: string;
}

export interface LighterRoute {
  systemId: string;
  systemTitle: string;
  theirs: Weights;
  feature: Feature & { id: string };
  ours: Weights;
  altFlow: Flow;
  /** True when ours is no heavier on any weight and lighter on at least one. */
  lighter: boolean;
}

function weigh(flow: Flow, d: Derivation, cost: string): Weights {
  const companies = flow.nodes.filter((n) => n.type === "company");
  const level = companies.length ? Math.min(...companies.map((c) => Number(d.facts[c.id]?.sanctioned_max_tier ?? 3))) : null;
  return {
    verdict: d.verdict.label,
    verdictId: d.verdict.id,
    levelAllowed: level,
    toDo: d.open_count,
    contracts: d.requirements.filter((r) => ["dpa_card", "supplier_questions", "dsa_outline", "transfer_mechanism"].includes(r.id) && r.status === "to_do").length,
    hardLines: d.bright_lines.length,
    blocked: d.blocked.length,
    cost,
  };
}

/** The cost line for a tenant feature under the organisation's licence or edition. */
export function featureCost(featureId: string, licence: string, tenant: TenantId = "m365"): string {
  const T = tenants[tenant].data;
  const f = T.features[featureId];
  const lic = T.licences[licence] ?? T.licences.unknown;
  if (lic.includes.includes(featureId)) return licence === "unknown" ? (f.included_note ?? "included") : `included in your ${lic.label}`;
  return f.addon_cost ?? f.included_note ?? "check your licence";
}

/** What the person's tool costs them today, from the product's plan if it has one. */
function theirCost(flow: Flow, systemId: string, set: RuleSet): string {
  const sys = flow.nodes.find((n) => n.id === systemId)!;
  const product = set.products.products[String(sys.fields.product_id ?? "")];
  const plan = product?.plans?.[String(sys.levers.plan ?? "free")];
  return plan ? plan.cost : product ? "see supplier" : "unknown";
}

/** Swap the tool for one in the tenant: the old supplier and the companies behind it go, the new ones come. */
export function swapProduct(flow: Flow, systemId: string, productId: string, set: RuleSet): Flow {
  const sys = flow.nodes.find((n) => n.id === systemId);
  if (!sys) return flow;
  const old = set.products.products[String(sys.fields.product_id ?? "")];
  const oldCompanies = new Set([old?.company, ...(old?.sub_processors ?? [])].filter(Boolean) as string[]);
  const fedByOthers = (companyId: string) =>
    flow.edges.some((e) => e.to === companyId && e.from !== systemId && flow.nodes.find((n) => n.id === e.from)?.type === "system");
  // Companies this tool brought (by directory id, or an unknown supplier wired only to this tool) leave with it.
  const leaving = new Set(
    flow.nodes
      .filter((n) => n.type === "company" && !n.inside && !fedByOthers(n.id))
      .filter((n) => (n.fields.company_id ? oldCompanies.has(String(n.fields.company_id)) : flow.edges.some((e) => e.from === systemId && e.to === n.id)))
      .map((n) => n.id),
  );
  const pruned: Flow = {
    ...flow,
    nodes: flow.nodes.filter((n) => !leaving.has(n.id)),
    edges: flow.edges.filter((e) => !leaving.has(e.from) && !leaving.has(e.to)),
  };
  return applyProduct(pruned, systemId, productId, set);
}

export function lighterRoutes(flow: Flow, d: Derivation, set: RuleSet): LighterRoute[] {
  const tenant = tenantFor(flow);
  const T = tenants[tenant].data;
  const licence = String(flow.organisation.m365_licence ?? "unknown");
  const out: LighterRoute[] = [];
  for (const sys of flow.nodes.filter((n) => n.type === "system")) {
    const pid = String(sys.fields.product_id ?? "");
    const product = set.products.products[pid];
    // Already on the tenant's own route, or inside: nothing lighter to offer.
    if (product?.company === tenants[tenant].company) continue;
    let featureIds: string[] = T.equivalents.by_product[pid] ?? [];
    if (!featureIds.length) {
      const purposeKinds = flow.nodes.filter((n) => n.type === "purpose").map((n) => String(n.fields.kind ?? ""));
      const dataKinds = flow.nodes.filter((n) => n.type === "data").map((n) => String(n.fields.kind ?? ""));
      featureIds = [
        ...dataKinds.flatMap((k) => T.equivalents.by_data[k] ?? []),
        ...purposeKinds.flatMap((k) => T.equivalents.by_purpose[k] ?? []),
      ];
    }
    featureIds = [...new Set(featureIds)];
    if (!featureIds.length) continue;
    const theirs = weigh(flow, d, theirCost(flow, sys.id, set));
    for (const fid of featureIds.slice(0, 2)) {
      const feature = T.features[fid];
      if (!feature) continue;
      const altFlow = swapProduct(flow, sys.id, feature.product, set);
      const altD = derive(altFlow, set, { cheapest: false });
      const ours = weigh(altFlow, altD, featureCost(fid, licence, tenant));
      const noHeavier = ours.toDo <= theirs.toDo && ours.contracts <= theirs.contracts && ours.hardLines <= theirs.hardLines && ours.blocked <= theirs.blocked;
      const lighterSomewhere = ours.toDo < theirs.toDo || ours.contracts < theirs.contracts || ours.hardLines < theirs.hardLines || ours.blocked < theirs.blocked;
      out.push({ systemId: sys.id, systemTitle: sys.title, theirs, feature: { id: fid, ...feature }, ours, altFlow, lighter: noHeavier && lighterSomewhere });
    }
  }
  return out;
}
