import { ReactFlowProvider } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyLever, derive, openKeys, tierOfData } from "../engine/derive";
import { ruleSet } from "../engine/ruleset";
import type { Flow } from "../engine/types";
import { APP_NAME } from "./brand";
import { Canvas } from "./Canvas";
import { Compare } from "./Compare";
import { FlowCtx, traceOf, type Ctx, type Trace } from "./context";
import { Drawer } from "./Drawer";
import { applyProduct, cards, downloadJson } from "./flowOps";
import { FrontDoor } from "./FrontDoor";
import { nameWarning } from "./names";
import { Interview } from "./Interview";
import { RulesPage, ScreeningPage } from "./Pages";
import { describeChange } from "./plain";
import { Rail, type LastChange } from "./Rail";

type View = "questions" | "canvas" | "screening" | "rules" | "compare";
const STORE = "plainflow.current";

function loadSaved(): Flow | null {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Flow) : null;
  } catch {
    return null;
  }
}

export function App() {
  const [flow, setFlow] = useState<Flow | null>(loadSaved);
  const [view, setView] = useState<View>("canvas");
  const [selected, setSelected] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [trace, setTraceState] = useState<Trace | null>(null);
  const [preview, setPreview] = useState(false);
  const [lastChange, setLastChange] = useState<LastChange | null>(null);
  const [reveal, setReveal] = useState(false);
  const flowRef = useRef(flow);
  flowRef.current = flow;

  useEffect(() => {
    try {
      if (flow) localStorage.setItem(STORE, JSON.stringify(flow));
      else localStorage.removeItem(STORE);
    } catch {
      /* private window: autosave is a convenience only */
    }
  }, [flow]);

  const d = useMemo(() => (flow ? derive(flow, ruleSet) : null), [flow]);

  /** Every change with a name goes through here: the change log stays honest and the rail says what it changed. */
  const update = useCallback((next: Flow, what: string | null) => {
    const prev = flowRef.current;
    let out = next;
    if (prev && what && what !== "moved") {
      const before = derive(prev, ruleSet, { cheapest: false });
      const after = derive(next, ruleSet, { cheapest: false });
      const was = new Set(openKeys(before));
      const reopened = openKeys(after).filter((k) => !was.has(k));
      out = { ...next, changelog: [...(next.changelog ?? []), { at: new Date().toISOString(), who: next.owner ?? "", what, reopened }] };
      setLastChange({ what: what[0].toUpperCase() + what.slice(1), changes: describeChange(before, after, next, ruleSet) });
    }
    flowRef.current = out;
    setFlow(out);
    setPreview(false);
  }, []);

  const open = (f: Flow, to: "questions" | "canvas") => {
    setFlow(f);
    setView(to);
    setSelected(null);
    setLastChange(null);
  };

  const finishQuestions = () => {
    setView("canvas");
    setLastChange(null);
    setReveal(true);
    window.setTimeout(() => setReveal(false), ((flowRef.current?.nodes.length ?? 6) * 0.18 + 1.5) * 1000);
  };

  const ctx: Ctx | null = useMemo(() => {
    if (!flow || !d) return null;
    const patchNode = (id: string, fn: (n: Flow["nodes"][number]) => Flow["nodes"][number]) => ({ ...flow, nodes: flow.nodes.map((n) => (n.id === id ? fn(n) : n)) });
    return {
      flow,
      d,
      set: ruleSet,
      selected,
      highlight,
      select: setSelected,
      trace,
      setTrace: (from) => setTraceState(from ? traceOf(flow, d, from) : null),
      previewing: preview && d.cheapest_change ? { node: d.cheapest_change.node, lever: d.cheapest_change.lever } : null,
      setCollapse: (id, collapse) => update(patchNode(id, (n) => ({ ...n, collapse })), null),
      setLever: (id, lever, value) => {
        const n = flow.nodes.find((x) => x.id === id);
        const def = n ? ruleSet.rules.levers[n.type].find((l) => l.id === lever) : undefined;
        const said = typeof value === "boolean" ? `turned ${value ? "on" : "off"}` : `set to ${String(value).replace(/_/g, " ")}`;
        update(applyLever(flow, id, lever, value), `${n?.title}: "${def?.label ?? lever.replace(/_/g, " ")}" ${said}`);
      },
      setField: (id, field, value) => update(patchNode(id, (n) => ({ ...n, fields: { ...n.fields, [field]: value } })), null),
      setTitle: (id, title) => update(patchNode(id, (n) => ({ ...n, title })), null),
      allowedAtTier: (id, lever, value) => {
        if (flow.mode !== "tier_first" || flow.tier_pinned == null) return true;
        const n = flow.nodes.find((x) => x.id === id);
        if (!n || n.type !== "data") return true;
        return tierOfData({ ...n, levers: { ...n.levers, [lever]: value } }, ruleSet) <= flow.tier_pinned;
      },
    };
  }, [flow, d, selected, highlight, trace, preview, update]);

  if (!flow || !d || !ctx) {
    return (
      <div className="app">
        <div className="topbar"><span className="title" style={{ padding: 0 }}>{APP_NAME}</span></div>
        <FrontDoor set={ruleSet} onOpen={open} />
      </div>
    );
  }

  const selNode = flow.nodes.find((n) => n.id === selected) ?? null;
  const titleWarn = nameWarning(flow.title);
  const pinnedTier = flow.tier_pinned ?? 2;

  return (
    <FlowCtx.Provider value={ctx}>
      <div className="app">
        <div className="topbar">
          <input className="title" value={flow.title} onChange={(e) => setFlow({ ...flow, title: e.target.value })} aria-label="Flow title" title={titleWarn ?? ""} style={titleWarn ? { color: "var(--rq)" } : undefined} />
          <span className="meta">
            {flow.status.replace("_", " ")} {flow.version} · {flow.nodes.length} nodes · {d.open_count} to do{flow.retrospective ? " · already in use" : ""}
          </span>
          <span className="spacer" />
          <div className="seg" role="tablist" aria-label="View">
            {(["questions", "canvas", "screening", "rules"] as View[]).map((v) => (
              <button key={v} type="button" className={view === v ? "on" : ""} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>
            ))}
            {flow.pinned && <button type="button" className={view === "compare" ? "on" : ""} onClick={() => setView("compare")}>Compare</button>}
          </div>
          <div className="seg" aria-label="Mode">
            <button type="button" className={flow.mode === "flow_first" ? "on" : ""} onClick={() => update({ ...flow, mode: "flow_first", tier_pinned: null }, "switched to flow first")}>Flow first</button>
            <button type="button" className={flow.mode === "tier_first" ? "on" : ""} onClick={() => update({ ...flow, mode: "tier_first", tier_pinned: Math.max(...Object.values(d.tiers), 0) }, "switched to tier first")}>Tier first</button>
          </div>
          <button type="button" className="btn" onClick={() => { update({ ...flow, pinned: { nodes: structuredClone(flow.nodes), edges: structuredClone(flow.edges) } }, "pinned as A"); }}>
            {flow.pinned ? "Re-pin A" : "Pin as A"}
          </button>
          <button type="button" className="btn dk" style={{ boxShadow: "4px 4px 0 var(--paperwork)" }} onClick={() => downloadJson(`${flow.title.replace(/[^\w-]+/g, "-").toLowerCase()}.flow.json`, flow)}>
            Save JSON
          </button>
          <button type="button" className="btn" onClick={() => { if (confirm("Close this flow? Save it first if you want to keep it.")) { setFlow(null); setSelected(null); } }}>Close</button>
        </div>

        {flow.mode === "tier_first" && view === "canvas" && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 16px", borderBottom: "2px solid var(--ink)", background: "var(--paper-2)" }}>
            <span className="lab">Tier set first</span>
            <div className="seg sm">
              {[0, 1, 2, 3].map((t) => (
                <button key={t} type="button" className={pinnedTier === t ? "on" : ""} onClick={() => update({ ...flow, tier_pinned: t }, `tier set to ${t}`)}>T{t}</button>
              ))}
            </div>
            <strong>{ruleSet.rules.tiers[String(pinnedTier)].label}</strong>
            <span>{ruleSet.rules.tiers[String(pinnedTier)].rule}</span>
            <span className="mu" style={{ fontSize: 13 }}>Grey means not at this tier. Pick a higher tier and they open up.</span>
          </div>
        )}

        <div className="body">
          {view === "canvas" && (
            <ReactFlowProvider>
              <div className="stage">
                <Canvas onChange={update} reveal={reveal} />
                {selNode && (
                  <Drawer
                    node={selNode}
                    onProduct={(pid) => update(applyProduct(flow, selNode.id, pid, ruleSet), `${selNode.title}: product set to ${pid ?? "something else"}`)}
                    onLoadCard={(cardId) =>
                      update(
                        { ...flow, nodes: flow.nodes.map((n) => (n.id === selNode.id ? { ...n, fields: { ...n.fields, ...structuredClone(cards[cardId].fields), card_ref: cardId } } : n)) },
                        `${selNode.title}: used saved card`,
                      )
                    }
                    onDelete={() => {
                      update({ ...flow, nodes: flow.nodes.filter((n) => n.id !== selNode.id), edges: flow.edges.filter((e) => e.from !== selNode.id && e.to !== selNode.id) }, `removed ${selNode.title}`);
                      setSelected(null);
                    }}
                  />
                )}
              </div>
              <Rail
                setRiskOwner={(role) => update({ ...flow, risk_owner: role || null }, null)}
                lastChange={lastChange}
                preview={preview}
                setPreview={setPreview}
                setHighlight={setHighlight}
                applyCheapest={() => {
                  const c = d.cheapest_change;
                  if (c) update(applyLever(flow, c.node, c.lever, c.to, ruleSet), `cheapest change: ${c.node_title} ${c.lever.replace(/_/g, " ")} to ${String(c.to)}`);
                }}
              />
            </ReactFlowProvider>
          )}
          {view === "questions" && <Interview flow={flow} d={d} set={ruleSet} onChange={update} onDone={finishQuestions} />}
          {view === "screening" && <ScreeningPage flow={flow} d={d} set={ruleSet} />}
          {view === "rules" && <RulesPage set={ruleSet} />}
          {view === "compare" && flow.pinned && (
            <Compare
              flow={flow}
              d={d}
              set={ruleSet}
              keepA={() => { update({ ...flow, nodes: flow.pinned!.nodes, edges: flow.pinned!.edges, pinned: null }, "kept version A"); setView("canvas"); }}
              goWithB={() => { update({ ...flow, pinned: null }, "went with version B"); setView("canvas"); }}
            />
          )}
        </div>
      </div>
    </FlowCtx.Provider>
  );
}
