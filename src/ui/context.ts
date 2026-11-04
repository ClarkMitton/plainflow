import { createContext, useContext } from "react";
import type { Derivation, Flow, LeverDef, NodeType, RuleSet } from "../engine/types";

export interface Ctx {
  flow: Flow;
  d: Derivation;
  set: RuleSet;
  selected: string | null;
  highlight: string[];
  setLever(nodeId: string, lever: string, value: unknown): void;
  setField(nodeId: string, field: string, value: unknown): void;
  setTitle(nodeId: string, title: string): void;
  select(nodeId: string | null): void;
  /** In tier-first mode: is this lever value allowed for this data node at the pinned tier? */
  allowedAtTier(nodeId: string, lever: string, value: unknown): boolean;
  /** The route being traced on hover: the data's journey lit, everything else dimmed. */
  trace: Trace | null;
  setTrace(from: { node?: string; edge?: string } | null): void;
  /** The lever the cheapest change would flip, while it's being previewed. */
  previewing: { node: string; lever: string } | null;
  setCollapse(nodeId: string, collapse: "pill" | "standard"): void;
  /** Has the person asked for the answer yet? Before that, the picture is shown without verdicts or to-dos. */
  checked: boolean;
}

export interface Trace {
  data: string[];
  nodes: Set<string>;
  edges: Set<string>;
}

/** Every wire that carries any of the given data, and every node those wires touch. */
export function traceOf(flow: Flow, d: Derivation, from: { node?: string; edge?: string }): Trace | null {
  let data: string[] = [];
  if (from.edge) data = d.edges[from.edge]?.data ?? [];
  else if (from.node) {
    const n = flow.nodes.find((x) => x.id === from.node);
    data = n?.type === "data" ? [n.id] : d.reach[from.node] ?? [];
    // People don't carry data; trace the data that's about them.
    if (n?.type === "people") data = flow.nodes.filter((x) => x.type === "data" && ((x.fields.about as string[] | undefined) ?? []).includes(n.id)).map((x) => x.id);
    // A company that only receives through its parent still shows the parent's data.
    if (!data.length && n?.type === "company") {
      const parent = flow.edges.find((e) => e.kind === "sub_processor" && e.to === n.id)?.from;
      if (parent) data = d.reach[parent] ?? [];
    }
  }
  if (!data.length) return null;
  const edges = new Set<string>();
  const nodes = new Set<string>(data);
  for (const e of flow.edges) {
    if (d.edges[e.id]?.data.some((x) => data.includes(x))) {
      edges.add(e.id);
      nodes.add(e.from);
      nodes.add(e.to);
    }
  }
  for (const e of flow.edges) if (e.kind === "sub_processor" && nodes.has(e.from)) { edges.add(e.id); nodes.add(e.to); }
  if (from.node) nodes.add(from.node);
  return { data, nodes, edges };
}

export const FlowCtx = createContext<Ctx | null>(null);

export function useFlow(): Ctx {
  const c = useContext(FlowCtx);
  if (!c) throw new Error("FlowCtx missing");
  return c;
}

export function leverDef(set: RuleSet, type: NodeType, id: string): LeverDef | undefined {
  return set.rules.levers[type].find((l) => l.id === id);
}

export const TYPE_LABEL: Record<NodeType, string> = {
  people: "People",
  data: "Data",
  purpose: "Purpose",
  system: "System",
  company: "Company",
};

export const ROLE_LABEL: Record<string, string> = {
  processor: "processor",
  joint_controller: "joint controller",
  independent_controller: "independent controller",
  sub_processor: "sub-processor",
};

export const GROUP_LABEL: Record<string, string> = {
  learners: "learners",
  staff: "staff",
  parents: "parents",
  patients: "patients",
  customers: "customers",
  care: "people in care",
  public: "public",
  other: "other",
};
