import { useState } from "react";
import type { Requirement } from "../engine/types";
import { leverDef, useFlow } from "./context";
import { nameWarning } from "./names";
import { Glossed, policyAnswer, Term, type Change } from "./plain";

export interface LastChange {
  what: string;
  changes: Change[];
}

interface Props {
  preview: boolean;
  setPreview(v: boolean): void;
  setHighlight(ids: string[]): void;
  applyCheapest(): void;
  lastChange: LastChange | null;
  setRiskOwner(role: string): void;
}

const STATUS_ORDER: Record<string, number> = { to_do: 0, partial: 1, on_file: 2, covered: 3 };

/** The plain answer, on the canvas. Flip anything and it says what changed and why. */
export function Rail({ preview, setPreview, setHighlight, applyCheapest, lastChange, setRiskOwner }: Props) {
  const { d, set, flow } = useFlow();
  const [open, setOpen] = useState<string | null>(null);
  const [why, setWhy] = useState(false);
  const { rules, requirements: cat } = set;
  const rail = d.requirements
    .filter((r) => r.rail)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.build_order - b.build_order);
  const title = (id: string) => flow.nodes.find((n) => n.id === id)?.title ?? id;
  const struck = new Set(preview && d.cheapest_change ? d.cheapest_change.removes : []);
  const cc = d.cheapest_change;
  const ccLever = cc ? leverDef(set, flow.nodes.find((n) => n.id === cc.node)!.type, cc.lever) : undefined;
  const ccTo = cc?.lever === "company_id" ? set.products.companies[String(cc.to)]?.name ?? String(cc.to) : cc && typeof cc.to === "boolean" ? `${ccLever?.label ?? cc.lever} ${cc.to ? "on" : "off"}` : String(cc?.to).replace(/_/g, " ");
  const tier = set.rules.tiers[String(d.highest_tier)];
  const policy = policyAnswer(flow, d, set);
  const yes = Object.values(d.screening).filter((a) => a.yes);

  const row = (r: Requirement) => (
    <div key={r.key} className={`req${struck.has(r.key) ? " struck" : ""}`} onMouseEnter={() => setHighlight(r.cause.nodes)} onMouseLeave={() => setHighlight([])}>
      <button type="button" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>
        <span style={{ flex: 1 }}>{r.short}</span>
        <span className="cause">{r.cause.nodes.length ? title(r.cause.nodes[0]) : "flow"}</span>
        <span className={`v ${struck.has(r.key) ? "mu" : r.status === "to_do" || r.status === "partial" ? "rq" : "ok"}`}>
          {struck.has(r.key) ? "lifted" : cat.status_labels[r.status]}
        </span>
      </button>
      {open === r.key && (
        <div className="detail">
          <div><Glossed text={`${r.title}: ${r.meaning}`} /></div>
          <dl>
            <dt>because</dt>
            <dd>{r.cause.text}</dd>
            <dt>who</dt>
            <dd>{cat.owner_labels[r.owner] ?? r.owner}</dd>
            <dt>how long</dt>
            <dd>{cat.effort_labels[r.effort] ?? r.effort}</dd>
            <dt>a person</dt>
            <dd>{r.left_for_person}</dd>
            <dt>source</dt>
            <dd>{r.source ? <a href={r.source.url} target="_blank" rel="noreferrer">{r.source.label}</a> : "none"}</dd>
          </dl>
        </div>
      )}
    </div>
  );

  return (
    <aside className="rail" aria-label="Your answer">
      <div className="answer-block">
        <div className="qa">
          <p className="lab">Can I do it?</p>
          <div className="verdict" style={{ color: d.verdict.id === "not_like_this" ? "var(--rq)" : undefined }}>{d.verdict.label}</div>
          <div className="say">{d.verdict.say}</div>
          {d.notes.map((n) => <div key={n} className="box info" style={{ marginTop: 8 }}>{n}</div>)}
          {d.bright_lines.map((b) => (
            <div
              key={b.id + b.node}
              className={`box ${b.kind === "stop" ? "alert" : "consult"}`}
              style={{ marginTop: 10 }}
              onMouseEnter={() => setHighlight(b.node ? [b.node] : [])}
              onMouseLeave={() => setHighlight([])}
            >
              <p className="lab" style={{ color: "var(--rq)", marginBottom: 2 }}>{b.kind === "stop" ? "Hard line" : "ICO consultation"}</p>
              <strong>{b.title}</strong>
              <div style={{ marginTop: 4 }}><Glossed text={b.say} /></div>
              <div style={{ marginTop: 6, fontWeight: 600 }}>Ways past it:</div>
              <ul className="plain">{b.ways_out.map((w) => <li key={w}>{w}</li>)}</ul>
              {b.source && <a href={b.source.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{b.source.label}</a>}
            </div>
          ))}
        </div>

        <div className="qa">
          <p className="lab">Who decides?</p>
          <label className="field" style={{ marginTop: 4 }}>
            <span>Risk owner (a role, not a name)</span>
            <input value={flow.risk_owner ?? ""} placeholder="e.g. Deputy principal" onChange={(e) => setRiskOwner(e.target.value)} />
            {nameWarning(flow.risk_owner) && <span className="warn">{nameWarning(flow.risk_owner)}</span>}
          </label>
          <div className="say">
            Someone with the authority to change the project accepts the risk that's left, in writing. The <Term t="DPO" /> advises; they don't approve.
          </div>
        </div>

        <div className="qa">
          <p className="lab">How sensitive is the data?</p>
          <div className="qa-a"><Term t="tier">Tier {d.highest_tier}</Term>: {tier.label}</div>
          <div className="say">{tier.plain} {tier.can}</div>
        </div>

        <div className="qa">
          <p className="lab">Does policy allow it?</p>
          <div className={`qa-a ${policy.ok ? "ok" : "rq"}`}>{policy.title}</div>
          {policy.lines.map((l) => (
            <div key={l.text} className={l.ok ? "say" : "box alert"} style={l.ok ? undefined : { marginTop: 8 }}>
              <Glossed text={l.text} />
              {l.ways.length > 0 && (
                <>
                  <div style={{ marginTop: 6, fontWeight: 600 }}>Two ways out:</div>
                  <ul className="plain">{l.ways.map((w) => <li key={w}>{w}</li>)}</ul>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="qa">
          <p className="lab">Do I need a <Term t="DPIA" />?</p>
          <div className="qa-a">{rules.outcome.labels[d.outcome]}</div>
          <div className="say">
            {rules.outcome.plain[d.outcome]}
            {d.floor_raised && " Your use of AI sets this minimum."}
            {d.credit_applied && d.outcome !== d.outcome_from_screening && " One step lower because no names are used."}
          </div>
          {yes.length > 0 && (
            <button type="button" className="linkish" onClick={() => setWhy(!why)} aria-expanded={why}>
              {why ? "Hide why" : `Why? ${yes.length} warning sign${yes.length === 1 ? "" : "s"}`}
            </button>
          )}
          {why && (
            <ul className="plain" style={{ fontSize: 13 }}>
              {yes.map((a) => (
                <li key={a.id} onMouseEnter={() => setHighlight(a.nodes)} onMouseLeave={() => setHighlight([])}>
                  {a.because.join("; ")}{" "}
                  {a.source && <a href={a.source.url} target="_blank" rel="noreferrer" className="mu">({a.id})</a>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="box changed" aria-live="polite">
        {lastChange ? (
          <>
            <p className="lab" style={{ marginBottom: 6 }}>What that changed</p>
            <div className="mu" style={{ fontSize: 12, marginBottom: 4 }}>{lastChange.what}</div>
            {lastChange.changes.length ? (
              <ul className="plain">{lastChange.changes.map((c) => <li key={c.text} className={`chg ${c.kind}`}><Glossed text={c.text} /></li>)}</ul>
            ) : (
              <div>Nothing changed in the answer.</div>
            )}
          </>
        ) : (
          <>
            <p className="lab" style={{ marginBottom: 6 }}>Play with it</p>
            <div>Flip any switch on the canvas and this says what it changed and why. Hover a switch to see what it means.</div>
          </>
        )}
      </div>

      <div className="panel s-paperwork">
        <div className="h h-paperwork" style={{ cursor: "default" }}>
          <p className="t">What to do</p>
          <p className="k">Click a row to see what it is and why</p>
        </div>
        <div>{rail.map(row)}</div>
        <div className="sum">
          {rail.length} items<span className="v rq">{d.open_count} to do</span>
        </div>
      </div>

      <div className="panel s-ink">
        <div className="h h-ink" style={{ cursor: "default" }}>
          <p className="t">Make it easier</p>
          <p className="k">The single change that helps most</p>
        </div>
        <div className="b">
          <div className="r">risk to people<span className={`v ${d.risk === "high" ? "rq" : d.risk === "low" ? "ok" : ""}`}>{d.risk}</span></div>
          <div className="r">how long<span className="v">{rules.effort.time_labels[d.effort.time]}</span></div>
          <div className="r">who signs<span className="v">{rules.effort.signoff_labels[d.effort.signoff]}</span></div>
          {cc ? (
            <div style={{ margin: "8px 14px 0" }}>
              <div className="box">
                {cc.lever === "company_id" ? "Switch" : "Set"} {cc.node_title} to <strong>{ccTo}</strong>.{" "}
                {cc.unblocks > 0 ? "That clears the red wire." : `That lifts ${cc.removes.length} thing${cc.removes.length === 1 ? "" : "s"} to do.`}
                <div style={{ marginTop: 6, color: "var(--muted)" }}>You'd give up: {cc.cost}</div>
                <div style={{ marginTop: 6 }}><Glossed text={`How: ${cc.how}`} /></div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ boxShadow: "3px 3px 0 var(--data)" }}
                  aria-pressed={preview}
                  onClick={() => setPreview(!preview)}
                  onMouseEnter={() => setHighlight([cc.node])}
                  onMouseLeave={() => setHighlight([])}
                >
                  {preview ? "Hide preview" : "Preview it"}
                </button>
                <button type="button" className="btn" onClick={applyCheapest}>Try it</button>
              </div>
            </div>
          ) : (
            <div style={{ margin: "8px 14px 0" }} className="box">No single change makes this easier. It's already about as simple as it gets.</div>
          )}
        </div>
      </div>

      <div className="box dashed">
        <p className="lab" style={{ marginBottom: 4 }}>Still needs a person</p>
        <ul className="plain">
          {d.needs_person.map((x) => <li key={x}><Glossed text={x} /></li>)}
        </ul>
        <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>This is a screening, not legal advice. Plainflow never says a flow is lawful; it says what still needs a person.</div>
      </div>
    </aside>
  );
}
