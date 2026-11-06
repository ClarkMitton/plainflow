import { useState } from "react";
import type { FlowNode } from "../engine/types";
import { GROUP_LABEL, ROLE_LABEL, TYPE_LABEL, useFlow } from "./context";
import { art28Clauses, cards } from "./flowOps";
import { cardFor, saveCard } from "./cardLibrary";
import { Lever } from "./Lever";
import { nameWarning } from "./names";
import { Glossed, Term } from "./plain";

interface Props {
  node: FlowNode;
  onProduct(productId: string | null): void;
  onLoadCard(cardId: string): void;
  onDelete(): void;
  onConnect(otherId: string): void;
  onDisconnect(edgeId: string): void;
}

export function TextField({ label, value, onChange, area, placeholder }: { label: string; value: unknown; onChange(v: string): void; area?: boolean; placeholder?: string }) {
  const v = value == null ? "" : String(value);
  const warn = nameWarning(v);
  return (
    <label className="field">
      <span>{label}</span>
      {area ? (
        <textarea value={v} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={v} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {warn && <span className="warn" role="alert">{warn}</span>}
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: unknown; options: [string, string][]; onChange(v: string | null): void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value || null)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

const LAWFUL: [string, string][] = [
  ["", "Not chosen yet"],
  ["public_task", "Public task (our job as a public body)"],
  ["legal_obligation", "Legal obligation (the law says we must)"],
  ["contract", "Contract (needed for a contract with them)"],
  ["consent", "Consent (they agreed, and can withdraw)"],
  ["legitimate_interests", "Legitimate interests (needs a balancing test)"],
  ["vital_interests", "Vital interests (to protect someone's life)"],
  ["none", "We can't name one (a hard line)"],
];
const USE_CASES: [string, string][] = [
  ["", "Not set"],
  ["generic_templates", "Generic templates, no personal data"],
  ["anonymised_work", "Anonymised work"],
  ["identifiable_work", "Identifiable work"],
  ["formative_mark", "Formative mark"],
  ["final_grade", "Final grade"],
  ["progression_decision", "Progression decision"],
];
const REGIONS: [string, string][] = [["unknown", "Unknown"], ["UK", "UK"], ["EU", "EU"], ["US", "US"], ["other", "Other"]];
const TRANSFER: [string, string][] = [["unknown", "Unknown"], ["none_needed", "None needed"], ["adequacy", "Adequacy"], ["idta", "IDTA"], ["addendum", "UK addendum"], ["none", "None in place"]];

export function Drawer({ node, onProduct, onLoadCard, onDelete, onConnect, onDisconnect }: Props) {
  const { d, set, flow, setField, setTitle, select } = useFlow();
  const facts = d.facts[node.id] ?? {};
  const locks = d.locks[node.id] ?? {};
  const f = node.fields;
  const field = (k: string) => (v: unknown) => setField(node.id, k, v);
  const triggered = Object.values(d.screening).filter((a) => a.nodes.includes(node.id));
  const reqs = d.requirements.filter((r) => r.rail && r.cause.nodes.includes(node.id));
  const pinned = flow.mode === "tier_first" ? flow.tier_pinned : null;

  return (
    <div className="drawer" role="dialog" aria-label={`${node.title} details`}>
      <div className={`h h-${node.type}`}>
        <p className="t" style={{ paddingRight: 60 }}>{node.title}</p>
        <p className="k">{TYPE_LABEL[node.type]}{node.type === "company" ? ` · ${ROLE_LABEL[String(node.levers.role)]}` : ""}</p>
        <button type="button" className="close" onClick={() => select(null)}>Close</button>
      </div>
      <div className="scroll">
        <TextField label="Name on the canvas" value={node.title} onChange={(v) => setTitle(node.id, v)} />

        {node.type === "data" && (
          <div className="box info">
            <strong>Tier {d.tiers[node.id]}</strong>: {set.rules.tiers[String(d.tiers[node.id])]?.label}, because {d.tier_because[node.id]}.
            <div style={{ marginTop: 4 }}>{set.rules.tiers[String(d.tiers[node.id])]?.rule}</div>
            {pinned != null && d.tiers[node.id] > pinned && <div className="warn" style={{ marginTop: 6 }}>Above the Tier {pinned} you set. Change a lever below or pick a higher tier.</div>}
          </div>
        )}

        {node.type === "system" && locks.innovative_tech && (
          <div className="box info">Innovative technology: on, locked. {locks.innovative_tech}</div>
        )}

        {node.type === "company" && d.role_hints[node.id]?.map((h) => <div key={h} className="box alert"><Glossed text={h} /></div>)}

        <div>
          <p className="lab" style={{ marginBottom: 10 }}>Switches</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {set.rules.levers[node.type].filter((def) => !(def.id === "plan" && !facts.has_plans)).map((def) => (
              <Lever key={def.id} nodeId={node.id} def={def} value={facts[def.id] ?? node.levers[def.id]} lockReason={locks[def.id]} variant="drawer" />
            ))}
          </div>
        </div>

        {node.type === "people" && (
          <>
            <Select label="Group" value={f.group} options={Object.entries(GROUP_LABEL)} onChange={field("group")} />
            <TextField label="Description (no names)" value={f.description} onChange={field("description")} placeholder="Level 3 group" />
            <label className="field">
              <span>Rough size</span>
              <input type="number" value={f.size == null ? "" : String(f.size)} onChange={(e) => setField(node.id, "size", e.target.value === "" ? null : Number(e.target.value))} />
            </label>
          </>
        )}

        {node.type === "data" && (
          <>
            <div className="field">
              <span>What's in it</span>
              <div className="cats">
                {set.rules.categories.map(([id, label]) => {
                  const on = ((f.categories as string[]) ?? []).includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`ch${on ? " on" : ""}`}
                      onClick={() => setField(node.id, "categories", on ? (f.categories as string[]).filter((c) => c !== id) : [...((f.categories as string[]) ?? []), id])}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <TextField label="Where it comes from" value={f.source_system} onChange={field("source_system")} placeholder="Teams assignments" />
            <Select label="Lawful basis (the legal reason you can use it)" value={f.lawful_basis} options={LAWFUL} onChange={field("lawful_basis")} />
          </>
        )}

        {node.type === "purpose" && (
          <>
            <TextField area label="What it achieves" value={f.value} onChange={field("value")} />
            <TextField area label="Could it be done with less data?" value={f.alternatives} onChange={field("alternatives")} />
            <TextField area label="Should it be done at all? One sentence" value={f.should_it_be_done} onChange={field("should_it_be_done")} />
            <TextField area label="How someone challenges an outcome" value={f.challenge_route} onChange={field("challenge_route")} />
            <Select label="Could it be done with less data, or without names?" value={f.less_intrusive ?? "unsure"} options={[["unsure", "Not sure"], ["no", "No, it needs this data"], ["yes", "Yes (a hard line: do that instead)"]]} onChange={field("less_intrusive")} />
            <Select label="Could you show, delete or explain someone's data on request?" value={f.rights_possible ?? "unsure"} options={[["unsure", "Not sure"], ["yes", "Yes"], ["no", "No (a hard line)"]]} onChange={field("rights_possible")} />
            <div className="grid2">
              <label className="field">
                <span>How many people</span>
                <input type="number" value={f.scale == null ? "" : String(f.scale)} onChange={(e) => setField(node.id, "scale", e.target.value === "" ? null : Number(e.target.value))} />
              </label>
              <TextField label="Privacy notice link" value={f.privacy_notice_url} onChange={field("privacy_notice_url")} />
            </div>
          </>
        )}

        {node.type === "system" && (
          <>
            <label className="field">
              <span>Product</span>
              <select value={String(f.product_id ?? "")} onChange={(e) => onProduct(e.target.value || null)}>
                <option value="">Something else (not in the directory)</option>
                {Object.entries(set.products.products).map(([id, p]) => {
                  const company = p.company;
                  const max = company ? set.rules.sanctioned.list[company]?.max_tier ?? set.rules.sanctioned.list[id]?.max_tier ?? set.rules.sanctioned.unlisted_max_tier : 3;
                  const blocked = pinned != null && max < pinned;
                  return (
                    <option key={id} value={id} disabled={blocked}>
                      {p.name}{blocked ? ` (not at Tier ${pinned})` : ""}
                    </option>
                  );
                })}
              </select>
              <span className="mu" style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--sans)", fontWeight: 400, fontSize: 12 }}>
                Picking a product brings its company and sub-processors onto the canvas.
              </span>
            </label>
            <Select label="AI use case" value={f.use_case} options={USE_CASES} onChange={field("use_case")} />
            {(() => {
              const product = set.products.products[String(f.product_id ?? "")];
              if (!product?.plans) return null;
              return (
                <div className="field">
                  <span>What each plan allows</span>
                  <table className="tbl plans">
                    <thead><tr><th>Plan</th><th>Up to</th><th>Contract</th><th>Trains</th><th>Cost</th></tr></thead>
                    <tbody>
                      {Object.entries(product.plans).map(([id, pl]) => (
                        <tr key={id} className={node.levers.plan === id ? "on" : undefined}>
                          <td>{(set.products.plan_labels[id] ?? id).replace(/^the /, "").replace(/^[a-z]/, (c) => c.toUpperCase())}</td>
                          <td className="mono">Tier {pl.max_tier}</td>
                          <td className={pl.dpa ? "ok" : "rq"}>{pl.dpa ? "DPA" : "none"}</td>
                          <td className={pl.trains ? "rq" : "ok"}>{pl.trains ? "yes" : "no"}</td>
                          <td>{pl.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {product.plans[String(node.levers.plan ?? "free")]?.note && <span className="mu" style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--sans)", fontWeight: 400, fontSize: 12 }}>{product.plans[String(node.levers.plan ?? "free")]?.note}</span>}
                </div>
              );
            })()}
          </>
        )}

        {node.type === "company" && <CompanyCard node={node} onLoadCard={onLoadCard} />}

        <div>
          <p className="lab" style={{ marginBottom: 6 }}>Connected to</p>
          {flow.edges.filter((e) => e.from === node.id || e.to === node.id).length === 0 && (
            <div className="warn" style={{ marginBottom: 6 }}>Nothing yet, so this box doesn't change the answer. Connect it below.</div>
          )}
          <ul className="plain conn">
            {flow.edges.filter((e) => e.from === node.id || e.to === node.id).map((e) => {
              const other = flow.nodes.find((n) => n.id === (e.from === node.id ? e.to : e.from));
              const outgoing = e.from === node.id;
              return (
                <li key={e.id}>
                  <span className="mono mu" style={{ fontSize: 11 }}>{outgoing ? "to" : "from"}</span> {other?.title ?? "?"}
                  <button type="button" className="remove" aria-label={`Disconnect from ${other?.title ?? "this box"}`} title="Disconnect" onClick={() => onDisconnect(e.id)}>×</button>
                </li>
              );
            })}
          </ul>
          <label className="field" style={{ marginTop: 6 }}>
            <span>Also connect to</span>
            <select value="" onChange={(e) => e.target.value && onConnect(e.target.value)}>
              <option value="">Choose a box…</option>
              {flow.nodes
                .filter((n) => n.id !== node.id && !flow.edges.some((e) => (e.from === node.id && e.to === n.id) || (e.to === node.id && e.from === n.id)))
                .map((n) => <option key={n.id} value={n.id}>{n.title} ({TYPE_LABEL[n.type].toLowerCase()})</option>)}
            </select>
            <span className="mu" style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--sans)", fontWeight: 400, fontSize: 12 }}>Plainflow picks the direction: people and data go into the tool, the tool into the purpose and the companies.</span>
          </label>
        </div>

        {(triggered.length > 0 || reqs.length > 0) && (
          <div>
            <p className="lab" style={{ marginBottom: 6 }}>What this node causes</p>
            <ul className="plain">
              {triggered.map((a) => <li key={a.id}><strong>{a.id}</strong> {a.text.toLowerCase()}</li>)}
              {reqs.map((r) => <li key={r.key}>{r.title}: <span className={r.status === "to_do" ? "rq" : "ok"}>{set.requirements.status_labels[r.status]}</span></li>)}
            </ul>
          </div>
        )}

        <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={onDelete}>Remove from canvas</button>
      </div>
    </div>
  );
}

function CompanyCard({ node, onLoadCard }: { node: FlowNode; onLoadCard(cardId: string): void }) {
  const { d, set, flow, setField } = useFlow();
  const f = node.fields;
  const art28 = (f.art28 ?? {}) as Record<string, string | null>;
  const sec = (f.security_assessment ?? { status: "none", date: null }) as { status: string; date: string | null };
  const subs = flow.edges.filter((e) => e.kind === "sub_processor" && e.from === node.id).map((e) => flow.nodes.find((n) => n.id === e.to)!).filter(Boolean);
  const available = Object.entries(cards).filter(([, c]) => c.company_id === f.company_id);
  const libraryCard = cardFor(f.company_id as string | undefined);
  const [saved, setSaved] = useState(false);
  const company = f.company_id ? set.products.companies[String(f.company_id)] : null;
  const open = d.requirements.filter((r) => r.node === node.id && r.status !== "on_file" && r.status !== "covered");
  const missing = art28Clauses.filter(([k]) => !art28[k]);
  const field = (k: string) => (v: unknown) => setField(node.id, k, v);

  return (
    <>
      <div className="box info">
        <strong>Company card</strong> {f.card_ref ? <span className="mono">· {String(f.card_ref)}</span> : <span className="rq mono">· no card yet</span>}
        {company?.notes && <div style={{ marginTop: 4 }}>{company.notes}</div>}
        {company?.dpa_url && company.dpa_url.startsWith("http") && (
          <div style={{ marginTop: 4 }}><a href={company.dpa_url} target="_blank" rel="noreferrer">Supplier's DPA</a></div>
        )}
        {!f.card_ref && available.length > 0 && (
          <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => onLoadCard(available[0][0])}>Use the saved {available[0][1].title} card</button>
        )}
        {!f.card_ref && !available.length && libraryCard && libraryCard.saved_at && (
          <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => onLoadCard(`library:${libraryCard.company_id}`)}>Use the card saved on {libraryCard.saved_at.slice(0, 10)}</button>
        )}
        {f.company_id ? (
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" className="btn sm" onClick={() => { saveCard(node); setSaved(true); window.setTimeout(() => setSaved(false), 1800); }}>{saved ? "Saved for next time" : "Save this card for next time"}</button>
            <span className="mono mu" style={{ fontSize: 11 }}>Kept in this browser; the role stays with the flow.</span>
          </div>
        ) : null}
        {f.card_ref ? <div className="mono mu" style={{ marginTop: 6, fontSize: 11 }}>The card is shared across flows. The role belongs to this flow.</div> : null}
      </div>

      <div className="grid2">
        <Select label="Region" value={f.region} options={REGIONS} onChange={field("region")} />
        <Select label="Transfer" value={f.transfer_mechanism} options={TRANSFER} onChange={field("transfer_mechanism")} />
      </div>
      <div className="grid2">
        <TextField label="Kept for" value={f.retention} onChange={field("retention")} placeholder="30 days" />
        <TextField label="How it's deleted" value={f.deletion_route} onChange={field("deletion_route")} />
      </div>
      <Select label="Will they sign up to our terms?" value={f.vendor_position ?? "unknown"} options={[["unknown", "Don't know yet"], ["agreed", "Yes, signed or on offer"], ["refused", "No, they won't (a hard line)"]]} onChange={field("vendor_position")} />
      <TextField label="DPA document (the signed agreement: link or reference)" value={f.dpa_document} onChange={field("dpa_document")} />

      <div className="field">
        <span><Term t="Article 28" /> · {art28Clauses.length - missing.length} of {art28Clauses.length} terms evidenced</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          {art28Clauses.map(([k, label]) => (
            <div key={k} className="clause">
              <span className={`dot ${art28[k] ? "ok" : "rq"}`} />
              <span>{label}</span>
              <input value={art28[k] ?? ""} placeholder="clause or link" onChange={(e) => setField(node.id, "art28", { ...art28, [k]: e.target.value || null })} />
            </div>
          ))}
        </div>
        <a href={set.rules.sources.ico_art28.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, textTransform: "none", letterSpacing: 0, fontFamily: "var(--sans)", fontWeight: 400 }}>
          {set.rules.sources.ico_art28.label}
        </a>
      </div>

      <div className="grid2">
        <Select label="Security check" value={sec.status} options={[["none", "None"], ["pending", "Pending"], ["accepted", "Accepted"]]} onChange={(v) => setField(node.id, "security_assessment", { ...sec, status: v })} />
        <TextField label="Review date" value={f.review_date} onChange={field("review_date")} placeholder="2027-09-01" />
      </div>
      <TextField label="Card owner (a role)" value={f.owner} onChange={field("owner")} />

      {subs.length > 0 && (
        <div>
          <p className="lab" style={{ marginBottom: 4 }}>Sub-processors</p>
          <ul className="plain">{subs.map((s) => <li key={s.id}>{s.title}</li>)}</ul>
        </div>
      )}

      {(open.length > 0 || missing.length > 0) && (
        <div>
          <p className="lab" style={{ marginBottom: 4 }}>Open actions</p>
          <ul className="plain">
            {open.map((r) => <li key={r.key}>{r.title}</li>)}
            {missing.length > 0 && <li>Add evidence for {missing.length} Article 28 term{missing.length === 1 ? "" : "s"}</li>}
            {node.levers.keeps_data ? <li>Confirm retention in writing</li> : null}
          </ul>
        </div>
      )}

      {!f.card_ref && node.levers.role !== "sub_processor" && (
        <div className="box dashed">
          <p className="lab" style={{ marginBottom: 4 }}>Questions to send {node.title}</p>
          <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {set.products.supplier_questions.map((q) => <li key={q} style={{ margin: "3px 0" }}>{q}</li>)}
          </ol>
        </div>
      )}
    </>
  );
}
