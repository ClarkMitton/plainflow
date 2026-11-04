import type { Flow } from "../engine/types";
import type { AuditCard, RepoIndex, ThirdPartyService } from "../scanner/types";
import { Glossed } from "./plain";

/**
 * The full scan report, rebuilt from the scanner's web app: what was found in the code, with the
 * evidence, what it does not prove, and the questions only a person can answer. Read-only; the
 * answer Plainflow gives lives on the Canvas, which adds what code can't tell.
 */
export function ScanReport({ flow }: { flow: Flow }) {
  const report = flow.source?.report as RepoIndex | undefined;
  if (!report) return <div className="page"><div className="inner"><p className="lede">No scan report is attached to this flow.</p></div></div>;
  const s = report.auditSummary;
  const dpo = s.dpoSummary;
  const level = (x: string) => x.toLowerCase().replace(/_/g, " ");
  const tone = (x: string) => (x === "HIGH" || x === "RED" ? "rq" : x === "LOW" || x === "GREEN" ? "ok" : "");

  return (
    <div className="page report">
      <div className="inner">
        <p className="lab">Code scan · {report.repo} · {report.scannedAt?.slice(0, 10)} · {report.findings.length} findings in the code</p>
        <h1>{flow.title}: what the code shows</h1>
        <p className="lede" style={{ color: "var(--ink)" }}>{s.conclusion} {dpo.overview}</p>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", margin: "18px 0 8px" }}>
          <div><p className="lab">Scanner score</p><div className="big">{report.summary.gdprScore}<span className="mu" style={{ fontSize: 20 }}>/100</span></div></div>
          <div><p className="lab">Risk from the code</p><div className={`big ${tone(s.overallRisk)}`}>{level(s.overallRisk)}</div></div>
          <div><p className="lab">Data flows traced</p><div className="big">{report.verifiedFlows.length}</div></div>
          <div><p className="lab">A DPIA</p><div className="big">{s.dpiaScreening.dpiaRecommended ? "looks likely" : "not triggered"}</div></div>
        </div>
        <div className="box info" style={{ maxWidth: 760 }}>
          This page reads the code only. It can't see who the people are, the legal reason, or who signs. The Canvas tab adds those from your answers and gives the answer that counts.
        </div>

        <h2>In plain words</h2>
        <div className="threecol">
          <div>
            <p className="lab">Problems found</p>
            <ul className="plain">
              {dpo.problems.map((p, i) => <li key={i}><span className={`dot ${tone(p.colour)}`} /> {p.description} <span className="mono mu" style={{ fontSize: 11 }}>{level(p.badge)}</span></li>)}
              {dpo.problems.length === 0 && <li className="mu">None confirmed.</li>}
            </ul>
          </div>
          <div>
            <p className="lab">Working well</p>
            <ul className="plain">{dpo.workingWell.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
          <div>
            <p className="lab">What to do about it</p>
            <ul className="plain">
              {dpo.actionItems.map((a, i) => <li key={i}><span className={`tagline ${a.priority === "HIGH" ? "rq" : ""}`}>{a.priority.toLowerCase()} · {level(a.type)}</span> {a.action}</li>)}
            </ul>
          </div>
        </div>
        <p className="mu" style={{ fontSize: 13 }}>Risk from the code: <strong className={tone(dpo.riskLevel)}>{level(dpo.riskLevel)}</strong>. {dpo.riskReason}</p>

        <h2>Evidence, line by line</h2>
        <p className="lede">Each card is one thing the scanner saw, with the exact code. "What this does not prove" is there so nobody reads more into a finding than the code supports.</p>
        {report.auditCards.length === 0 && <p className="mu">No verified data flows. The potential signals below are capabilities, not proof.</p>}
        <div className="cards">{report.auditCards.map((c, i) => <Card key={i} card={c} />)}</div>

        <h2>Outside services</h2>
        {s.thirdPartyServices.length === 0 ? <p className="mu">None detected.</p> : (
          <table className="tbl">
            <thead><tr><th>Service</th><th>Kind</th><th>Found by</th><th>Where in the code</th><th>Hosted</th></tr></thead>
            <tbody>{s.thirdPartyServices.map((x) => <ServiceRow key={x.name} s={x} />)}</tbody>
          </table>
        )}
        {s.residencyNotes.length > 0 && (
          <div className="box dashed" style={{ marginTop: 12 }}>
            <p className="lab" style={{ marginBottom: 4 }}>Where the data lives</p>
            <ul className="plain">{s.residencyNotes.map((n) => <li key={n}><Glossed text={n} /></li>)}</ul>
          </div>
        )}

        {s.mediaCapture?.detected && (
          <>
            <h2>Camera or microphone</h2>
            <p className="lede">The app can capture photos, audio or video. If these show identifiable people, that's biometric or special category data, and children's data if under-18s use it.</p>
            <ul className="plain mono" style={{ fontSize: 12 }}>{s.mediaCapture.evidence.map((e, i) => <li key={i}>{e.file}:{e.line} · {e.snippet}</li>)}</ul>
          </>
        )}

        {s.dpiaScreening.questions.length > 0 && (
          <>
            <h2>Only you can answer these</h2>
            <p className="lede">The code can't settle these. The Questions tab asks the same things in plain words, and the Canvas uses your answers.</p>
            <ul className="plain">{s.dpiaScreening.questions.map((q) => <li key={q.id}>{q.question}{q.dpiaTrigger && <span className="mono mu" style={{ fontSize: 11 }}> · {q.dpiaTrigger}</span>}</li>)}</ul>
          </>
        )}

        {s.security && s.security.length > 0 && (
          <>
            <h2>Security notes</h2>
            <p className="lede">What a code scan can see about security, and what it can't. The "cannot check" rows need confirming separately (firewalls, patching, MFA, malware protection).</p>
            <table className="tbl">
              <thead><tr><th>Area</th><th>Status</th><th>Detail</th><th>Maps to</th></tr></thead>
              <tbody>
                {s.security.map((n, i) => (
                  <tr key={i}><td>{n.area}</td><td className={n.status === "attention" ? "rq" : "mu"}>{n.status.replace("-", " ")}</td><td>{n.detail}</td><td className="mu">{n.mapsTo}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {s.nonFindings.length > 0 && (
          <>
            <h2>Not found</h2>
            <ul className="plain">{s.nonFindings.map((n) => <li key={n}>{n}</li>)}</ul>
          </>
        )}

        {report.dependencies.length > 0 && (
          <>
            <h2>Libraries worth knowing about</h2>
            <p className="mono" style={{ fontSize: 12, lineHeight: 1.8 }}>
              {report.dependencies.map((d) => <span key={d.name} style={{ marginRight: 14 }}>{d.name} <span className="mu">({d.category})</span></span>)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ card }: { card: AuditCard }) {
  const tone = card.riskLevel === "HIGH" ? "rq" : card.riskLevel === "LOW" ? "ok" : "";
  return (
    <details className="card">
      <summary>
        <span className={`tagline ${tone}`}>{card.riskLevel.toLowerCase().replace("_", " ")}{card.needsReview ? " · needs a person" : ""}</span>
        <strong>{card.title}</strong>
        <span className="mono mu" style={{ fontSize: 11 }}>{card.evidence.file}:{card.evidence.line}</span>
      </summary>
      <div className="cardbody">
        <p><strong>The flow:</strong> {card.flow}</p>
        <pre className="code">{card.evidence.code}</pre>
        <p><strong>Why it matters:</strong> <Glossed text={card.whyItMatters} /></p>
        <div className="twocol">
          <div>
            <p className="lab">Why it was flagged</p>
            <ul className="plain">{card.whyThisWasFlagged.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
          <div>
            <p className="lab">What this does not prove</p>
            <ul className="plain">{card.whatIsNOTTrue.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        </div>
        {card.clarifyingQuestions && card.clarifyingQuestions.length > 0 && (
          <>
            <p className="lab">Only you can answer</p>
            <ul className="plain">{card.clarifyingQuestions.map((q) => <li key={q.id}>{q.question}</li>)}</ul>
          </>
        )}
        <p className="mono mu" style={{ fontSize: 11 }}>confidence {Math.round(card.confidence * 100)}% · {card.tags.map((t) => t.toLowerCase().replace(/_/g, " ")).join(", ")}</p>
      </div>
    </details>
  );
}

function ServiceRow({ s }: { s: ThirdPartyService }) {
  return (
    <tr>
      <td><strong>{s.name}</strong>{s.isAI && <span className="tagline" style={{ marginLeft: 6 }}>AI</span>}</td>
      <td>{s.category}</td>
      <td className="mono" style={{ fontSize: 12 }}>{s.detectedVia.join(", ")}</td>
      <td className="mono" style={{ fontSize: 11 }}>{s.evidence.map((e, i) => <div key={i}>{e.file}:{e.line}</div>)}</td>
      <td>{s.residencyKnown ? s.regionHint : <span className="rq">not visible in the code</span>}</td>
    </tr>
  );
}
