import type { LeverDef } from "../engine/types";
import { useFlow } from "./context";
import { Glossed } from "./plain";

interface Props {
  nodeId: string;
  def: LeverDef;
  value: unknown;
  lockReason?: string;
  /** "face" is the compact node row; "drawer" shows the sentence and example inline. */
  variant: "face" | "drawer";
}

export function Lever({ nodeId, def, value, lockReason, variant }: Props) {
  const { setLever, allowedAtTier, previewing } = useFlow();
  const ringed = previewing?.node === nodeId && previewing.lever === def.id;
  const control = lockReason ? (
    <span className="locked">{def.kind === "toggle" ? (value ? "on" : "off") : String(value)} · locked</span>
  ) : def.kind === "toggle" ? (
    <button
      type="button"
      className={`tg nodrag${value ? " on" : ""}`}
      aria-pressed={!!value}
      aria-label={def.label}
      disabled={!allowedAtTier(nodeId, def.id, !value)}
      onClick={() => setLever(nodeId, def.id, !value)}
    />
  ) : (
    <span className="chips nodrag">
      {def.options!.map(([v, label]) => (
        <button
          key={v}
          type="button"
          className={`ch${value === v ? " on" : ""}`}
          disabled={value !== v && !allowedAtTier(nodeId, def.id, v)}
          onClick={() => setLever(nodeId, def.id, v)}
        >
          {label}
        </button>
      ))}
    </span>
  );

  if (variant === "drawer") {
    return (
      <div className="lever">
        <div className="row">
          {def.kind === "toggle" && control}
          <span>{def.label}</span>
        </div>
        {def.kind === "choice" && control}
        <p><Glossed text={def.sentence} /></p>
        <p className="ex">For example: <Glossed text={def.example} /></p>
        {lockReason && <p className="ex">Locked: {lockReason}</p>}
      </div>
    );
  }

  return (
    <div className={`r tip${ringed ? " ring" : ""}`}>
      {def.kind === "toggle" ? (
        <>
          {lockReason ? null : control}
          <span>{def.label}</span>
          {lockReason && <span className="v">{control}</span>}
        </>
      ) : (
        control
      )}
      <span className="tipbox">
        {def.sentence}
        <em>For example: {def.example}</em>
        {lockReason && <em>Locked: {lockReason}</em>}
      </span>
    </div>
  );
}
