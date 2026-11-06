import { ReactFlowProvider } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyLever, derive, openKeys, tierOfData } from "../engine/derive";
import { ruleSet } from "../engine/ruleset";
import type { Flow } from "../engine/types";
import { APP_NAME } from "./brand";
import { Canvas } from "./Canvas";
import { Coach } from "./Coach";
import { PrivacyNote } from "./Privacy";
import { Compare } from "./Compare";
import { FlowCtx, traceOf, type Ctx, type Trace } from "./context";
import { Drawer } from "./Drawer";
import { applyProduct, cards, disconnect, downloadJson, smartConnect } from "./flowOps";
import { FrontDoor } from "./FrontDoor";
import { nameWarning } from "./names";
import { Interview } from "./Interview";
import { RulesPage, ScreeningPage } from "./Pages";
import { describeChange } from "./plain";
import { Rail, type LastChange } from "./Rail";
import { ScanReport } from "./ScanReport";
import { PackPage } from "./PackPage";
import { cardFor } from "./cardLibrary";
import { type LighterRoute } from "./lighter";

type View = "questions" | "canvas" | "screening" | "report" | "rules" | "compare" | "pack";
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
  const [checking, setChecking] = useState(false);
  const [replay, setReplay] = useState(0);
  const [rulesOnly, setRulesOnly] = useState(false);
  const flowRef = useRef(flow);
  flowRef.current = flow;
  /** Undo history: past flows and, after an undo, the ones undone. Typing in a box coalesces into one step. */
  const past = useRef<Flow[]>([]);
  const future = useRef<Flow[]>([]);
  const lastPush = useRef(0);
  const [historyTick, setHistoryTick] = useState(0);

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
    if (prev && prev.id === next.id) {
      // Quiet edits (typing a field) within a second of each other are one undo step.
      const now = Date.now();
      if (!(what === null && now - lastPush.current < 1000 && past.current.length)) past.current = [...past.current.slice(-99), prev];
      lastPush.current = what === null ? now : 0;
      future.current = [];
      setHistoryTick((t) => t + 1);
    }
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

  const step = useCallback((dir: "undo" | "redo") => {
    const cur = flowRef.current;
    const from = dir === "undo" ? past.current : future.current;
    const to = dir === "undo" ? future.current : past.current;
    if (!cur || !from.length) return;
    const target = from[from.length - 1];
    from.splice(from.length - 1, 1);
    to.push(cur);
    lastPush.current = 0;
    const before = derive(cur, ruleSet, { cheapest: false });
    const after = derive(target, ruleSet, { cheapest: false });
    setLastChange({ what: dir === "undo" ? "Undid the last change" : "Redid the change", changes: describeChange(before, after, target, ruleSet) });
    flowRef.current = target;
    setFlow(target);
    setPreview(false);
    setHistoryTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "z") { e.preventDefault(); step(e.shiftKey ? "redo" : "undo"); }
      if (e.key.toLowerCase() === "y") { e.preventDefault(); step("redo"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const open = (f: Flow, to: "questions" | "canvas") => {
    past.current = [];
    future.current = [];
    setHistoryTick((t) => t + 1);
    // From the questions, the picture comes first and the answer waits for Check it. Anything else opens already checked.
    setFlow({ ...f, checked: to === "canvas" ? f.checked !== false : f.checked === true });
    setView(to);
    setSelected(null);
    setLastChange(null);
    setReplay(0);
  };

  const checkIt = () => {
    // The engine is instant; the pause shows what was read, line by line, before the answer lands.
    setChecking(true);
    window.setTimeout(() => {
      update({ ...flowRef.current!, checked: true }, "asked for the answer");
      setChecking(false);
      setReplay(0);
    }, 1700);
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
      checked: flow.checked !== false,
      remove: (id) => {
        const n = flow.nodes.find((x) => x.id === id);
        update({ ...flow, nodes: flow.nodes.filter((x) => x.id !== id), edges: flow.edges.filter((e) => e.from !== id && e.to !== id) }, `removed ${n?.title ?? "a box"}`);
        setSelected((s) => (s === id ? null : s));
      },
      setLever: (id, lever, value) => {
        const n = flow.nodes.find((x) => x.id === id);
        const def = n ? ruleSet.rules.levers[n.type].find((l) => l.id === lever) : undefined;
        const optionLabel = def?.options?.find(([v]) => v === value)?.[1];
        const said = typeof value === "boolean" ? `turned ${value ? "on" : "off"}` : `set to ${optionLabel ?? String(value).replace(/_/g, " ")}`;
        let next = applyLever(flow, id, lever, value);
        // A partner decides things with you: that's what joint or independent means, so say so on the card too.
        if (lever === "role" && (value === "joint_controller" || value === "independent_controller") && !n?.levers.decides_purpose) next = applyLever(next, id, "decides_purpose", true);
        update(next, `${n?.title}: "${def?.label ?? lever.replace(/_/g, " ")}" ${said}`);
      },
      setField: (id, field, value) => update(patchNode(id, (n) => ({ ...n, fields: { ...n.fields, [field]: value } })), null),
      setTitle: (id, title) => update(patchNode(id, (n) => ({ ...n, title })), null),
      replace: (next, what) => update(next, what),
      allowedAtTier: (id, lever, value) => {
        if (flow.mode !== "tier_first" || flow.tier_pinned == null) return true;
        const n = flow.nodes.find((x) => x.id === id);
        if (!n || n.type !== "data") return true;
        return tierOfData({ ...n, levers: { ...n.levers, [lever]: value } }, ruleSet) <= flow.tier_pinned;
      },
    };
  }, [flow, d, selected, highlight, trace, preview, update]);

  if (!flow || !d || !ctx) {
    if (rulesOnly) {
      return (
        <div className="app">
          <div className="topbar">
            <button type="button" className="btn" onClick={() => setRulesOnly(false)}>Back</button>
            <span className="title" style={{ padding: 0 }}>Where the rules come from</span>
          </div>
          <RulesPage set={ruleSet} />
        </div>
      );
    }
    return (
      <div className="app">
        <div className="topbar">
          <span className="title" style={{ padding: 0 }}>{APP_NAME}</span>
          <span className="spacer" />
          <PrivacyNote onCleared={() => { setFlow(null); setReplay(0); }} />
          <button type="button" className="btn sm" onClick={() => setReplay((n) => n + 1)}>How does this work?</button>
        </div>
        <FrontDoor set={ruleSet} onOpen={open} onRules={() => setRulesOnly(true)} />
        <Coach screen="door" replay={replay} />
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
          <span className="meta">{flow.status.replace("_", " ")} · {d.open_count} to do</span>
          <span className="spacer" />
          <div className="seg" role="tablist" aria-label="View">
            {([["questions", "Questions"], ["canvas", "Canvas"], ["pack", "Finish"], ["screening", "Record"], ["rules", "Rules"]] as [View, string][]).map(([v, label]) => (
              <button key={v} type="button" className={view === v ? "on" : ""} onClick={() => { setView(v); setReplay(0); }}>{label}</button>
            ))}
            {flow.source?.kind === "scan" && flow.source.report != null && <button type="button" className={view === "report" ? "on" : ""} onClick={() => { setView("report"); setReplay(0); }}>Report</button>}
            {flow.pinned && <button type="button" className={view === "compare" ? "on" : ""} onClick={() => setView("compare")}>Compare</button>}
          </div>
          <PrivacyNote onCleared={() => { setFlow(null); setSelected(null); }} />
          <button type="button" className="btn" onClick={() => setReplay((n) => n + 1)} title="Show the first-time guide for this screen again">Tips</button>
          <button type="button" className="btn dk" style={{ boxShadow: "4px 4px 0 var(--paperwork)" }} onClick={() => downloadJson(`${flow.title.replace(/[^\w-]+/g, "-").toLowerCase()}.plainflow.json`, flow)}>
            Save
          </button>
          <button type="button" className="btn" onClick={() => { if (confirm("Close this? Save it first if you want to keep it.")) { setFlow(null); setSelected(null); } }}>Close</button>
        </div>

        {flow.mode === "tier_first" && view === "canvas" && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 16px", borderBottom: "2px solid var(--ink)", background: "var(--paper-2)" }}>
            <span className="lab">Staying inside a level</span>
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
                <Canvas
                  onChange={update}
                  reveal={reveal}
                  pin={() => update({ ...flow, pinned: { nodes: structuredClone(flow.nodes), edges: structuredClone(flow.edges) } }, "pinned a copy to compare")}
                  pinned={!!flow.pinned}
                  undo={() => step("undo")}
                  redo={() => step("redo")}
                  canUndo={historyTick >= 0 && past.current.length > 0}
                  canRedo={historyTick >= 0 && future.current.length > 0}
                  toggleTier={() =>
                    flow.mode === "tier_first"
                      ? update({ ...flow, mode: "flow_first", tier_pinned: null }, "building freely again")
                      : update({ ...flow, mode: "tier_first", tier_pinned: Math.max(...Object.values(d.tiers), 0) }, "staying inside a level")
                  }
                />
                {selNode && (
                  <Drawer
                    node={selNode}
                    onProduct={(pid) => update(applyProduct(flow, selNode.id, pid, ruleSet), `${selNode.title}: product set to ${pid ?? "something else"}`)}
                    onLoadCard={(cardId) => {
                      const fields = cardId.startsWith("library:") ? cardFor(cardId.slice(8))?.fields ?? {} : cards[cardId].fields;
                      update(
                        { ...flow, nodes: flow.nodes.map((n) => (n.id === selNode.id ? { ...n, fields: { ...n.fields, ...structuredClone(fields), card_ref: cardId } } : n)) },
                        `${selNode.title}: used saved card`,
                      );
                    }}
                    onConnect={(otherId) => {
                      const other = flow.nodes.find((n) => n.id === otherId);
                      update(smartConnect(flow, selNode.id, otherId), `connected ${selNode.title} to ${other?.title ?? "a box"}`);
                    }}
                    onDisconnect={(edgeId) => {
                      const e = flow.edges.find((x) => x.id === edgeId);
                      const other = flow.nodes.find((n) => n.id === (e?.from === selNode.id ? e?.to : e?.from));
                      update(disconnect(flow, edgeId), `disconnected ${selNode.title} from ${other?.title ?? "a box"}`);
                    }}
                    onDelete={() => {
                      update({ ...flow, nodes: flow.nodes.filter((n) => n.id !== selNode.id), edges: flow.edges.filter((e) => e.from !== selNode.id && e.to !== selNode.id) }, `removed ${selNode.title}`);
                      setSelected(null);
                    }}
                  />
                )}
              </div>
              <Rail
                tryLighter={(r: LighterRoute) =>
                  update(
                    { ...r.altFlow, pinned: { nodes: structuredClone(flow.nodes), edges: structuredClone(flow.edges) } },
                    `tried the lighter route: ${r.feature.label} instead of ${r.systemTitle} (your way is pinned as A)`,
                  )
                }
                setLicence={(id) => update({ ...flow, organisation: { ...flow.organisation, m365_licence: id } }, null)}
                finish={() => { setView("pack"); setReplay(0); }}
                checkIt={checkIt}
                checking={checking}
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
          <Coach
            key={view === "canvas" ? (flow.checked === false ? "canvas" : "answer") : view}
            screen={view === "canvas" ? (flow.checked === false ? "canvas" : "answer") : view}
            replay={replay}
            delayMs={view === "canvas" && reveal ? (flow.nodes.length * 0.18 + 1.6) * 1000 : 400}
          />
          {view === "rules" && <RulesPage set={ruleSet} />}
          {view === "report" && <ScanReport flow={flow} />}
          {view === "pack" && <PackPage flow={flow} d={d} set={ruleSet} />}
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
