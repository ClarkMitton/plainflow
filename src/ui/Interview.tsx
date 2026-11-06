import { useEffect, useMemo, useState } from "react";
import { derive, tierOfData } from "../engine/derive";
import type { Derivation, Flow, RuleSet } from "../engine/types";
import { describeChange, Glossed, policyAnswer, Term, type Change } from "./plain";
import { apply, applyChecklist, isDecisive, matches, stepsFor, type Setting, type Step } from "./questions";

interface Props {
  flow: Flow;
  d: Derivation;
  set: RuleSet;
  onChange(next: Flow, what: string): void;
  onDone(): void;
}

/**
 * Plain questions, as few as possible. Tick lists replace runs of yes/no questions, and any question
 * where no answer would change the result is skipped and recorded as assumed. Every answer shows what it changed.
 */
export function Interview({ flow, d, set, onChange, onDone }: Props) {
  const steps = useMemo(() => stepsFor(flow, d), [flow, d]);
  const answered = flow.answers ?? {};
  const decisive = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const s of steps) out[s.key] = s.key in (flow.answers ?? {}) || isDecisive(s, flow, set, d);
    return out;
  }, [steps, flow, d, set]);
  const visible = steps.filter((s) => decisive[s.key]);
  const assumed = steps.filter((s) => !decisive[s.key]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [last, setLast] = useState<{ label: string; changes: Change[] } | null>(null);
  const [showAssumed, setShowAssumed] = useState(false);

  const step = visible.find((s) => s.key === cursor) ?? (cursor ? undefined : visible.find((s) => !(s.key in answered) && !skipped.includes(s.key)));
  const idx = step ? visible.indexOf(step) : visible.length;
  const pinned = flow.mode === "tier_first" ? flow.tier_pinned : null;
  const anyway = cursor && !step ? steps.find((s) => s.key === cursor) : undefined;

  const commit = (s: Step, next: Flow, label: string) => {
    const after = derive(next, set, { cheapest: false });
    setLast({ label, changes: describeChange(d, after, next, set) });
    onChange({ ...next, answers: { ...answered, [s.key]: label } }, `${s.ask} ${label}`);
    setCursor(null);
  };

  /** In tier-first mode, an answer that would lift the data above the chosen tier is greyed out. */
  const tooHigh = (s: Step, setting: Setting) => {
    if (pinned == null || s.node?.type !== "data") return false;
    const node = apply(flow, s.node.id, setting).nodes.find((n) => n.id === s.node!.id)!;
    return tierOfData(node, set) > pinned;
  };

  const ask = (s: Step) => (
    <div className="qcard" key={s.key}>
      <p className="lab">
        {visible.includes(s) ? `Question ${visible.indexOf(s) + 1} of ${visible.length}` : "Answering anyway"} · about {s.node?.title ?? "the whole idea"}
      </p>
      <h2 className="ask">{s.ask}</h2>
      <p className="why"><Glossed text={s.q.why} /></p>
      {s.q.example && <p className="ex">For example: {s.q.example}</p>}

      {s.q.type === "checklist" ? (
        <Checklist
          step={s}
          flow={flow}
          tooHigh={(x) => tooHigh(s, x)}
          onSubmit={(ticked) => {
            const labels = s.items.filter((_, i) => ticked[i]).map((it) => it.label);
            commit(s, applyChecklist(flow, s, ticked), labels.length ? labels.join("; ") : "None of these");
          }}
        />
      ) : (
        <div className="answers">
          {(s.q.answers ?? []).map((a) => {
            const chosen = answered[s.key] === a.label;
            const guess = !(s.key in answered) && matches(flow, s.node, a);
            const blocked = tooHigh(s, a);
            return (
              <button key={a.label} type="button" className={`answer${chosen || guess ? " guess" : ""}`} disabled={blocked} onClick={() => commit(s, apply(flow, s.node?.id ?? null, a), a.label)}>
                {a.label}
                {blocked && <small>Not at Tier {pinned}, the tier you started from</small>}
                {guess && <small>Our guess from your sentence</small>}
                {chosen && <small>Your answer</small>}
              </button>
            );
          })}
        </div>
      )}

      <div className="qnav">
        {idx > 0 && visible.includes(s) && <button type="button" className="linkish" onClick={() => setCursor(visible[idx - 1]?.key ?? null)}>Back</button>}
        <button type="button" className="linkish" onClick={() => { setSkipped([...skipped, s.key]); setCursor(null); }}>Not sure, skip this one</button>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="inner interview">
        <div>
          <p className="lab">{flow.source?.kind === "scan" ? "Checking an app from its code" : flow.retrospective ? "Checking something already in use" : "A new idea"}</p>
          <p className="story">{flow.story}</p>

          <div className="progress-row">
            <div className="progress" aria-label={`Question ${Math.min(idx + 1, visible.length)} of ${visible.length}`}>
              {visible.map((s) => (
                <button key={s.key} type="button" className={`${s === step ? "on" : ""} ${s.key in answered ? "done" : ""}`} onClick={() => setCursor(s.key)} title={s.ask} />
              ))}
            </div>
            {step && <button type="button" className="linkish" onClick={onDone}>Skip the rest and draw it</button>}
          </div>

          {step ? ask(step) : anyway ? ask(anyway) : (
            <div className="qcard">
              <h2 className="ask">That's everything. Let's draw it.</h2>
              <p className="why">You'll see your idea as a picture, with the answer beside it: whether you can go ahead, what policy says, and what to do. Then flip any switch to see what changes.</p>
              <button type="button" className="btn dk" style={{ boxShadow: "4px 4px 0 var(--data)", fontSize: 16, padding: "10px 18px" }} onClick={onDone}>Draw my flow</button>
              <button type="button" className="btn" style={{ marginLeft: 10 }} onClick={() => { setSkipped([]); setCursor(visible[0]?.key ?? null); }}>Go back over them</button>
            </div>
          )}

          {last && (
            <div className="box changed" aria-live="polite">
              <p className="lab" style={{ marginBottom: 6 }}>You said "{last.label}"</p>
              {last.changes.length ? (
                <ul className="plain">{last.changes.map((c) => <li key={c.text} className={`chg ${c.kind}`}><Glossed text={c.text} /></li>)}</ul>
              ) : (
                <div className="mu">That doesn't change the answer.</div>
              )}
            </div>
          )}

          {assumed.length > 0 && (
            <div className="assumed">
              <button type="button" className="linkish" onClick={() => setShowAssumed(!showAssumed)} aria-expanded={showAssumed}>
                {assumed.length} question{assumed.length === 1 ? "" : "s"} skipped
              </button>
              <span className="mu"> · nothing you could answer would change the result yet.</span>
              {showAssumed && (
                <ul className="plain">
                  {assumed.map((s) => (
                    <li key={s.key}>
                      {s.ask} <button type="button" className="linkish" onClick={() => setCursor(s.key)}>Answer anyway</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <LivePanel flow={flow} d={d} set={set} />
      </div>
    </div>
  );
}

function Checklist({ step, flow, tooHigh, onSubmit }: { step: Step; flow: Flow; tooHigh(s: Setting): boolean; onSubmit(ticked: boolean[]): void }) {
  const guessed = step.items.map((it) => matches(flow, step.node, it.on));
  const [ticked, setTicked] = useState<boolean[]>(guessed);
  useEffect(() => setTicked(step.items.map((it) => matches(flow, step.node, it.on))), [step.key]);
  return (
    <>
      <div className="answers">
        {step.items.map((it, i) => {
          const blocked = !ticked[i] && tooHigh(it.on);
          return (
            <button
              key={it.label}
              type="button"
              role="checkbox"
              aria-checked={!!ticked[i]}
              className={`answer tick${ticked[i] ? " ticked" : ""}`}
              disabled={blocked}
              onClick={() => setTicked(ticked.map((t, j) => (j === i ? !t : t)))}
            >
              <span className="box-tick" aria-hidden="true">{ticked[i] ? "✓" : ""}</span>
              <span className="tick-text">
                {it.label}
                {it.hint && <small>{it.hint}</small>}
                {guessed[i] && <small>Ticked from your sentence</small>}
                {blocked && <small>Not at the tier you started from</small>}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button type="button" className="btn dk" style={{ boxShadow: "4px 4px 0 var(--data)" }} onClick={() => onSubmit(ticked)}>
          {ticked.some(Boolean) ? "That's right, next" : "None of these, next"}
        </button>
      </div>
    </>
  );
}

function LivePanel({ flow, d, set }: { flow: Flow; d: Derivation; set: RuleSet }) {
  const tier = d.highest_tier;
  const policy = policyAnswer(flow, d, set);
  return (
    <aside className="live">
      <p className="lab">{Object.keys(flow.answers ?? {}).length ? "So far" : flow.source?.kind === "scan" ? "Starting point, from the code scan" : "Starting point, from your sentence"}</p>
      <div className="liverow">
        <span className="q">Can I do it?</span>
        <strong className={["stop", "not_like_this", "consult"].includes(d.verdict.id) ? "rq" : undefined}>{d.verdict.label}</strong>
      </div>
      <div className="liverow">
        <span className="q">How sensitive is the data?</span>
        <strong><Term t="tier">Level {tier}</Term>: {set.rules.tiers[String(tier)].label.toLowerCase()}</strong>
      </div>
      <div className="liverow">
        <span className="q">Does your policy allow it?</span>
        <strong className={policy.ok ? "ok" : "rq"}>{policy.ok ? "Yes" : "No, not like this"}</strong>
      </div>
      <div className="liverow">
        <span className="q">Do I need a <Term t="DPIA" />?</span>
        <strong>{({ not_required: "Not needed", recommended: "Recommended", required: "A full one is needed" } as Record<string, string>)[d.outcome] ?? d.outcome}</strong>
      </div>
      <div className="liverow">
        <span className="q">Things to do</span>
        <strong>{d.open_count}</strong>
      </div>
      <p className="mu" style={{ fontSize: 12, marginTop: 12 }}>This updates as you answer. Nothing here is a final decision; it shows what the rules say so far.</p>
    </aside>
  );
}
