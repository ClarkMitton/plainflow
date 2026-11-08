// derive(flow, ruleSet) -> Derivation
// Pure. No React, no network, no mutation of inputs. Follows docs/05-rules-engine.md in order.
// Every decision comes from data/rules.json or data/requirements.json; this file only
// works out graph facts (what reaches what) and runs the expressions.

import { fill, test, type Env } from "./expr";
import type {
  CheapestChange, Derivation, EdgeInfo, Flow, FlowNode, Requirement, RuleSet, ScreeningAnswer,
} from "./types";

const DATA_EDGES = new Set(["carries", "feeds"]);

interface Scope {
  vars: Record<string, unknown>;
  byType: Record<string, Env[]>;
}

function makeEnvs(flow: Flow, nodeVars: Record<string, Record<string, unknown>>, scope: Scope) {
  const constants = scope.vars;
  const global: Env = {
    lookup: (n) => constants[n],
    nodes: (t) => scope.byType[t] ?? [],
  };
  const envs: Record<string, Env> = {};
  for (const n of flow.nodes) {
    const v = nodeVars[n.id];
    envs[n.id] = {
      lookup: (k) => (k in v ? v[k] : global.lookup(k)),
      nodes: global.nodes,
    };
  }
  scope.byType = {};
  for (const n of flow.nodes) (scope.byType[n.type] ??= []).push(envs[n.id]);
  return { global, envs };
}

/** "A", "A and B", "A, B and C". */
function andList(xs: string[]): string {
  return xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs.join("");
}

/** A role mid-sentence: "Deputy principal" reads "the deputy principal", "A senior leader" stays, "DPO" keeps its capitals. */
function asRole(s: string): string {
  const acronym = s.length > 1 && s[1] !== s[1].toLowerCase();
  const t = acronym ? s : s[0].toLowerCase() + s.slice(1);
  return /^(a|an|the|our|my|you|someone|somebody|whoever)\b/i.test(t) ? t : `the ${t}`;
}

