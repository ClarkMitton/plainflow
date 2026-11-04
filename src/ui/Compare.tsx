import { useMemo } from "react";
import { derive } from "../engine/derive";
import type { Derivation, Flow, RuleSet } from "../engine/types";

interface Props {
  flow: Flow;
  d: Derivation;
  set: RuleSet;
  keepA(): void;
  goWithB(): void;
}

/** Pin A, try B. The changed levers, the deltas in big type, and what each version needs. */
export function Compare({ flow, d: b, set, keepA, goWithB }: Props) {
  const pinned = flow.pinned!;
  const flowA = useMemo(() => ({ ...flow, nodes: pinned.nodes, edges: pinned.edges }), [flow, pinned]);
  const a = useMemo(() => derive(flowA, set), [flowA, set]);
  const title = (id: string) => flow.nodes.find((n) => n.id === id)?.title ?? pinned.nodes.find((n) => n.id === id)?.title ?? id;

  const changes: string[] = [];
  for (const nb of flow.nodes) {
    const na = pinned.nodes.find((n) => n.id === nb.id);
    if (!na) { changes.push(`Added ${nb.title}`); continue; }
    for (const [k, v] of Object.entries(nb.levers)) if (na.levers[k] !== v) changes.push(`${nb.title}: ${k.replace(/_/g, " ")} ${String(na.levers[k])} to ${String(v)}`);
    if (na.inside !== nb.inside) changes.push(`${nb.title} moved ${nb.inside ? "inside" : "outside"}`);
  }
  for (const na of pinned.nodes) if (!flow.nodes.some((n) => n.id === na.id)) changes.push(`Removed ${na.title}`);
  if (pinned.edges.length !== flow.edges.length) changes.push(`Wires: ${pinned.edges.length} to ${flow.edges.length}`);

  const keys = [...new Set([...a.requirements, ...b.requirements].filter((r) => r.rail).map((r) => r.key))];
  const rowA = (k: string) => a.requirements.find((r) => r.key === k);
  const rowB = (k: string) => b.requirements.find((r) => r.key === k);
  const label = (s?: string) => (s ? set.requirements.status_labels[s] : "not needed");

  const delta = (name: string, x: string | number, y: string | number) => (
    <div>
      <p className="lab">{name}</p>
      <div className="big">
        {x} to <span className={x !== y ? "hl-amber" : ""}>{y}</span>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="inner">
        <p className="lab">Compare · A is pinned, B is the canvas now</p>
        <h1>{flow.title}</h1>
        <div style={{ display: "flex", gap: 44, flexWrap: "wrap", margin: "20px 0 28px" }}>
          {delta("To do", a.open_count, b.open_count)}
          {delta("Outcome", set.rules.outcome.labels[a.outcome], set.rules.outcome.labels[b.outcome])}
          {delta("Risk", a.risk, b.risk)}
          {delta("Effort", set.rules.effort.time_labels[a.effort.time], set.rules.effort.time_labels[b.effort.time])}
        </div>

        <div className="box" style={{ boxShadow: "5px 5px 0 var(--data)", maxWidth: 640 }}>
          <p className="lab" style={{ marginBottom: 4 }}>What changed</p>
          {changes.length ? <ul className="plain">{changes.map((c) => <li key={c}>{c}</li>)}</ul> : <div>Nothing yet. Go back to the canvas and flip a lever.</div>}
        </div>

        <h2>Paperwork</h2>
        <table className="tbl">
          <thead><tr><th>Item</th><th>For</th><th>A</th><th>B</th></tr></thead>
          <tbody>
            {keys.map((k) => {
              const ra = rowA(k), rb = rowB(k);
              const lifted = ra?.status === "to_do" && (!rb || rb.status !== "to_do");
              const added = rb?.status === "to_do" && (!ra || ra.status !== "to_do");
              return (
                <tr key={k}>
                  <td style={lifted ? { textDecoration: "line-through", color: "var(--muted-2)" } : undefined}>{(ra ?? rb)!.title}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{(ra ?? rb)!.node ? title((ra ?? rb)!.node!) : "flow"}</td>
                  <td className={ra?.status === "to_do" ? "rq" : "ok"}>{label(ra?.status)}</td>
                  <td className={rb?.status === "to_do" ? "rq" : "ok"} style={added ? { fontWeight: 700 } : undefined}>
                    {label(rb?.status)}{lifted && <span className="mu"> · lifted</span>}{added && " · new"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button type="button" className="btn" onClick={keepA}>Keep A</button>
          <button type="button" className="btn dk" style={{ boxShadow: "4px 4px 0 var(--data)" }} onClick={goWithB}>Go with B</button>
        </div>
      </div>
    </div>
  );
}
