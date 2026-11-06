import { useMemo, useState } from "react";
import type { Derivation, Flow, RuleSet } from "../engine/types";
import { downloadJson } from "./flowOps";
import { buildPack, packText, type Pack as PackData } from "./packBuild";
import { Glossed } from "./plain";
import { LawLine } from "./Rail";

interface Props {
  flow: Flow;
  d: Derivation;
  set: RuleSet;
}

/**
 * What you leave with. Three documents from the one picture: a page for the person with the idea,
 * the record for the DPO, and a note for whoever runs the next session. Print to PDF, or copy as text.
 */
export function PackPage({ flow, d, set }: Props) {
  const pack = useMemo(() => buildPack(flow, d, set), [flow, d, set]);
  const [copied, setCopied] = useState(false);
  const [section, setSection] = useState<"person" | "dpo" | "next">("person");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(packText(pack));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the text is on screen anyway */
    }
  };

  return (
    <div className="page pack">
      <div className="inner">
        <div className="pack-top noprint">
          <div>
            <p className="lab">What you leave with</p>
            <h1>{pack.title}</h1>
            <p className="lede">Three pages from the same picture, so they always agree. Print any of them to PDF, or copy the lot as text for an email.</p>
          </div>
          <div className="pack-actions">
            <button type="button" className="btn dk" style={{ boxShadow: "4px 4px 0 var(--data)" }} onClick={() => window.print()}>Print to PDF</button>
            <button type="button" className="btn" onClick={copy}>{copied ? "Copied" : "Copy as text"}</button>
            <button type="button" className="btn" onClick={() => downloadJson(`${flow.title.replace(/[^\w-]+/g, "-").toLowerCase()}.plainflow.json`, flow)}>Save the file</button>
          </div>
        </div>
        <div className="seg noprint" role="tablist" style={{ display: "inline-flex", marginBottom: 24 }}>
          <button type="button" className={section === "person" ? "on" : ""} onClick={() => setSection("person")}>For the person with the idea</button>
          <button type="button" className={section === "dpo" ? "on" : ""} onClick={() => setSection("dpo")}>For the DPO</button>
          <button type="button" className={section === "next" ? "on" : ""} onClick={() => setSection("next")}>For next time</button>
        </div>

        <section className={`sheet${section === "person" ? "" : " print-only"}`}>
          <ForPerson p={pack} />
        </section>
        <section className={`sheet${section === "dpo" ? "" : " print-only"}`}>
          <ForDpo p={pack} />
        </section>
        <section className={`sheet${section === "next" ? "" : " print-only"}`}>
          <ForNext p={pack} />
        </section>
      </div>
    </div>
  );
}

function Head({ p, kicker }: { p: PackData; kicker: string }) {
  return (
    <header className="sheet-head">
      <p className="lab">{kicker} · {p.date}{p.retrospective ? " · already in use" : ""}{p.source ? ` · from a code scan of ${p.source}` : ""}</p>
      <h2 className="sheet-title">{p.title}</h2>
      <p className="story">{p.story}</p>
    </header>
  );
}

function ForPerson({ p }: { p: PackData }) {
  const f = p.forPerson;
  return (
    <>
      <Head p={p} kicker="One page: can I do this, and what it takes" />
      <div className="verdict-block">
        <p className="lab">Can I do it?</p>
        <div className="verdict">{f.verdict}</div>
        <p><Glossed text={f.say} /></p>
        {f.notes.map((n) => <p key={n} className="mu">{n}</p>)}
        <p className="mono mu" style={{ fontSize: 12 }}>{f.effort} · sign-off: {f.signoff}</p>
      </div>

      <div className="facts-print">
        {f.facts.map((x) => (
          <div key={x.label} className="fact-print">
            <p className="lab">{x.label}</p>
            <strong>{x.value}</strong>
            <p><Glossed text={x.detail} /></p>
            <LawLine laws={x.laws} />
          </div>
        ))}
      </div>

      {f.hardLines.map((h) => (
        <div key={h.title} className="box alert" style={{ marginTop: 14 }}>
          <p className="lab" style={{ color: "var(--rq)" }}>Hard line</p>
          <strong>{h.title}</strong>
          <p><Glossed text={h.say} /></p>
          <p style={{ fontWeight: 600, marginBottom: 2 }}>Ways past it:</p>
          <ul className="plain">{h.waysOut.map((w) => <li key={w}>{w}</li>)}</ul>
          <LawLine law={h.law} />
        </div>
      ))}

      {f.easier && (
        <div className="box" style={{ marginTop: 18, boxShadow: "5px 5px 0 var(--data)" }}>
          <p className="lab">The easier version</p>
          <p><strong>{f.easier.change}</strong></p>
          <p className="mu">You'd give up: {f.easier.cost}</p>
          <p><Glossed text={`How: ${f.easier.how}`} /></p>
        </div>
      )}

      <h3>What to do, in order</h3>
      {f.actions.length === 0 && <p className="mu">Nothing to do. Keep this page with the idea.</p>}
      <ol className="actions">
        {f.actions.map((a) => (
          <li key={a.n}>
            <div className="action-head">
              <strong>{a.what}</strong>
              <span className="mono mu">{a.who} · {a.howLong}</span>
            </div>
            <p><Glossed text={a.meaning} /></p>
            {a.why && <p className="mu">Because {a.why}.</p>}
            {a.person !== "nothing" && <p className="mu">A person still does: {a.person}.</p>}
            <LawLine law={a.law} />
          </li>
        ))}
      </ol>

      <h3>Still needs a person</h3>
      <ul className="plain">{f.needsPerson.map((x) => <li key={x}><Glossed text={x} /></li>)}</ul>
      <p className="mu small">This is a screening, not legal advice. Plainflow never says a flow is lawful; it says what still needs a person.</p>
    </>
  );
}

