import { useState, type ReactNode } from "react";
import type { Law, Requirement } from "../engine/types";
import { leverDef, useFlow } from "./context";
import { nameWarning } from "./names";
import { Glossed, policyAnswer, Term, type Change, groupLines, clearsText, stillNo } from "./plain";
import { licences, lighterRoutes, m365Checked, type LighterRoute } from "./lighter";

/** Where this comes from in law, and why it matters. */
export function LawLine({ law, laws, compact }: { law?: Law | null; laws?: (Law | null | undefined)[]; compact?: boolean }) {
  const list = (laws ?? [law]).filter((l): l is Law => !!l);
  if (!list.length) return null;
  if (compact) {
    return (
      <div className="lawline compact">
        <div>{list.map((l, i) => <span key={l.id}>{i > 0 ? " · " : ""}<a href={l.url} target="_blank" rel="noreferrer"><strong>{l.ref}</strong>, {l.name.toLowerCase()}</a></span>)}</div>
      </div>
    );
  }
  return (
    <div className="lawline">
      {list.map((l) => (
        <div key={l.id}>
          <a href={l.url} target="_blank" rel="noreferrer"><strong>{l.ref}</strong>, {l.name.toLowerCase()}</a>: {l.says} <span className="why">Why it matters: {l.why}</span>
        </div>
      ))}
    </div>
  );
}

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
  checkIt(): void;
  /** True for the moment between Check it and the answer: the rail narrates what it is reading. */
  checking: boolean;
  /** Changes made since the last answer. When there are any, the answer is stale and waits for Check it again. */
  pending: string[];
  finish(): void;
  tryLighter(route: LighterRoute): void;
  setLicence(id: string): void;
}

/**
 * The answer, in order of what matters: can I do it; what just changed; three facts behind the answer
 * (each one line, open for more); what to do; the one change that helps. Everything else is folded away.
 */
