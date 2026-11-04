import type { Derivation, Flow, RuleSet } from "../engine/types";
import { stepsFor } from "./questions";

/** The rules table rendered as a page, so a DPO can read and challenge it without reading code. */
export function RulesPage({ set }: { set: RuleSet }) {
  const r = set.rules;
  const src = (id: string) => (r.sources[id] ? <a href={r.sources[id].url} target="_blank" rel="noreferrer">{r.sources[id].label}</a> : id);
  return (
    <div className="page">
      <div className="inner">
        <p className="lab">Rules table · version {r.version} · owner {r.owner} · review {r.review_date}</p>
        <h1>The rules</h1>
        <p className="lede">
          Everything the canvas decides comes from this table. It lives in <code className="x">data/rules.json</code> and{" "}
          <code className="x">data/requirements.json</code>. If a result looks wrong, change the rule here, not the flow. {r.expression_help}
        </p>

        <h2 id="rules-tiers">Tiers</h2>
        <table className="tbl">
          <thead><tr><th>Tier</th><th>Meaning</th><th>Rule</th></tr></thead>
          <tbody>
            {Object.entries(r.tiers).map(([t, x]) => <tr key={t}><td className="mono">{t}</td><td>{x.label}</td><td>{x.rule}</td></tr>)}
          </tbody>
        </table>
        <p className="lede" style={{ marginTop: 12 }}>{r.tier_rules.note}</p>
        <table className="tbl">
          <thead><tr><th>Tier</th><th>When</th><th>Because</th></tr></thead>
          <tbody>
            {r.tier_rules.rules.map((x) => <tr key={x.tier}><td className="mono">{x.tier}</td><td><code>{x.when}</code></td><td>{x.because}</td></tr>)}
          </tbody>
        </table>
        <p className="lede" style={{ marginTop: 12 }}>
          Account basics (Tier 1): {r.tier1_categories.join(", ")}. Special category (Tier 3): {r.tier3_categories.join(", ")}. Safety: {r.safety_categories.join(", ")}.
        </p>

        <h2>Pseudonymisation credit</h2>
        <table className="tbl">
          <tbody>
            <tr><td style={{ width: 160 }}>Turned on</td><td>{r.pseudonymisation_credit.enabled ? "Yes" : "No"}</td></tr>
            <tr><td>Applies when</td><td><code>{r.pseudonymisation_credit.applies_when}</code></td></tr>
            <tr><td>Effect</td><td>{r.pseudonymisation_credit.effect}</td></tr>
            <tr><td>Why</td><td>{r.pseudonymisation_credit.why}</td></tr>
          </tbody>
        </table>

        <h2>Sanctioned routes</h2>
        <p className="lede">{r.sanctioned.note}</p>
        <table className="tbl">
          <thead><tr><th>Company or product</th><th>Up to tier</th><th>AI approved</th></tr></thead>
          <tbody>
            {Object.entries(r.sanctioned.list).map(([id, s]) => (
              <tr key={id}><td>{set.products.companies[id]?.name ?? set.products.products[id]?.name ?? id}</td><td className="mono">{s.max_tier}</td><td>{s.ai ? "Yes" : "No"}</td></tr>
            ))}
            <tr><td className="mu">Anything else</td><td className="mono">{r.sanctioned.unlisted_max_tier}</td><td>With a DPA</td></tr>
          </tbody>
        </table>

        <h2>Blocked wires</h2>
        <p className="lede">{r.blocked.note}</p>
        <table className="tbl">
          <thead><tr><th>When</th><th>Says</th><th>Ways out</th></tr></thead>
          <tbody>
            {r.blocked.rules.map((x) => <tr key={x.id}><td><code>{x.when}</code></td><td>{x.message}</td><td>{x.ways_out.join(" Or: ")}</td></tr>)}
          </tbody>
        </table>

        <h2>Hard lines</h2>
        <p className="lede">{r.bright_lines.note}</p>
        <table className="tbl">
          <thead><tr><th>Line</th><th>Checked on</th><th>When</th><th>Kind</th><th>Source</th></tr></thead>
          <tbody>
            {r.bright_lines.rules.map((x) => (
              <tr key={x.id}><td><strong>{x.title.replace("{title}", "The company")}</strong><div className="mu">{x.say.replace(/\{title\}/g, "it")}</div></td><td>{x.type}</td><td><code>{x.when}</code></td><td>{x.kind === "stop" ? "Stop" : "Consult the ICO"}</td><td>{src(x.source)}</td></tr>
            ))}
          </tbody>
        </table>

        <h2>Locked levers</h2>
        <table className="tbl">
          <thead><tr><th>Node</th><th>Lever</th><th>When</th><th>Why</th></tr></thead>
          <tbody>
            {r.locks.map((x) => <tr key={x.type + x.lever}><td>{x.type}</td><td>{x.lever}</td><td><code>{x.when}</code></td><td>{x.reason}</td></tr>)}
          </tbody>
        </table>

        <h2>Screening questions</h2>
        <p className="lede">
          Any yes in A1 to A7 (<code className="x">{r.outcome.required_if}</code>) means a full DPIA. One yes in A8 to A17 (<code className="x">{r.outcome.recommended_if}</code>) means one is recommended.
        </p>
        <table className="tbl">
          <thead><tr><th>Q</th><th>Question</th><th>Checked on</th><th>Yes when</th><th>Source</th></tr></thead>
          <tbody>
            {r.screening.map((q) => (
              <tr key={q.id}><td className="mono">{q.id}</td><td>{q.text}</td><td>{q.type}</td><td><code>{q.when}</code></td><td>{src(q.source)}</td></tr>
            ))}
          </tbody>
        </table>

        <h2>AI use case floor</h2>
        <p className="lede">{r.use_case_floor.note}</p>
        <table className="tbl">
          <thead><tr><th>Use case</th><th>Minimum</th><th>Lifts the outcome to at least</th></tr></thead>
          <tbody>
            {Object.entries(r.use_case_floor.by_use_case).map(([uc, lvl]) => {
              const l = r.use_case_floor.levels.find((x) => x.id === lvl);
              return <tr key={uc}><td>{uc.replace(/_/g, " ")}</td><td>{l?.label}</td><td>{r.outcome.labels[l?.min_outcome ?? ""]}</td></tr>;
            })}
          </tbody>
        </table>

        <h2>Risk, effort, verdict</h2>
        <table className="tbl">
          <thead><tr><th>Meter</th><th>When</th><th>Result</th></tr></thead>
          <tbody>
            {r.risk.map((x) => <tr key={"risk" + x.level}><td>Risk</td><td><code>{x.when}</code></td><td>{x.level}</td></tr>)}
            {r.effort.rules.map((x, i) => <tr key={"eff" + i}><td>Effort</td><td><code>{x.when}</code></td><td>{r.effort.signoff_labels[x.signoff]}, {r.effort.time_labels[x.time]}</td></tr>)}
            {r.verdict.map((x) => <tr key={"v" + x.id}><td>Verdict</td><td><code>{x.when}</code></td><td>{x.label}</td></tr>)}
          </tbody>
        </table>

        <h2>Requirements</h2>
        <p className="lede">{set.requirements.note}</p>
        <table className="tbl">
          <thead><tr><th>Document</th><th>When</th><th>Who</th><th>How long</th><th>Left for a person</th><th>Source</th></tr></thead>
          <tbody>
            {set.requirements.requirements.map((q) => (
              <tr key={q.id}>
                <td><strong>{q.title}</strong><div className="mu">{q.meaning}</div></td>
                <td><code>{q.per ? `each ${q.per}: ` : ""}{q.when}</code></td>
                <td>{set.requirements.owner_labels[q.owner] ?? q.owner}</td>
                <td>{set.requirements.effort_labels[q.effort] ?? q.effort}</td>
                <td>{q.left_for_person}</td>
                <td>{src(q.source)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Cheapest change candidates</h2>
        <p className="lede">{r.cheapest_change.note}</p>
        <table className="tbl">
          <thead><tr><th>Change</th><th>Offered when</th><th>You'd give up</th></tr></thead>
          <tbody>
            {r.cheapest_change.candidates.map((c) => (
              <tr key={c.type + c.lever + String(c.to)}><td>{c.type}: {c.lever} to {String(c.to)}</td><td><code>{c.when}</code></td><td>{c.cost}</td></tr>
            ))}
          </tbody>
        </table>

        <h2>Levers</h2>
        <p className="lede">{r.levers.note}</p>
        <table className="tbl">
          <thead><tr><th>Node</th><th>Lever</th><th>Plain sentence</th><th>Example</th></tr></thead>
          <tbody>
            {(["people", "data", "purpose", "system", "company"] as const).flatMap((t) =>
              r.levers[t].map((l) => <tr key={t + l.id}><td>{t}</td><td>{l.label}</td><td>{l.sentence}</td><td>{l.example}</td></tr>),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The 17 screening answers with their because, for the DPO. */
export function ScreeningPage({ flow, d, set }: { flow: Flow; d: Derivation; set: RuleSet }) {
  const title = (id: string) => flow.nodes.find((n) => n.id === id)?.title ?? id;
  const dataNodes = flow.nodes.filter((n) => n.type === "data");
  return (
    <div className="page">
      <div className="inner">
        <p className="lab">Screening record · draft {flow.version}</p>
        <h1>{flow.title}</h1>
        {flow.story && <p className="lede" style={{ fontSize: 17, color: "var(--ink)" }}>{flow.story}</p>}
        {flow.source?.kind === "scan" && (
          <div className="box info" style={{ maxWidth: 720 }}>
            <p className="lab" style={{ marginBottom: 4 }}>From a code scan</p>
            <div>
              {flow.source.repo && <a href={flow.source.repo} target="_blank" rel="noreferrer">{flow.source.repo}</a>}
              {flow.source.score != null && <> · scanner score {flow.source.score}/100, {String(flow.source.risk ?? "").toLowerCase()}</>}
              {flow.source.scanned_at && <> · scanned {flow.source.scanned_at.slice(0, 10)}</>}
            </div>
            {flow.source.triggers.length > 0 && (
              <ul className="plain">{flow.source.triggers.map((t) => <li key={t}>{t}</li>)}</ul>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", margin: "18px 0" }}>
          <div><p className="lab">Outcome</p><div className="big">{set.rules.outcome.labels[d.outcome]}</div></div>
          <div><p className="lab">Mandatory yes</p><div className="big">{d.mandatory_yes}</div></div>
          <div><p className="lab">Criteria yes</p><div className="big">{d.criteria_yes}</div></div>
          <div><p className="lab">Risk</p><div className="big">{d.risk}</div></div>
        </div>
        {d.floor_raised && <div className="box info">The AI use case raised the outcome to meet its floor.</div>}
        {d.credit_applied && <div className="box info" style={{ marginTop: 8 }}>Pseudonymisation credit applied: {set.rules.pseudonymisation_credit.effect}</div>}

        <h2>Data and tiers</h2>
        <table className="tbl">
          <thead><tr><th>Data</th><th>Tier</th><th>Because</th><th>Rule that follows</th></tr></thead>
          <tbody>
            {dataNodes.map((n) => (
              <tr key={n.id}><td>{n.title}</td><td className="mono">{d.tiers[n.id]}{d.screening_tiers[n.id] !== d.tiers[n.id] ? ` (${d.screening_tiers[n.id]} for screening)` : ""}</td><td>{d.tier_because[n.id]}</td><td>{set.rules.tiers[String(d.tiers[n.id])]?.rule}</td></tr>
            ))}
          </tbody>
        </table>

        <h2>Part A: screening</h2>
        <table className="tbl">
          <thead><tr><th>Q</th><th>Question</th><th>Answer</th><th>Because</th><th>Source</th></tr></thead>
          <tbody>
            {Object.values(d.screening).map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.id}</td>
                <td>{a.text}</td>
                <td className={`mono ${a.yes ? "rq" : ""}`} style={{ fontWeight: 600 }}>{a.yes ? "Yes" : "No"}</td>
                <td>{a.because.join("; ") || <span className="mu">nothing on the canvas</span>}</td>
                <td>{a.source ? <a href={a.source.url} target="_blank" rel="noreferrer">{a.source.label}</a> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Crossings</h2>
        <table className="tbl">
          <thead><tr><th>Wire</th><th>Carries</th><th>Tier</th><th>Status</th></tr></thead>
          <tbody>
            {d.crossings.length === 0 && <tr><td colSpan={4} className="mu">No personal data leaves the organisation.</td></tr>}
            {d.crossings.map((c) => {
              const e = flow.edges.find((x) => x.id === c.edge)!;
              return (
                <tr key={c.edge}><td>{title(e.from)} to {title(c.to)}</td><td>{d.edges[c.edge].data.map(title).join(", ")}</td><td className="mono">{c.tier}</td><td className={c.blocked ? "rq" : "ok"}>{c.blocked ? "blocked" : "allowed"}</td></tr>
              );
            })}
          </tbody>
        </table>

        <h2>What was asked</h2>
        <p className="lede">Answers from the Q&A. Anything marked assumed wasn't asked, because no answer would have changed the result at the time; the canvas kept the guess from the opening sentence.</p>
        <table className="tbl">
          <thead><tr><th>Question</th><th>About</th><th>Answer</th></tr></thead>
          <tbody>
            {stepsFor(flow, d).map((s) => (
              <tr key={s.key}>
                <td>{s.ask}</td>
                <td>{s.node?.title ?? "the whole idea"}</td>
                <td className={flow.answers?.[s.key] ? undefined : "mu"}>{flow.answers?.[s.key] ?? "assumed, not asked"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Still needs a person</h2>
        <ul className="plain">{d.needs_person.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="lede" style={{ marginTop: 14 }}>Screening complete. This record says what the canvas found; it does not say the flow is lawful.</p>
      </div>
    </div>
  );
}
