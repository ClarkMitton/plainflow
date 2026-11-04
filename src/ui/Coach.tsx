import { useEffect, useLayoutEffect, useState } from "react";
import tipsJson from "../../data/tips.json";
import { Glossed } from "./plain";

interface Tip {
  title: string;
  body: string;
  aside?: string;
  anchor?: string;
}

const TIPS = tipsJson.screens as Record<string, Tip[]>;
const SEEN_KEY = "plainflow.tips.seen";

function seen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function markSeen(screen: string) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seen(), screen])]));
  } catch {
    /* private window: the guide just shows again next time */
  }
}

export function hasSeen(screen: string): boolean {
  return seen().includes(screen);
}

interface Props {
  screen: string;
  /** Show even if seen before (the Tips button). */
  replay: number;
  /** Wait before starting, e.g. while the canvas draws itself. */
  delayMs?: number;
}

/**
 * The first-time guide: a modal that says what this screen is making and doing, then a few
 * pointers at the parts of the page that matter. Shows once per screen; the Tips button replays it.
 */
export function Coach({ screen, replay, delayMs = 0 }: Props) {
  const steps = TIPS[screen] ?? [];
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!steps.length) return;
    if (replay === 0 && hasSeen(screen)) { setOpen(false); return; }
    setI(0);
    const t = window.setTimeout(() => setOpen(true), delayMs);
    return () => window.clearTimeout(t);
  }, [screen, replay, delayMs, steps.length]);

  const step = steps[i];

  // Find the anchor each step, and keep its outline in place when the window changes.
  useLayoutEffect(() => {
    if (!open || !step?.anchor) { setRect(null); return; }
    const place = () => {
      const el = document.querySelector(step.anchor!);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      setRect(el.getBoundingClientRect());
    };
    place();
    const t = window.setTimeout(place, 250);
    window.addEventListener("resize", place);
    return () => { window.clearTimeout(t); window.removeEventListener("resize", place); };
  }, [open, step]);

  if (!open || !step) return null;

  const finish = () => { markSeen(screen); setOpen(false); };
  const next = () => (i + 1 < steps.length ? setI(i + 1) : finish());
  const last = i + 1 >= steps.length;

  // A pointer sits beside its anchor: right of it if there's room, else below, else above, else left.
  let style: React.CSSProperties = {};
  if (rect) {
    const w = 320, h = 190, gap = 14, vw = window.innerWidth, vh = window.innerHeight;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    if (rect.right + gap + w < vw) style = { left: rect.right + gap, top: clamp(rect.top, 12, vh - h - 12) };
    else if (rect.bottom + gap + h < vh) style = { left: clamp(rect.left, 12, vw - w - 12), top: rect.bottom + gap };
    else if (rect.top - gap - h > 0) style = { left: clamp(rect.left, 12, vw - w - 12), top: rect.top - gap - h };
    else style = { left: clamp(rect.left - gap - w, 12, vw - w - 12), top: clamp(rect.top, 12, vh - h - 12) };
  }

  return (
    <>
      {!rect && <div className="coach-backdrop" onClick={finish} />}
      {rect && <div className="coach-ring" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }} />}
      <div className={`coach${rect ? " pointer" : " modal"}`} style={style} role="dialog" aria-modal={!rect} aria-labelledby="coach-title">
        <p className="lab">{steps.length > 1 ? `${i + 1} of ${steps.length}` : "First time here"}</p>
        <h2 id="coach-title">{step.title}</h2>
        <p><Glossed text={step.body} /></p>
        {step.aside && <p className="aside">{step.aside}</p>}
        <div className="coach-nav">
          {!last && <button type="button" className="linkish" onClick={finish}>Skip the guide</button>}
          <span className="spacer" />
          {i > 0 && <button type="button" className="btn" onClick={() => setI(i - 1)}>Back</button>}
          <button type="button" className="btn dk" style={{ boxShadow: "3px 3px 0 var(--data)" }} onClick={next} autoFocus>
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}