function ForDpo({ p }: { p: PackData }) {
  const r = p.forDpo;
  return (
    <>
      <Head p={p} kicker="Screening record and company cards" />
      <p><strong>Outcome:</strong> {r.outcome}. <strong>Risk owner:</strong> {p.forNext.riskOwner ?? <span className="rq">not named</span>}.</p>

      <h3>Data and levels</h3>
      <table className="tbl">
        <thead><tr><th>Data</th><th>Level</th><th>Because</th><th>Rule that follows</th></tr></thead>
        <tbody>{r.tiers.map((t) => <tr key={t.title}><td>{t.title}</td><td className="mono">{t.tier}</td><td>{t.because}</td><td>{t.rule}</td></tr>)}</tbody>
      </table>

      <h3>Screening</h3>
      <table className="tbl">
        <thead><tr><th>Q</th><th>Question</th><th>Answer</th><th>Because</th><th>Law</th></tr></thead>
        <tbody>
          {r.screening.map((s) => (
            <tr key={s.id}><td className="mono">{s.id}</td><td>{s.text}</td><td className={`mono ${s.yes ? "rq" : ""}`} style={{ fontWeight: 600 }}>{s.yes ? "Yes" : "No"}</td><td>{s.because || <span className="mu">nothing on the canvas</span>}</td><td className="mono" style={{ fontSize: 11 }}>{s.law ?? ""}</td></tr>
          ))}
        </tbody>
      </table>

      <h3>Where personal data goes</h3>
      {r.crossings.length === 0 ? <p className="mu">Nothing personal leaves the organisation.</p> : (
        <table className="tbl">
          <thead><tr><th>From</th><th>To</th><th>Level</th><th>Status</th></tr></thead>
          <tbody>{r.crossings.map((c, i) => <tr key={i}><td>{c.from}</td><td>{c.to}</td><td className="mono">{c.tier}</td><td className={c.blocked ? "rq" : "ok"}>{c.blocked ? "blocked" : "allowed"}</td></tr>)}</tbody>
        </table>
      )}

      {r.cards.length > 0 && <h3>Company cards</h3>}
      <div className="cards-print">
        {r.cards.map((c) => (
          <div key={c.id} className="card-print">
            <div className="card-print-head"><strong>{c.title}</strong><span className="mono mu">{c.tier >= 0 ? `receives level ${c.tier}` : "via your supplier"}</span></div>
            <dl>
              <dt>Role</dt><dd>{c.role}</dd>
              {c.plan && <><dt>Plan</dt><dd>{c.plan}{c.planNeeded ? <span className="rq"> · would need {c.planNeeded}</span> : ""}</dd></>}
              <dt>Contract</dt><dd className={/to do|blocked|partial/.test(c.dpa) ? "rq" : "ok"}>{c.dpa}</dd>
              <dt>Hosted</dt><dd>{c.region} · transfer: {c.transfer}</dd>
              <dt>Keeps data</dt><dd>{c.retention}</dd>
              <dt>Article 28</dt><dd>{c.art28.evidenced} of {c.art28.of} terms evidenced{c.art28.missing.length ? `; missing: ${c.art28.missing.join(", ")}` : ""}</dd>
              {c.open.length > 0 && <><dt>Open</dt><dd>{c.open.join("; ")}</dd></>}
            </dl>
            {c.questions.length > 0 && (
              <details>
                <summary className="mono" style={{ fontSize: 12, cursor: "pointer" }}>Questions to send {c.title} (no card on file)</summary>
                <ol>{c.questions.map((q) => <li key={q}>{q}</li>)}</ol>
              </details>
            )}
          </div>
        ))}
      </div>

      <h3>What was asked</h3>
      <table className="tbl">
        <thead><tr><th>Question</th><th>About</th><th>Answer</th></tr></thead>
        <tbody>{r.asked.map((a) => <tr key={a.ask + a.about}><td>{a.ask}</td><td>{a.about}</td><td className={a.answer ? "" : "mu"}>{a.answer ?? "assumed, not asked"}</td></tr>)}</tbody>
      </table>

      <h3>Where this comes from</h3>
      <LawLine laws={r.laws} />
    </>
  );
}

function ForNext({ p }: { p: PackData }) {
  const n = p.forNext;
  return (
    <>
      <Head p={p} kicker="Session note, for whoever picks this up next" />
      <h3>Agreed today</h3>
      <ul className="plain">{n.agreed.map((a) => <li key={a}>{a}</li>)}</ul>
      <h3>Bring next time</h3>
      {n.bring.length === 0 ? <p className="mu">Nothing outstanding.</p> : <ul className="plain">{n.bring.map((b) => <li key={b}>{b}</li>)}</ul>}
      <h3>Assumed, not asked ({n.assumed.length})</h3>
      {n.assumed.length === 0 ? <p className="mu">Every question was answered.</p> : <ul className="plain">{n.assumed.map((a) => <li key={a}>{a}</li>)}</ul>}
      <h3>What changed in this session</h3>
      <ul className="plain mono" style={{ fontSize: 12 }}>{n.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
      <p className="mu small">Save the file to reopen the picture exactly as it is. Company cards saved from the drawer are kept in this browser for the next flow.</p>
    </>
  );
}