export function derive(flow: Flow, set: RuleSet, opts: { cheapest?: boolean } = {}): Derivation {
  const { rules, requirements: catalogue } = set;
  const lawOf = (id?: string) => (id && set.laws?.[id]) || null;
  const nodes = flow.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = flow.edges.filter((e) => byId.has(e.from) && byId.has(e.to));

  // Variables visible to every expression: constants first, results get added as we go.
  const scope: Scope = {
    vars: {
      tier1_categories: rules.tier1_categories,
      tier3_categories: rules.tier3_categories,
      safety_categories: rules.safety_categories,
      large_scale_threshold: rules.large_scale_threshold,
      power_imbalance_groups: rules.bright_lines.power_imbalance_groups,
      risk_owner: flow.risk_owner?.trim() ? asRole(flow.risk_owner.trim()) : null,
      retrospective: !!flow.retrospective,
    },
    byType: {},
  };

  // Node variables: levers, then fields, then meta. Derived facts are added below.
  const vars: Record<string, Record<string, unknown>> = {};
  for (const n of nodes) {
    vars[n.id] = {
      ...n.fields,
      ...n.levers,
      id: n.id,
      title: n.title,
      type: n.type,
      inside: n.inside,
      categories: (n.fields.categories as string[] | undefined) ?? [],
    };
  }
  let { global, envs } = makeEnvs(flow, vars, scope);

  // Locks: a locked lever takes its locked value, with a reason the UI shows.
  const locks: Record<string, Record<string, string>> = {};
  for (const lock of rules.locks) {
    for (const n of nodes.filter((x) => x.type === lock.type)) {
      if (test(lock.when, envs[n.id])) {
        vars[n.id][lock.lever] = lock.value;
        (locks[n.id] ??= {})[lock.lever] = lock.reason;
      }
    }
  }

  // 1. Tier per data node.
  const tiers: Record<string, number> = {};
  const tierBecause: Record<string, string> = {};
  const screeningTiers: Record<string, number> = {};
  for (const n of nodes.filter((x) => x.type === "data")) {
    const hit = rules.tier_rules.rules.find((r) => test(r.when, envs[n.id]));
    const tier = hit ? hit.tier : 1;
    tiers[n.id] = tier;
    tierBecause[n.id] = hit ? hit.because : "";
    const credit = rules.pseudonymisation_credit.enabled && vars[n.id].identifiability === "pseudonymised";
    screeningTiers[n.id] = credit ? Math.max(0, tier - 1) : tier;
    Object.assign(vars[n.id], { tier, screening_tier: screeningTiers[n.id] });
  }
  const highestTier = Math.max(0, ...Object.values(tiers));

  // What data reaches each node, following carries and feeds wires.
  const reach: Record<string, Set<string>> = {};
  for (const n of nodes) reach[n.id] = new Set(n.type === "data" ? [n.id] : []);
  const carried = (e: (typeof edges)[number]) =>
    e.data_id && tiers[e.data_id] !== undefined ? [e.data_id] : [...reach[e.from]];
  for (let changed = true, guard = 0; changed && guard < 100; guard++) {
    changed = false;
    for (const e of edges) {
      if (!DATA_EDGES.has(e.kind)) continue;
      for (const d of carried(e)) {
        if (!reach[e.to].has(d)) { reach[e.to].add(d); changed = true; }
      }
    }
  }

  // 2 and 3. Crossings and blocked wires.
  const planOf = (from: FlowNode | undefined) => {
    const pid = from?.fields.product_id as string | undefined;
    const product = pid ? set.products.products[pid] : undefined;
    const plan = String(from?.levers.plan ?? "free");
    return product?.plans ? { id: plan, info: product.plans[plan] ?? product.plans.free, plans: product.plans } : null;
  };
  // The plan the tool is on overrides the sanctioned list: free ChatGPT and ChatGPT Business are different products.
  const sanctionFor = (company: FlowNode, from: FlowNode | undefined) => {
    const plan = planOf(from);
    if (plan?.info) return { max_tier: plan.info.max_tier, ai: plan.info.ai };
    const list = rules.sanctioned.list;
    const cid = company.fields.company_id as string | undefined;
    const pid = from?.fields.product_id as string | undefined;
    return (cid && list[cid]) || (pid && list[pid]) || null;
  };
  const edgeInfo: Record<string, EdgeInfo> = {};
  const crossings: Derivation["crossings"] = [];
  const blocked: Derivation["blocked"] = [];
  for (const e of edges) {
    const from = byId.get(e.from)!;
    const to = byId.get(e.to)!;
    const data = DATA_EDGES.has(e.kind) ? carried(e) : [];
    const tier = data.length ? Math.max(...data.map((d) => tiers[d] ?? 0)) : -1;
    const crosses = data.length > 0 && from.inside && !to.inside;
    const info: EdgeInfo = { tier, data, crosses, blocked: null };
    if (data.length && tier >= 0) {
      const s = to.type === "company" ? sanctionFor(to, from) : null;
      const maxTier = to.inside ? 3 : s ? s.max_tier : rules.sanctioned.unlisted_max_tier;
      // "Send less: cut {data} down" has to name everything over the line, not just the highest.
      const overMax = data.filter((d) => (tiers[d] ?? 0) > maxTier);
      const topData = (overMax.length ? overMax : data.filter((d) => tiers[d] === tier)).map((d) => byId.get(d)!.title);
      const plan = planOf(from);
      const wireVars: Record<string, unknown> = {
        tier,
        max_tier: maxTier,
        company: to.title,
        to_role: to.type === "company" ? String(to.levers.role ?? "processor") : "inside",
        plan_note: plan ? ` on ${set.products.plan_labels[plan.id] ?? plan.id}` : "",
        data: andList(topData),
        into_ai: !!vars[to.id].is_ai,
        via_ai: !!vars[from.id].is_ai || !!vars[to.id].is_ai,
        ai_approved: s ? s.ai : true,
        crosses,
      };
      const wire: Env = { lookup: (k) => (k in wireVars ? wireVars[k] : global.lookup(k)), nodes: global.nodes };
      const rule = rules.blocked.rules.find((r) => test(r.when, wire));
      if (rule) {
        info.blocked = { rule: rule.id, message: fill(rule.message, wire), ways_out: rule.ways_out.map((w) => fill(w, wire)) };
        blocked.push({ edge: e.id, from: e.from, to: e.to, message: info.blocked.message, ways_out: info.blocked.ways_out });
      }
    }
    edgeInfo[e.id] = info;
    if (crosses && tier >= 0) crossings.push({ edge: e.id, tier, to: e.to, blocked: !!info.blocked });
  }

  // Graph facts for each node type.
  const aiSystems = nodes.filter((n) => n.type === "system" && vars[n.id].is_ai);
  for (const n of nodes) {
    const v = vars[n.id];
    if (n.type === "data") {
      v.reaches_ai = aiSystems.some((s) => reach[s.id].has(n.id));
      v.crosses = crossings.some((c) => edgeInfo[c.edge].data.includes(n.id));
    }
    if (n.type === "system") {
      const product = set.products.products[String(n.fields.product_id ?? "")];
      v.has_plans = !!product?.plans;
    }
    if (n.type === "purpose") {
      const sources = [...new Set([...reach[n.id]]
        .map((d) => String(byId.get(d)?.fields.source_system ?? "").trim())
        .filter(Boolean))];
      v.sources = sources;
      v.source_count = sources.length;
    }
    if (n.type === "company") {
      const inbound = edges.filter((e) => e.to === n.id && DATA_EDGES.has(e.kind));
      v.receives_tier = Math.max(-1, ...inbound.map((e) => edgeInfo[e.id].tier));
      v.crossing = inbound.some((e) => edgeInfo[e.id].crosses);
      v.blocked = inbound.some((e) => edgeInfo[e.id].blocked);
      v.sends_inside = edges.some((e) => e.from === n.id && DATA_EDGES.has(e.kind) && byId.get(e.to)!.inside);
      v.has_card = n.fields.card_ref != null;
      const parentEdge = edges.find((e) => e.kind === "sub_processor" && e.to === n.id);
      const parent = parentEdge ? byId.get(parentEdge.from) : undefined;
      v.parent_title = parent?.title ?? null;
      const art28 = (parent?.fields.art28 ?? {}) as Record<string, unknown>;
      v.parent_authorised = !!art28.sub_processor_authorisation;
      const feederEdge = inbound.find((e) => byId.get(e.from)?.type === "system") ?? inbound[0];
      const feeder = feederEdge ? byId.get(feederEdge.from) : undefined;
      const s = sanctionFor(n, feeder);
      v.sanctioned_max_tier = s ? s.max_tier : rules.sanctioned.unlisted_max_tier;
      v.listed = !!(rules.sanctioned.list[String(n.fields.company_id ?? "")] || rules.sanctioned.list[String(feeder?.fields.product_id ?? "")]);
      const plan = planOf(feeder);
      v.plan_label = plan ? set.products.plan_labels[plan.id] ?? plan.id : null;
      if (plan?.info) {
        v.trains_on_inputs = plan.info.trains;
        (locks[n.id] ??= {}).trains_on_inputs = `Decided by the plan ${feeder?.title ?? "the tool"} is on (${String(v.plan_label)}).`;
      }
      // The cheapest plan that would take the data this company receives, and what it costs.
      const needed = plan ? Object.entries(plan.plans).find(([, x]) => x.max_tier >= Number(v.receives_tier)) : undefined;
      v.plan_needed = needed ? set.products.plan_labels[needed[0]] ?? needed[0] : null;
      v.plan_needed_cost = needed ? needed[1].cost : null;
    }
  }
  ({ global, envs } = makeEnvs(flow, vars, scope));

  // 4. Screening A1 to A17.
  const screening: Record<string, ScreeningAnswer> = {};
  for (const q of rules.screening) {
    const hits = nodes.filter((n) => n.type === q.type && test(q.when, envs[n.id]));
    screening[q.id] = {
      id: q.id,
      yes: hits.length > 0,
      group: q.group,
      text: q.text,
      because: hits.map((n) => fill(q.because, envs[n.id])),
      nodes: hits.map((n) => n.id),
      source: rules.sources[q.source] ?? null,
      law: lawOf(q.law),
    };
    scope.vars[q.id] = hits.length > 0;
  }
  const answers = Object.values(screening);
  const mandatoryYes = answers.filter((a) => a.yes && a.group === "mandatory").length;
  const criteriaYes = answers.filter((a) => a.yes && a.group === "criteria").length;
  Object.assign(scope.vars, { mandatory_yes: mandatoryYes, criteria_yes: criteriaYes, highest_tier: highestTier });

  // 5. Outcome, with the pseudonymisation credit.
  const order = rules.outcome.order;
  let outcomeIdx = test(rules.outcome.required_if, global) ? 2 : test(rules.outcome.recommended_if, global) ? 1 : 0;
  if (rules.outcome.none_if && test(rules.outcome.none_if, global)) outcomeIdx = 0;
  const outcomeFromScreening = order[outcomeIdx];
  const creditApplied = rules.pseudonymisation_credit.enabled && test(rules.pseudonymisation_credit.applies_when, global);
  if (creditApplied) outcomeIdx = Math.max(0, outcomeIdx - 1);

  // 6. Use case floor from AI nodes. Raises the outcome, never lowers it.
  const levels = rules.use_case_floor.levels;
  let floorIdx = -1;
  for (const s of aiSystems) {
    const id = rules.use_case_floor.by_use_case[String(s.fields.use_case ?? "")];
    floorIdx = Math.max(floorIdx, levels.findIndex((l) => l.id === id));
  }
  if (creditApplied && floorIdx > 0) floorIdx -= 1;
  const floor = floorIdx >= 0 ? levels[floorIdx] : null;
  let floorRaised = false;
  if (floor) {
    const min = order.indexOf(floor.min_outcome);
    if (min > outcomeIdx) { outcomeIdx = min; floorRaised = true; }
  }
  const outcome = order[outcomeIdx];
  Object.assign(scope.vars, { outcome, use_case_floor: floor?.id ?? null, credit_applied: creditApplied });

  // 7. Requirements.
  const source = (id: string) => rules.sources[id] ?? null;
  const made: Requirement[] = [];
  const build = (onlyRail: boolean) => {
    for (const def of catalogue.requirements) {
      const rail = def.rail !== false;
      if (rail !== onlyRail) continue;
      const targets = def.per ? nodes.filter((n) => n.type === def.per).map((n) => envs[n.id]) : [global];
      for (const env of targets) {
        if (!test(def.when, env)) continue;
        const node = def.per ? String(env.lookup("id")) : null;
        const status = def.status?.find((s) => test(s.when, env))?.status ?? "to_do";
        made.push({
          key: node ? `${def.id}:${node}` : def.id,
          id: def.id,
          title: def.title,
          short: def.short,
          status,
          rail,
          node,
          cause: causeOf(def.cause, env, node),
          meaning: def.meaning,
          owner: def.owner,
          effort: def.effort,
          source: source(def.source),
          law: lawOf(def.law),
          left_for_person: def.left_for_person,
          build_order: def.build_order,
        });
      }
    }
  };
  const causeOf = (cause: (typeof catalogue.requirements)[number]["cause"], env: Env, node: string | null) => {
    if (!cause) return { text: "", nodes: node ? [node] : [] };
    if (node) return { text: fill(cause.text ?? "", env), nodes: [node] };
    if (cause.screening) {
      const yes = cause.screening.map((id) => screening[id]).filter((a) => a?.yes);
      const ids = [...new Set(yes.flatMap((a) => a.nodes))];
      let text = cause.text ?? yes.map((a) => `${a.id}: ${a.because.join("; ")}`).join(". ");
      if (cause.floor && floorRaised && floor) text = `${text}${text ? ". " : ""}AI use case sets the floor: ${floor.label}`;
      return { text, nodes: ids };
    }
    if (cause.type && cause.where) {
      const hits = nodes.filter((n) => n.type === cause.type && test(cause.where!, envs[n.id]));
      const titles = andList(hits.map((n) => n.title));
      const text = (cause.text ?? "{titles}").replace("{titles}", titles);
      return { text, nodes: hits.map((n) => n.id) };
    }
    return { text: cause.text ?? "", nodes: [] };
  };
  build(true);
  const openCount = made.filter((r) => r.status === "to_do").length;
  scope.vars.open_count = openCount;
  build(false);

  // 8. Risk. 9. Effort. Verdict.
  const risk = rules.risk.find((r) => test(r.when, global))?.level ?? "low";
  const eff = rules.effort.rules.find((r) => test(r.when, global));
  scope.vars.blocked_count = blocked.length;

  // Bright lines: hard stops with a reason. Everything else goes to a risk owner, not a verdict.
  const brightLines: Derivation["bright_lines"] = [];
  for (const bl of rules.bright_lines.rules) {
    const targets = bl.type === "flow" ? [{ id: null as string | null, env: global }] : nodes.filter((n) => n.type === bl.type).map((n) => ({ id: n.id as string | null, env: envs[n.id] }));
    for (const t of targets) {
      if (!test(bl.when, t.env)) continue;
      brightLines.push({
        id: bl.id,
        kind: bl.kind,
        node: t.id,
        title: fill(bl.title, t.env),
        say: fill(bl.say, t.env),
        ways_out: bl.ways_out.map((w) => fill(w, t.env)),
        source: rules.sources[bl.source] ?? null,
        law: lawOf(bl.law),
      });
    }
  }
  scope.vars.stop_count = brightLines.filter((b) => b.kind === "stop").length;
  scope.vars.consult_count = brightLines.filter((b) => b.kind === "consult").length;
  const notes = rules.notes.filter((x) => test(x.when, global)).map((x) => fill(x.say, global));
  const assumptions = (rules.assumptions?.rules ?? []).filter((x) => test(x.when, global)).map((x) => ({ id: x.id, text: x.text, who: x.who, if_wrong: x.if_wrong }));
  const v = rules.verdict.find((r) => test(r.when, global)) ?? rules.verdict[rules.verdict.length - 1];

  const needsPerson = [
    ...rules.always_human.always,
    ...(outcome === "required" ? rules.always_human.when_full_dpia : []),
    ...made.filter((r) => r.rail && r.status === "to_do" && r.left_for_person !== "nothing").map((r) => `${r.title}: ${r.left_for_person}`),
  ];

  const roleHints: Record<string, string[]> = {};
  for (const n of nodes.filter((x) => x.type === "company")) {
    const says = rules.role_hints.rules.filter((r) => test(r.when, envs[n.id])).map((r) => r.say);
    if (says.length) roleHints[n.id] = says;
  }

  const facts: Record<string, Record<string, unknown>> = {};
  for (const n of nodes) facts[n.id] = vars[n.id];

  const result: Derivation = {
    tiers,
    tier_because: tierBecause,
    screening_tiers: screeningTiers,
    highest_tier: highestTier,
    reach: Object.fromEntries(Object.entries(reach).map(([k, s]) => [k, [...s]])),
    edges: edgeInfo,
    crossings,
    blocked,
    locks,
    facts,
    screening,
    mandatory_yes: mandatoryYes,
    criteria_yes: criteriaYes,
    outcome_from_screening: outcomeFromScreening,
    credit_applied: creditApplied,
    use_case_floor: floor?.id ?? null,
    floor_raised: floorRaised,
    outcome,
    requirements: made,
    open_count: openCount,
    risk,
    effort: { signoff: eff?.signoff ?? "owner", time: eff?.time ?? "same_day" },
    verdict: { id: v.id, label: capitalise(fill(v.label, global)), say: capitalise(fill(v.say, global)) },
    bright_lines: brightLines,
    notes,
    assumptions,
    needs_person: needsPerson,
    role_hints: roleHints,
    cheapest_change: null,
  };

  // 10. Cheapest change: try each allowed single flip, keep the one that closes most open items.
  if (opts.cheapest !== false) result.cheapest_change = cheapestChange(flow, set, result, envs);
  return result;
}