export function Rail({ preview, setPreview, setHighlight, applyCheapest, lastChange, setRiskOwner, checkIt, checking, pending, finish, tryLighter, setLicence }: Props) {
  const { d, set, flow, checked } = useFlow();
  const [open, setOpen] = useState<string | null>(null);
  const [fact, setFact] = useState<string | null>(null);
  const [showCovered, setShowCovered] = useState(false);
  const [showPerson, setShowPerson] = useState(false);
  const { rules, requirements: cat } = set;
  const title = (id: string) => flow.nodes.find((n) => n.id === id)?.title ?? id;
  const struck = new Set(preview && d.cheapest_change ? d.cheapest_change.removes : []);
  const cc = d.cheapest_change;
  const ccLever = cc ? leverDef(set, flow.nodes.find((n) => n.id === cc.node)!.type, cc.lever) : undefined;
  const ccTo = cc?.lever === "company_id"
    ? set.products.companies[String(cc.to)]?.name ?? String(cc.to)
    : cc && typeof cc.to === "boolean" ? (cc.to ? "on" : "off") : ccLever?.options?.find(([v]) => v === cc?.to)?.[1] ?? String(cc?.to).replace(/_/g, " ");
  const tier = rules.tiers[String(d.highest_tier)];
  const policy = policyAnswer(flow, d, set);
  const yes = Object.values(d.screening).filter((a) => a.yes);
  const bad = ["stop", "not_like_this", "consult"].includes(d.verdict.id);
  const toDo = d.requirements.filter((r) => r.rail && (r.status === "to_do" || r.status === "partial")).sort((a, b) => a.build_order - b.build_order);
  const covered = d.requirements.filter((r) => r.rail && r.status !== "to_do" && r.status !== "partial");
  const needsOwner = d.outcome !== "not_required";
  const routes = lighterRoutes(flow, d, set);
  const licence = String(flow.organisation.m365_licence ?? "unknown");

  const row = (r: Requirement) => (
    <div key={r.key} className={`req${struck.has(r.key) ? " struck" : ""}`} onMouseEnter={() => setHighlight(r.cause.nodes)} onMouseLeave={() => setHighlight([])}>
      <button type="button" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>
        <span style={{ flex: 1 }}>{r.short}</span>
        <span className="cause">{r.cause.nodes.length ? title(r.cause.nodes[0]) : "whole idea"}</span>
        <span className={`v ${struck.has(r.key) ? "mu" : r.status === "to_do" || r.status === "partial" ? "rq" : "ok"}`}>
          {struck.has(r.key) ? "lifted" : cat.status_labels[r.status]}
        </span>
      </button>
      {open === r.key && (
        <div className="detail">
          <div><Glossed text={`${r.title}: ${r.meaning}`} /></div>
          <dl>
            <dt>because</dt><dd>{r.cause.text}</dd>
            <dt>who</dt><dd>{cat.owner_labels[r.owner] ?? r.owner}</dd>
            <dt>how long</dt><dd>{cat.effort_labels[r.effort] ?? r.effort}</dd>
            <dt>a person</dt><dd>{r.left_for_person}</dd>
            <dt>guidance</dt><dd>{r.source ? <a href={r.source.url} target="_blank" rel="noreferrer">{r.source.label}</a> : "none"}</dd>
          </dl>
          <LawLine law={r.law} />
        </div>
      )}
    </div>
  );

  const factRow = (id: string, label: ReactNode, value: ReactNode, tone: string, more: ReactNode) => (
    <div className={`fact${fact === id ? " open" : ""}`}>
      <button type="button" onClick={() => setFact(fact === id ? null : id)} aria-expanded={fact === id}>
        <span className="fl">{label}</span>
        <span className={`fv ${tone}`}>{value}</span>
        <span className="chev" aria-hidden="true">{fact === id ? "–" : "+"}</span>
      </button>
      {fact === id && <div className="fm">{more}</div>}
    </div>
  );

  if (checking) {
    const dataCount = flow.nodes.filter((n) => n.type === "data").length;
    const lines = [
      `${dataCount} data item${dataCount === 1 ? "" : "s"} given a level`,
      `${d.crossings.length} connection${d.crossings.length === 1 ? "" : "s"} checked against your approved list`,
      `${Object.keys(d.screening).length} screening questions answered from the diagram`,
      `${d.open_count} action${d.open_count === 1 ? "" : "s"} listed with an owner and effort`,
    ];
    return (
      <aside className="rail" aria-label="Reading the diagram" aria-busy="true">
        <div className="qa reading">
          <p className="lab">Reading the diagram</p>
          <ul className="plain">{lines.map((l, i) => <li key={l} style={{ animationDelay: `${0.25 + i * 0.3}s` }}>{l}</li>)}</ul>
        </div>
      </aside>
    );
  }

  if (!checked) {
    const parts = flow.nodes.length;
    const outside = flow.nodes.filter((n) => !n.inside).length;
    return (
      <aside className="rail" aria-label="Your diagram">
        <div className="qa">
          <p className="lab">Your proposal, as a diagram</p>
          <div className="verdict">Review the diagram first</div>
          <div className="say">
            {parts} parts, {outside} of them outside your organisation. Drag boxes to rearrange them, open one to change details, or hover over a word in the sentence to see where that data goes.
          </div>
        </div>
        <div className="box" style={{ boxShadow: "5px 5px 0 var(--data)" }}>
          <div style={{ fontSize: 15, lineHeight: 1.45 }}>When it is right, Plainflow reads the answer from the diagram: whether it can go ahead, whether policy allows it, and what to do next.</div>
          <button type="button" className="btn dk checkit" onClick={checkIt}>Check it</button>
        </div>
        <div className="mu" style={{ fontSize: 12 }}>Nothing is decided yet. You can return and change the diagram at any time.</div>
      </aside>
    );
  }

  const stale = pending.length > 0;
  return (
    <aside className={`rail reveal-rail${stale ? " is-stale" : ""}`} aria-label="Your answer">
      {stale && (
        <div className="stale-card" role="status">
          <p className="lab">The diagram has changed</p>
          <div className="say">{pending.length === 1 ? "One change" : `${pending.length} changes`} since this answer. It may no longer hold.</div>
          <ul className="plain mu" style={{ fontSize: 12, margin: "6px 0 10px" }}>{pending.slice(-4).map((p, i) => <li key={i}>{p[0].toUpperCase() + p.slice(1)}</li>)}</ul>
          <button type="button" className="btn dk checkit" onClick={checkIt}>Check it again</button>
        </div>
      )}
      <div className="qa">
        <p className="lab">Can this go ahead?</p>
        <div className="verdict" style={{ color: bad ? "var(--rq)" : undefined }}>{d.verdict.label}</div>
        <div className="say"><Glossed text={d.verdict.say} /></div>
        <div className="mono mu" style={{ fontSize: 12, marginTop: 6 }}>
          {rules.effort.time_labels[d.effort.time]} · sign-off: {rules.effort.signoff_labels[d.effort.signoff]}
        </div>
        {d.notes.map((n) => <div key={n} className="box info" style={{ marginTop: 8 }}>{n}</div>)}
        {groupLines(d.bright_lines, flow).map(({ b, nodes, others }) => (
          <div
            key={b.id}
            className={`box ${b.kind === "stop" ? "alert" : "consult"}`}
            style={{ marginTop: 10 }}
            onMouseEnter={() => setHighlight(nodes)}
            onMouseLeave={() => setHighlight([])}
          >
            <p className="lab" style={{ color: "var(--rq)", marginBottom: 2 }}>{b.kind === "stop" ? "Hard line" : "ICO consultation"}</p>
            <strong>{b.title}</strong>
            <div style={{ marginTop: 4 }}><Glossed text={b.say} /></div>
            {others.length > 0 && <div style={{ marginTop: 4 }}>The same goes for {others.join(" and ")}.</div>}
            <div style={{ marginTop: 6, fontWeight: 600 }}>Ways forward:</div>
            <ul className="plain">{b.ways_out.map((w) => <li key={w}>{w}</li>)}</ul>
            {b.source && <a href={b.source.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{b.source.label}</a>}
            <LawLine law={b.law} />
          </div>
        ))}
        {!policy.ok && (
          <div className="box alert" style={{ marginTop: 10 }}>
            <p className="lab" style={{ color: "var(--rq)", marginBottom: 2 }}>Your policy</p>
            <strong>{policy.title}</strong>
            {policy.lines.map((l) => (
              <div key={l.text} style={{ marginTop: 6 }}>
                <Glossed text={l.text} />
                {l.ways.length > 0 && (
                  <>
                    <div style={{ marginTop: 4, fontWeight: 600 }}>Ways forward:</div>
                    <ul className="plain">{l.ways.map((w) => <li key={w}>{w}</li>)}</ul>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="box changed" aria-live="polite">
        {lastChange && !/^asked for the answer$/i.test(lastChange.what) ? (
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
            <p className="lab" style={{ marginBottom: 6 }}>Explore</p>
            <div>Change any setting on the diagram and this box explains what changed and why. Hover over a setting to see what it means.</div>
          </>
        )}
      </div>

      <div className="facts">
        {factRow("data", "The data", <>Level {d.highest_tier}: {tier.label.toLowerCase()}</>, d.highest_tier >= 3 ? "rq" : "", <><Glossed text={tier.plain} /> {tier.can} <span className="mu">(<Term t="tier">Level</Term> {d.highest_tier} of 3.)</span><LawLine laws={(tier.law ?? []).map((id) => set.laws[id] ?? null)} /></>)}
        {factRow("policy", "Your policy", policy.ok ? "allows it" : "doesn't allow it", policy.ok ? "ok" : "rq",
          policy.lines.map((l) => (
            <div key={l.text}>
              <Glossed text={l.text} />
              {l.ways.length > 0 && <ul className="plain">{l.ways.map((w) => <li key={w}>{w}</li>)}</ul>}
            </div>
          )).concat(
            <div key="source" className="mono mu" style={{ fontSize: 11, marginTop: 6 }}>{policy.source}</div>,
            policy.unowned ? <div key="unowned" className="warn" style={{ marginTop: 4 }}>{set.rules.policy.unowned}</div> : <span key="owned" />,
            <LawLine key="law" laws={[set.laws.art28, set.laws.art44]} />,
          ))}
        {factRow("dpia", <Term t="DPIA" />, { not_required: "not needed", recommended: "recommended", required: "a full one is needed" }[d.outcome] ?? d.outcome, d.outcome === "required" ? "rq" : d.outcome === "not_required" ? "ok" : "",
          <>
            <div>{rules.outcome.plain[d.outcome]}{d.floor_raised && " Your use of AI sets this minimum."}{d.credit_applied && d.outcome !== d.outcome_from_screening && " One step lower because no names are used."}</div>
            {yes.length > 0 && (
              <>
                <div style={{ marginTop: 6, fontWeight: 600 }}>{yes.length} warning sign{yes.length === 1 ? "" : "s"}:</div>
                <ul className="plain">
                  {yes.map((a) => (
                    <li key={a.id} onMouseEnter={() => setHighlight(a.nodes)} onMouseLeave={() => setHighlight([])}>
                      {a.because.join("; ")} {a.source && <a href={a.source.url} target="_blank" rel="noreferrer" className="mu">({a.id})</a>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mu" style={{ marginTop: 6 }}>Risk to people: {d.risk}.</div>
            <LawLine laws={[set.laws.art35, ...yes.map((a) => a.law).filter((l) => l && l.id !== "art35")]} />
          </>)}
        {needsOwner && factRow("owner", "Who decides", flow.risk_owner?.trim() ? flow.risk_owner : <span className="rq">not named yet</span>, "",
          <>
            <label className="field">
              <span>Risk owner (a role, not a name)</span>
              <input value={flow.risk_owner ?? ""} placeholder="e.g. Deputy principal" onChange={(e) => setRiskOwner(e.target.value)} />
              {nameWarning(flow.risk_owner) && <span className="warn">{nameWarning(flow.risk_owner)}</span>}
            </label>
            <div className="mu" style={{ marginTop: 6 }}>Someone with the authority to change the project accepts the risk that's left, in writing. The <Term t="DPO" /> advises; they don't approve.</div>
          </>)}
      </div>

      <div className="panel s-paperwork">
        <div className="h h-paperwork" style={{ cursor: "default" }}>
          <p className="t">What to do</p>
          <p className="k">{toDo.length} item{toDo.length === 1 ? "" : "s"} · select one to see why</p>
        </div>
        <div>{toDo.map(row)}</div>
        {toDo.length === 0 && <div className="req"><div className="detail" style={{ paddingTop: 10 }}>Nothing to do.</div></div>}
        {covered.length > 0 && (
          <div className="sum" style={{ fontWeight: 400 }}>
            <button type="button" className="linkish" onClick={() => setShowCovered(!showCovered)} aria-expanded={showCovered}>
              {showCovered ? "Hide" : "Show"} {covered.length} already covered
            </button>
          </div>
        )}
        {showCovered && <div>{covered.map(row)}</div>}
      </div>

      {routes.length > 0 && (
        <div className="panel s-ink lighter">
          <div className="h h-ink" style={{ cursor: "default" }}>
            <p className="t">A lighter route</p>
            <p className="k">You may already pay for one</p>
          </div>
          <div style={{ padding: "12px 14px 14px" }}>
            <label className="field" style={{ marginBottom: 10 }}>
              <span>Your Microsoft 365 licence</span>
              <select value={licence} onChange={(e) => setLicence(e.target.value)}>
                {Object.entries(licences).map(([id, l]) => <option key={id} value={id}>{l.label}</option>)}
              </select>
            </label>
            {routes.map((r) => (
              <div key={r.systemId + r.feature.id} className="route-cmp">
                <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                  Instead of <strong>{r.systemTitle}</strong>: <strong>{r.feature.label}</strong>. <Glossed text={r.feature.does} />
                </div>
                <table className="tbl cmp">
                  <thead><tr><th></th><th>Current route</th><th>Lighter route</th></tr></thead>
                  <tbody>
                    <tr><td>Answer</td><td className={["stop", "not_like_this"].includes(r.theirs.verdictId) ? "rq" : ""}>{r.theirs.verdict}</td><td className={["stop", "not_like_this"].includes(r.ours.verdictId) ? "rq" : "ok"}>{r.ours.verdict}</td></tr>
                    <tr><td>Level allowed</td><td>{r.theirs.levelAllowed ?? "n/a"}</td><td>{r.ours.levelAllowed ?? "n/a"}</td></tr>
                    <tr><td>Things to do</td><td>{r.theirs.toDo}</td><td>{r.ours.toDo}</td></tr>
                    <tr><td>Contracts to sign</td><td>{r.theirs.contracts}</td><td>{r.ours.contracts}</td></tr>
                    <tr><td>Hard lines or blocks</td><td className={r.theirs.hardLines + r.theirs.blocked ? "rq" : ""}>{r.theirs.hardLines + r.theirs.blocked}</td><td className={r.ours.hardLines + r.ours.blocked ? "rq" : "ok"}>{r.ours.hardLines + r.ours.blocked}</td></tr>
                    <tr><td>Cost</td><td>{r.theirs.cost}</td><td>{r.ours.cost}</td></tr>
                  </tbody>
                </table>
                {stillNo(r) && <div className="warn" style={{ marginTop: 6 }}>{stillNo(r)}</div>}
                {r.feature.caveat && <div className="mu" style={{ fontSize: 12, marginTop: 6 }}>But: {r.feature.caveat}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                  <button type="button" className="btn" style={{ boxShadow: "3px 3px 0 var(--data)" }} onClick={() => tryLighter(r)}>Try it</button>
                  <span className="mono mu" style={{ fontSize: 11 }}>Keeps the current route as A for comparison. The decision remains yours.</span>
                </div>
              </div>
            ))}
            <div className="mono mu" style={{ fontSize: 11, marginTop: 8 }}>Licence contents as understood {m365Checked}; check your own agreement.</div>
          </div>
        </div>
      )}

      {cc ? (
        <div className="panel s-ink">
          <div className="h h-ink" style={{ cursor: "default" }}>
            <p className="t">Make it easier</p>
            <p className="k">The one change that helps most</p>
          </div>
          <div style={{ padding: "12px 14px 14px" }}>
            <div>
              {cc.lever === "company_id" ? "Switch" : "Change"} <strong>{cc.node_title}</strong>: {ccLever?.label ?? cc.lever.replace(/_/g, " ")} to <strong>{ccTo}</strong>.{" "}
              {cc.unblocks > 0 ? clearsText(cc.unblocks, d) : `That lifts ${cc.removes.length} thing${cc.removes.length === 1 ? "" : "s"} to do.`}
            </div>
            <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>Trade-off: {cc.cost}</div>
            <div style={{ marginTop: 6, fontSize: 13 }}><Glossed text={`How: ${cc.how}`} /></div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn" style={{ boxShadow: "3px 3px 0 var(--data)" }} aria-pressed={preview} onClick={() => setPreview(!preview)} onMouseEnter={() => setHighlight([cc.node])} onMouseLeave={() => setHighlight([])}>
                {preview ? "Hide preview" : "Preview it"}
              </button>
              <button type="button" className="btn" onClick={applyCheapest}>Try it</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="box" style={{ boxShadow: "5px 5px 0 var(--data)" }}>
        <p className="lab">When you're done</p>
        <div style={{ fontSize: 13, lineHeight: 1.45, margin: "4px 0 10px" }}>A page for you, the record for the DPO, and a note for next time. Print, copy as text, or save the file.</div>
        <button type="button" className="btn dk checkit" style={{ marginTop: 0 }} onClick={finish}>Finish: what you leave with</button>
      </div>

      <div className="box dashed">
        <button type="button" className="linkish" onClick={() => setShowPerson(!showPerson)} aria-expanded={showPerson}>
          {showPerson ? "Hide" : "Show"} what still needs a person ({d.needs_person.length})
        </button>
        {showPerson && (
          <ul className="plain">
            {d.needs_person.map((x) => <li key={x}><Glossed text={x} /></li>)}
          </ul>
        )}
        <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>This is a screening, not legal advice. Plainflow never says a flow is lawful; it says what still needs a person.</div>
      </div>
    </aside>
  );
}
