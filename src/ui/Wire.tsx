import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import type { EdgeInfo, EdgeKind } from "../engine/types";

export type WireData = {
  kind: EdgeKind;
  info?: EdgeInfo;
  /** Another route is being traced and this wire isn't on it. */
  dim: boolean;
  /** This wire is on the traced route. */
  lit: boolean;
};

// Right angles only: smooth-step with zero radius. Personal data is the only coloured wire,
// and it moves: a slow dash shows which way the data travels.
export function Wire(props: EdgeProps & { data: WireData }) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props;
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 0, offset: 24 });
  const info = data.info;
  const personal = (info?.tier ?? -1) >= 1;
  const blocked = !!info?.blocked;
  const carriesData = data.kind === "carries" || data.kind === "feeds";

  let style: React.CSSProperties = { stroke: "var(--ink)", strokeWidth: 2 };
  let arrow = "ink";
  if (data.kind === "sub_processor") style = { ...style, strokeDasharray: "6 5" };
  if (personal) { style = { stroke: "var(--data)", strokeWidth: 5 }; arrow = "amber"; }
  if (blocked) { style = { stroke: "var(--paperwork)", strokeWidth: 2.5, strokeDasharray: "8 6" }; arrow = "red"; }
  if (selected || data.lit) style = { ...style, strokeWidth: (Number(style.strokeWidth) || 2) + 2 };

  const label = info?.crosses && personal && !blocked ? `Level ${info.tier} crosses` : null;

  return (
    <g className={`wire${data.dim ? " dim" : ""}`}>
      <BaseEdge id={id} path={path} style={{ ...style, strokeLinejoin: "round", fill: "none" }} markerEnd={carriesData ? `url(#arrow-${arrow})` : undefined} interactionWidth={16} />
      {personal && !blocked && <path d={path} className="flowdash" fill="none" />}
      {blocked && (
        <EdgeLabelRenderer>
          <div className="tag red" style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${targetX - 26}px, ${targetY}px)` }}>✕</div>
        </EdgeLabelRenderer>
      )}
      {label && (
        <EdgeLabelRenderer>
          <div className={`tag${data.dim ? " dimtag" : ""}`} style={{ position: "absolute", transform: `translate(-50%, -150%) translate(${labelX}px, ${labelY}px)` }}>{label}</div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}

/** Square-cut arrowheads, one per wire style, drawn once for the canvas. Colours are the A5 tokens. */
export function WireMarkers() {
  // The tip stops about 9px short of the wire's end, so it isn't hidden under the port circle.
  const head = (id: string, fill: string, size: number) => (
    <marker id={id} viewBox="0 0 10 10" refX={10 + (9 * 10) / size} refY="5" markerWidth={size} markerHeight={size} markerUnits="userSpaceOnUse" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill={fill} />
    </marker>
  );
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        {head("arrow-ink", "#17171a", 12)}
        {head("arrow-amber", "#f0a818", 16)}
        {head("arrow-red", "#d63b22", 13)}
      </defs>
    </svg>
  );
}