export function openKeys(d: Derivation): string[] {
  return d.requirements.filter((r) => r.rail && r.status === "to_do").map((r) => r.key);
}

export function applyLever(flow: Flow, nodeId: string, lever: string, to: unknown, set?: RuleSet): Flow {
  return {
    ...flow,
    nodes: flow.nodes.map((n) => {
      if (n.id !== nodeId) return n;
      if (lever === "company_id" && set) {
        const company = set.products.companies[String(to)];
        return { ...n, title: company?.name ?? n.title, fields: { ...n.fields, company_id: to, card_ref: null } };
      }
      return { ...n, levers: { ...n.levers, [lever]: to } };
    }),
  };
}

function sanctionedEquivalent(set: RuleSet, tier: number): string | null {
  const entries = Object.entries(set.rules.sanctioned.list).filter(([id, s]) => s.max_tier >= tier && s.ai && set.products.companies[id]);
  return entries[0]?.[0] ?? null;
}

function cheapestChange(flow: Flow, set: RuleSet, base: Derivation, envs: Record<string, Env>): CheapestChange | null {
  const before = new Set(openKeys(base));
  let best: CheapestChange | null = null;
  for (const c of set.rules.cheapest_change.candidates) {
    for (const n of flow.nodes.filter((x) => x.type === c.type)) {
      if (!test(c.when, envs[n.id])) continue;
      let to = c.to;
      if (to === "sanctioned_equivalent") {
        to = sanctionedEquivalent(set, Number(base.facts[n.id].receives_tier ?? 0));
        if (!to) continue;
      }
      const after = derive(applyLever(flow, n.id, c.lever, to, set), set, { cheapest: false });
      const stillOpen = new Set(openKeys(after));
      const removes = [...before].filter((k) => !stillOpen.has(k));
      const unblocks = base.blocked.length + base.bright_lines.length - after.blocked.length - after.bright_lines.length;
      if (unblocks < 0 || (unblocks === 0 && removes.length === 0)) continue;
      // Clearing a red wire or a hard line wins. Among changes that clear the same amount, the first in the list wins:
      // the list is ordered by what the person gives up, and a plan change gives up nothing about the idea.
      if (!best || unblocks > best.unblocks || (unblocks === best.unblocks && unblocks === 0 && removes.length > best.removes.length)) {
        best = { node: n.id, node_title: n.title, lever: c.lever, to, removes, unblocks, cost: c.cost, how: c.how };
      }
    }
  }
  return best;
}

/** The tier one data node would have. Used by tier-first mode to grey out options above the pinned tier. */
export function tierOfData(node: FlowNode, set: RuleSet): number {
  const v: Record<string, unknown> = {
    ...node.fields,
    ...node.levers,
    categories: (node.fields.categories as string[] | undefined) ?? [],
    tier1_categories: set.rules.tier1_categories,
    tier3_categories: set.rules.tier3_categories,
  };
  const env: Env = { lookup: (k) => v[k], nodes: () => [] };
  return set.rules.tier_rules.rules.find((r) => test(r.when, env))?.tier ?? 1;
}

const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
