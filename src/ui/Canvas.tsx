import {
  Background, BackgroundVariant, Controls, ReactFlow, ViewportPortal, applyNodeChanges, useReactFlow,
  type Edge, type Node, type NodeChange, type EdgeChange, type Connection,
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import type { Flow, NodeType } from "../engine/types";
import { useFlow } from "./context";
import { BOUNDARY_X, ZONE_WIDTH, connect, newNode, tidy } from "./flowOps";
import { NodeCard, type CardData } from "./NodeCard";
import { StoryStrip } from "./StoryStrip";
import { Wire, WireMarkers, type WireData } from "./Wire";

const nodeTypes = { card: NodeCard };
const edgeTypes = { wire: Wire };

const PALETTE: NodeType[] = ["people", "data", "purpose", "system", "company"];
const LABEL: Record<NodeType, string> = { people: "People", data: "Data", purpose: "Purpose", system: "System", company: "Company" };

interface Props {
  onChange(next: Flow, what: string): void;
  /** Just built from the Q&A: draw the nodes one by one, then the wires. */
  reveal?: boolean;
  pin(): void;
  pinned: boolean;
  toggleTier(): void;
}

export function Canvas({ onChange, reveal = false, pin, pinned, toggleTier }: Props) {
  const { flow, d, select, trace, setTrace } = useFlow();
  const { fitView } = useReactFlow();
  const [rfNodes, setRfNodes] = useState<Node<CardData>[]>([]);

  // Keep React Flow's measured nodes, but take content and position from the flow JSON.
  useEffect(() => {
    setRfNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]));
      return flow.nodes.map((n, i) => ({
        ...(old.get(n.id) ?? {}),
        id: n.id,
        type: "card",
        position: old.get(n.id)?.dragging ? old.get(n.id)!.position : n.position,
        data: { node: n, reveal: reveal ? i : null },
        dragHandle: ".h",
      }));
    });
  }, [flow.nodes, reveal]);

  const rfEdges: Edge<WireData>[] = useMemo(
    () =>
      flow.edges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        sourceHandle: e.kind === "sub_processor" ? "b" : "r",
        targetHandle: e.kind === "sub_processor" ? "t" : "l",
        type: "wire",
        data: {
          kind: e.kind,
          info: d.edges[e.id],
          dim: !!trace && !trace.edges.has(e.id),
          lit: !!trace && trace.edges.has(e.id),
        },
      })),
    [flow.edges, d.edges, trace],
  );

  const onNodesChange = (changes: NodeChange<Node<CardData>>[]) => {
    setRfNodes((prev) => applyNodeChanges(changes, prev));
    const removed = changes.filter((c) => c.type === "remove").map((c) => c.id);
    if (removed.length) {
      onChange(
        { ...flow, nodes: flow.nodes.filter((n) => !removed.includes(n.id)), edges: flow.edges.filter((e) => !removed.includes(e.from) && !removed.includes(e.to)) },
        `removed ${removed.map((id) => flow.nodes.find((n) => n.id === id)?.title).join(", ")}`,
      );
      select(null);
      return;
    }
    const moved = changes.filter((c) => c.type === "position" && c.dragging === false && c.position);
    if (moved.length) {
      let crossed = "";
      const nodes = flow.nodes.map((n) => {
        const c = moved.find((m) => m.type === "position" && m.id === n.id);
        if (!c || c.type !== "position" || !c.position) return n;
        const position = { x: Math.round(c.position.x / 12) * 12, y: Math.round(c.position.y / 12) * 12 };
        const inside = position.x + 140 < BOUNDARY_X;
        if (inside !== n.inside) crossed = `${n.title} moved ${inside ? "inside" : "outside"} the organisation`;
        return { ...n, position, inside };
      });
      onChange({ ...flow, nodes }, crossed || "moved");
    }
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    const removed = changes.filter((c) => c.type === "remove").map((c) => c.id);
    if (removed.length) onChange({ ...flow, edges: flow.edges.filter((e) => !removed.includes(e.id)) }, "removed a wire");
  };

  const onConnect = (c: Connection) => {
    if (!c.source || !c.target) return;
    const from = flow.nodes.find((n) => n.id === c.source)?.title;
    const to = flow.nodes.find((n) => n.id === c.target)?.title;
    onChange(connect(flow, c.source, c.target), `connected ${from} to ${to}`);
  };

  const add = (type: NodeType) => {
    const outside = type === "company";
    const count = flow.nodes.filter((n) => n.type === type).length;
    const n = newNode(type, { x: outside ? BOUNDARY_X + 60 : 40 + (count % 2) * 320, y: 40 + count * 60 }, flow);
    onChange({ ...flow, nodes: [...flow.nodes, n] }, `added ${LABEL[type]}`);
    select(n.id);
  };

  const tidyUp = () => {
    const heights = new Map(rfNodes.map((n) => [n.id, n.measured?.height]));
    onChange(tidy(flow, (id) => heights.get(id)), "tidied the layout");
    window.setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 60);
  };
  const allFolded = flow.nodes.length > 0 && flow.nodes.every((n) => n.collapse === "pill");
  const foldAll = () => {
    onChange({ ...flow, nodes: flow.nodes.map((n) => ({ ...n, collapse: allFolded ? "standard" : "pill" })) }, allFolded ? "unfolded every node" : "folded every node");
  };
  const org = flow.organisation.name && !flow.organisation.name.startsWith("[") ? flow.organisation.name : "your organisation";

  return (
    <div className={`canvas-wrap${reveal ? " reveal" : ""}${trace ? " tracing" : ""}`} style={{ ["--edge-delay" as string]: `${flow.nodes.length * 0.18 + 0.2}s` }}>
      <StoryStrip />
      <ReactFlow
        style={{ flex: 1 }}
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => select(null)}
        onEdgeMouseEnter={(_, e) => setTrace({ edge: e.id })}
        onEdgeMouseLeave={() => setTrace(null)}
        snapToGrid
        snapGrid={[12, 12]}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={1.6}
        deleteKeyCode={["Delete", "Backspace"]}
        proOptions={{ hideAttribution: true }}
      >
        <ViewportPortal>
          <div style={{ position: "absolute", left: BOUNDARY_X, top: -3000, width: ZONE_WIDTH, height: 6000, background: "var(--paper-2)", borderLeft: "2px dashed var(--ink)", zIndex: -1 }} />
          <div className="zone-label" style={{ transform: `translate(${BOUNDARY_X - 680}px, -52px)` }}>
            Inside {org}
            <small>You decide what happens to the data</small>
          </div>
          <div className="zone-label" style={{ transform: `translate(${BOUNDARY_X + 16}px, -52px)` }}>
            Outside
            <small>Companies that handle it for you</small>
          </div>
        </ViewportPortal>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--rule)" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
      <WireMarkers />

      <div className="palette" role="toolbar" aria-label="Add a node">
        <span className="lab" style={{ letterSpacing: ".08em" }}>Add</span>
        {PALETTE.map((t) => (
          <button key={t} type="button" onClick={() => add(t)} title={`Add a ${LABEL[t]} node`}>
            <span className="sw" style={{ boxShadow: `3px 3px 0 var(--${t})` }} />
            {LABEL[t]}
          </button>
        ))}
        <span className="sep" />
        <button type="button" onClick={tidyUp} title="Lay it out left to right, in the order the data travels">Tidy up</button>
        <button type="button" onClick={foldAll} title="Fold every node to its title, or open them all">{allFolded ? "Unfold all" : "Fold all"}</button>
        <span className="sep" />
        <button type="button" onClick={pin} title="Keep a copy of the canvas as it is now, then change things and compare">{pinned ? "Re-pin" : "Pin to compare"}</button>
        <button type="button" onClick={toggleTier} className={flow.mode === "tier_first" ? "on" : ""} title="Grey out anything that would take the data above a chosen level">{flow.mode === "tier_first" ? "Build freely" : "Stay in a level"}</button>
        <span className="sep" />
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 20, height: 5, background: "var(--data)" }} />
          personal data
        </span>
      </div>
    </div>
  );
}
