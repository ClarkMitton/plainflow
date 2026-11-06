import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNode } from "../engine/types";
import { GROUP_LABEL, ROLE_LABEL, TYPE_LABEL, leverDef, useFlow } from "./context";
import { Lever } from "./Lever";
import { Term } from "./plain";

export type CardData = { node: FlowNode; reveal: number | null };

export function NodeCard({ data }: NodeProps & { data: CardData }) {
  const { node, reveal } = data;
  const { d, set, flow, selected, highlight, select, trace, setTrace, setCollapse, checked, remove } = useFlow();
  const facts = d.facts[node.id] ?? {};
  const locks = d.locks[node.id] ?? {};
  // Staff are adults; their age chips are noise.
  const face = set.rules.levers[node.type].filter((l) => l.face && !(node.type === "people" && node.fields.group === "staff" && l.id === "age_mix"));
  const hidden = set.rules.levers[node.type].length - face.length;

  const personalIn = flow.edges.some((e) => e.to === node.id && (d.edges[e.id]?.tier ?? -1) >= 1);
  const personalOut = flow.edges.some((e) => e.from === node.id && (d.edges[e.id]?.tier ?? -1) >= 1);
  const blockedIn = checked && flow.edges.some((e) => e.to === node.id && d.edges[e.id]?.blocked);

  let kind: string = TYPE_LABEL[node.type];
  if (node.type === "system" && facts.is_ai) kind = "System · AI";
  const role = ROLE_LABEL[String(node.levers.role)] ?? "";
  if (node.type === "people") kind = `People · ${GROUP_LABEL[String(node.fields.group)] ?? ""}`;

  const cls = ["n", `n-${node.type}`];
  if (selected === node.id) cls.push("sel");
  if (highlight.includes(node.id)) cls.push("hl");
  if (reveal != null) cls.push("appear");
  const hardLine = checked && d.bright_lines.some((b) => b.node === node.id && b.kind === "stop");
  if (hardLine) cls.push("stop");
  if (trace && !trace.nodes.has(node.id)) cls.push("dim");
  if (trace?.nodes.has(node.id)) cls.push("lit");
  const pill = node.collapse === "pill";
  if (pill) cls.push("pill");
  const toDo = checked ? d.requirements.filter((r) => r.rail && r.status === "to_do" && r.cause.nodes.includes(node.id)).length : 0;
  const handleTop = pill ? 29 : 82;

  const dpa = d.requirements.find((r) => r.key === `dpa_card:${node.id}`);
  const sub = d.requirements.find((r) => r.key === `sub_processor_check:${node.id}`);
  const tier = d.tiers[node.id];
  const product = node.fields.product_id ? set.products.products[String(node.fields.product_id)] : null;

  return (
    <div className={cls.join(" ")} style={reveal != null ? { animationDelay: `${reveal * 0.18}s` } : undefined}>
      <Handle type="target" position={Position.Left} id="l" className={personalIn ? "amb" : ""} style={{ top: handleTop }} />
      <Handle type="source" position={Position.Right} id="r" className={personalOut || (tier ?? 0) >= 1 ? "amb" : ""} style={{ top: handleTop }} />
      {(toDo > 0 || hardLine || blockedIn) && (
        <div className="badges nodrag">
          {hardLine && <button type="button" className="tag red" onClick={() => select(node.id)}>hard line</button>}
          {blockedIn && !hardLine && <button type="button" className="tag red" onClick={() => select(node.id)}>blocked</button>}
          {toDo > 0 && <button type="button" className="tag" onClick={() => select(node.id)} title="Things to do because of this node">{toDo} to do</button>}
        </div>
      )}
      {node.type === "company" && (
        <>
          <Handle type="target" position={Position.Top} id="t" style={{ left: "50%" }} />
          <Handle type="source" position={Position.Bottom} id="b" style={{ left: "50%" }} />
        </>
      )}
      <button type="button" className="nx nodrag" aria-label={`Remove ${node.title}`} title="Remove (Undo brings it back)" onClick={(e) => { e.stopPropagation(); remove(node.id); }}>×</button>
      <div
        className={`h h-${node.type}`}
        onClick={() => select(node.id)}
        onDoubleClick={() => setCollapse(node.id, pill ? "standard" : "pill")}
        onMouseEnter={() => setTrace({ node: node.id })}
        onMouseLeave={() => setTrace(null)}
        title="Click to open. Double-click to fold. Hover to trace where its data goes."
      >
        <p className="t">{node.title}</p>
        <p className="k nodrag" style={{ overflow: "visible" }}>
          {node.type === "company" ? (
            <>Company · <Term t={role.includes("independent") ? "controller" : role} /></>
          ) : (
            kind
          )}
        </p>
      </div>
      {!pill && <div className="b">
        {node.type === "data" && (
          <div className="r tip">
            how sensitive
            <span className="v meter" aria-label={`Tier ${tier} of 3`}>
              {[1, 2, 3].map((i) => <span key={i} className={`blk${i <= tier ? " on" : ""}${tier === 3 ? " t3" : ""}`} />)}
              <span>T{tier}</span>
            </span>
            <span className="tipbox">
              Tier {tier}: {set.rules.tiers[String(tier)]?.label}, because {d.tier_because[node.id]}.
              <em>{set.rules.tiers[String(tier)]?.rule}</em>
              {d.screening_tiers[node.id] !== tier && <em>Counts as Tier {d.screening_tiers[node.id]} for screening, because it is pseudonymised.</em>}
            </span>
          </div>
        )}
        {node.type === "system" && (
          <div className="r">
            product<span className="v">{product ? product.name.replace(/^Microsoft 365 /, "") : "not set"}</span>
          </div>
        )}
        {node.type === "company" && node.levers.role !== "sub_processor" && (
          <>
            <div className="r">
              <Term t="DPA" />
              <span className={`v ${dpa ? (dpa.status === "to_do" ? "rq" : "ok") : "mu"}`}>
                {dpa ? set.requirements.status_labels[dpa.status] : facts.blocked ? "blocked" : "not needed"}
              </span>
            </div>
            <div className="r">region<span className="v">{String(node.fields.region ?? "unknown")}</span></div>
          </>
        )}
        {node.type === "company" && node.levers.role === "sub_processor" && (
          <>
            <div className="r">
              authorised
              <span className={`v ${sub?.status === "covered" ? "ok" : "rq"}`}>{sub?.status === "covered" ? "in DPA" : "not yet"}</span>
            </div>
            <div className="r">region<span className="v">{String(node.fields.region ?? "unknown")}</span></div>
          </>
        )}
        {node.type !== "company" || node.levers.role !== "sub_processor"
          ? face.map((def) => {
              const lever = leverDef(set, node.type, def.id)!;
              return (
                <Lever key={def.id} nodeId={node.id} def={lever} value={facts[def.id] ?? node.levers[def.id]} lockReason={locks[def.id]} variant="face" />
              );
            })
          : null}
        {hidden > 0 && (
          <div className="r more nodrag" style={{ cursor: "pointer" }} onClick={() => select(node.id)}>
            + {hidden} more · open
          </div>
        )}
      </div>}
    </div>
  );
}
