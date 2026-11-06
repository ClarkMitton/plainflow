import { useRef, useState } from "react";
import example from "../../data/example-copilot-marking.json";
import type { Flow, RuleSet } from "../engine/types";
import { APP_NAME } from "./brand";
import { emptySentence, exampleSentence, flowFromSentence, sentenceChoices, sentenceComplete, type Sentence } from "./flowOps";
import { nameWarning } from "./names";
import { Glossed } from "./plain";
import { flowFromScan, isScanReport } from "./scanImport";
import { ScanPage } from "./ScanPage";

type Route = null | "new" | "existing" | "tier" | "scan";

interface Props {
  set: RuleSet;
  /** "questions" goes to the Q&A first; "canvas" opens straight onto the canvas. */
  onOpen(flow: Flow, to: "questions" | "canvas"): void;
}

/** One question, three answers, then one sentence. Everything else is a small link. */
export function FrontDoor({ set, onOpen }: Props) {
  const [route, setRoute] = useState<Route>(null);
  const [tier, setTier] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  /** A saved flow opens on the canvas; a scanner report becomes a flow and goes to the Q&A, since code can't answer everything. */
  const upload = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text()) as unknown;
      if (isScanReport(parsed)) {
        onOpen(flowFromScan(parsed, set), "questions");
        return;
      }
      const flow = parsed as Flow;
      if (!Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) throw new Error("not a flow");
      onOpen(flow, "canvas");
    } catch {
      setError("That file isn't something saved from here, or a scanner report.");
    }
  };

  const pick = (r: Route) => { setRoute(r); if (r !== "tier") setTier(null); };
  const showSentence = route === "new" || route === "existing" || (route === "tier" && tier != null);

  return (
    <div className="page">
      <div className="inner">
        <p className="lab">{APP_NAME}</p>
        <h1 style={{ fontSize: 40 }}>Want to use a tool with people's data?</h1>
        <p className="lede">Describe the idea in one sentence, answer a few plain questions, and {APP_NAME} will tell you whether it's allowed, what it needs, and the one change that would make it easier.</p>

        <p className="lab" style={{ marginTop: 28 }}>What are you checking?</p>
        <div className="door">
          <button type="button" className={route === "new" ? "on" : ""} onClick={() => pick("new")}>
            <strong>A new idea</strong>
            <span>Something you'd like to start doing.</span>
          </button>
          <button type="button" className={route === "existing" ? "on" : ""} onClick={() => pick("existing")}>
            <strong>Something we already use</strong>
            <span>A tool that's been running a while.</span>
          </button>
          <button type="button" className={route === "tier" ? "on" : ""} onClick={() => pick("tier")}>
            <strong>How sensitive data can be used</strong>
            <span>Pick a level and see what's allowed there.</span>
          </button>
          <button type="button" className={route === "scan" ? "on" : ""} onClick={() => pick("scan")}>
            <strong>An app we've built</strong>
            <span>Scan its code right here, then see it as a picture.</span>
          </button>
        </div>

        {error && <div className="box alert">{error}</div>}

        {route === "tier" && <TierPicker set={set} tier={tier} setTier={setTier} />}

        {route === "scan" && <ScanPage set={set} onOpen={onOpen} onOpenFile={() => file.current?.click()} />}

        {showSentence && (
          <SentenceBuilder key={`${route}${tier}`} set={set} retrospective={route === "existing"} tier={route === "tier" ? tier : null} onBuild={(f) => onOpen(f, "questions")} />
        )}

        <p className="links">
          <button type="button" className="linkish" onClick={() => onOpen(structuredClone(example) as unknown as Flow, "canvas")}>See a finished example</button>
          <span className="mu"> · </span>
          <button type="button" className="linkish" onClick={() => file.current?.click()}>Open something you saved</button>
        </p>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
    </div>
  );
}

/** The tier system, explained with examples and what each tier lets you use. */
function TierPicker({ set, tier, setTier }: { set: RuleSet; tier: number | null; setTier(t: number): void }) {
  const tools = (t: number) => {
    const s = set.rules.sanctioned;
    const named = Object.entries(s.list)
      .filter(([, v]) => v.max_tier >= t)
      .map(([id]) => set.products.companies[id]?.name ?? set.products.products[id]?.name ?? id);
    if (t === 0) return "Any tool.";
    if (t === 3) return "None outside the organisation.";
    return [...named, ...(s.unlisted_max_tier >= t ? ["any other company with a signed DPA"] : [])].join(", ") + ".";
  };
  return (
    <div style={{ marginBottom: 26 }}>
      <p className="lab">How sensitive is the most sensitive data you'd use?</p>
      <div className="tiers">
        {[0, 1, 2, 3].map((t) => {
          const x = set.rules.tiers[String(t)];
          return (
            <button key={t} type="button" className={`tiercard${tier === t ? " on" : ""}`} onClick={() => setTier(t)}>
              <span className="num">Level {t}</span>
              <strong>{x.label}</strong>
              <span>{x.plain}</span>
              <span className="mu">For example: {x.examples}</span>
              <span><Glossed text={x.can} /></span>
              <span className="mono" style={{ fontSize: 12 }}>Tools: {tools(t)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const OTHER = "__other__";
// "Somewhere else" in products.json custom_app_hosting uses the same id.

/** A dropdown that reads as a word in a sentence. "Something else..." reveals a box to type in. */
function Slot({ value, kind, options, placeholder, onPick, onType, label }: {
  value: string;
  kind: string | null;
  options: { id: string; label: string }[];
  placeholder: string;
  label: string;
  onPick(id: string, label: string): void;
  onType(text: string): void;
}) {
  const other = kind === OTHER;
  const warn = other ? nameWarning(value) : null;
  return (
    <span className="slot">
      <select
        aria-label={label}
        value={other ? OTHER : kind ?? ""}
        className={kind ? "" : "empty"}
        onChange={(e) => {
          const id = e.target.value;
          if (id === OTHER) onPick(OTHER, "");
          else onPick(id, options.find((o) => o.id === id)?.label ?? "");
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        <option value={OTHER}>{sentenceChoices.other_label}</option>
      </select>
      {other && <input autoFocus value={value} placeholder="type it here" aria-label={`${label}, typed`} onChange={(e) => onType(e.target.value)} />}
      {warn && <span className="warn" role="alert">{warn}</span>}
    </span>
  );
}

function SentenceBuilder({ set, retrospective, tier, onBuild }: { set: RuleSet; retrospective: boolean; tier: number | null; onBuild(f: Flow): void }) {
  const [s, setS] = useState<Sentence>(emptySentence);
  const [since, setSince] = useState("");
  const [hosting, setHosting] = useState<string>("");
  const up = (p: Partial<Sentence>) => setS({ ...s, ...p });
  const building = s.product === "custom_app";
  const roles = sentenceChoices.roles.map((r) => ({ id: r, label: r }));
  const hostingIds = new Set(set.products.custom_app_hosting.options.map(([id]) => id));
  const products = Object.entries(set.products.products)
    .filter(([id]) => !hostingIds.has(id) || id === "lovable_app" || id === "replit_app" || id === "base44_app")
    .filter(([id]) => id !== "custom_app_m365")
    .map(([id, p]) => ({ id, label: p.name }));

  const tooHigh = (productId: string) => {
    if (tier == null || tier === 0) return false;
    const company = set.products.products[productId]?.company;
    if (!company) return false;
    const list = set.rules.sanctioned.list;
    const max = list[company]?.max_tier ?? list[productId]?.max_tier ?? set.rules.sanctioned.unlisted_max_tier;
    return max < tier;
  };
  const productOptions = products.map((p) => (tooHigh(p.id) ? { ...p, label: `${p.label} (not at level ${tier})` } : p));
  const roleKind = s.role ? (roles.some((r) => r.id === s.role) ? s.role : OTHER) : null;
  const toolKind = s.product ? s.product : s.otherTool ? OTHER : null;
  const ready = sentenceComplete(s) && !(s.product && tooHigh(s.product)) && (!building || (hosting && (hosting !== OTHER || s.otherTool?.name.trim())));

  const go = () => {
    // An app being built: where it runs is the tool that matters, so the hosting choice becomes the product.
    const resolved: Sentence = building ? (hosting === OTHER ? { ...s, product: null } : { ...s, product: hosting, otherTool: null }) : s;
    const flow = flowFromSentence(resolved, set, retrospective, tier);
    if (building) {
      const app = flow.nodes.find((n) => n.type === "system");
      if (app) app.title = "Our app";
    }
    if (retrospective) flow.dates = { ...flow.dates, running_since: since || null };
    onBuild(flow);
  };

  return (
    <div className="panel sentence-panel">
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <p className="lab">Say it in one sentence</p>
        <span className="spacer" />
        <button type="button" className="linkish" onClick={() => setS(exampleSentence())}>Fill in an example</button>
      </div>
      <div className="sentence">
        A{" "}
        <Slot label="Who does it" value={s.role} kind={roleKind} options={roles} placeholder="who?" onPick={(id, label) => up({ role: id === OTHER ? "" : label })} onType={(t) => up({ role: t })} />
        {retrospective ? " has been putting " : " wants to put "}
        {s.data.map((d, i) => (
          <span key={i} className="slotgroup">
            {i > 0 && " and "}
            <Slot
              label={`Which data${i ? ` (${i + 1})` : ""}`}
              value={d.label}
              kind={d.kind}
              options={sentenceChoices.data}
              placeholder="which data?"
              onPick={(id, label) => up({ data: s.data.map((x, j) => (j === i ? { kind: id, label } : x)) })}
              onType={(t) => up({ data: s.data.map((x, j) => (j === i ? { ...x, label: t } : x)) })}
            />
            {i > 0 && <button type="button" className="remove" aria-label="Remove this data" onClick={() => up({ data: s.data.filter((_, j) => j !== i) })}>×</button>}
          </span>
        ))}
        {s.data.length < 4 && s.data[s.data.length - 1].label && (
          <button type="button" className="linkish add" onClick={() => up({ data: [...s.data, { kind: null, label: "" }] })}>+ and more</button>
        )}
        {" "}about{" "}
        <Slot
          label="About whom"
          value={s.about.label}
          kind={s.about.kind}
          options={sentenceChoices.about}
          placeholder="whom?"
          onPick={(id, label) => {
            const a = sentenceChoices.about.find((x) => x.id === id);
            up({ about: { kind: id, label }, under18: (a?.age_mix as Sentence["under18"]) ?? s.under18 });
          }}
          onType={(t) => up({ about: { kind: OTHER, label: t } })}
        />
        {" "}into{" "}
        <Slot
          label="Which tool"
          value={s.otherTool?.name ?? ""}
          kind={toolKind}
          options={productOptions}
          placeholder="which tool?"
          onPick={(id) => (id === OTHER ? up({ product: null, otherTool: { name: "", ai: false } }) : up({ product: id, otherTool: null }))}
          onType={(t) => up({ otherTool: { name: t, ai: s.otherTool?.ai ?? false } })}
        />
        {" "}to{" "}
        <Slot
          label="What for"
          value={s.purpose.label}
          kind={s.purpose.kind}
          options={sentenceChoices.purposes}
          placeholder="do what?"
          onPick={(id, label) => up({ purpose: { kind: id, label } })}
          onType={(t) => up({ purpose: { kind: OTHER, label: t } })}
        />
        .
      </div>

      {building && (
        <div className="field" style={{ marginTop: 16 }}>
          <span>Where will it run?</span>
          <select value={hosting} onChange={(e) => { setHosting(e.target.value); if (e.target.value === OTHER) up({ otherTool: { name: "", ai: false } }); else up({ otherTool: null }); }}>
            <option value="" disabled>Choose where it's hosted…</option>
            {set.products.custom_app_hosting.options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          {hosting === OTHER && <input value={s.otherTool?.name ?? ""} placeholder="Who hosts it?" aria-label="Who hosts it" onChange={(e) => up({ otherTool: { name: e.target.value, ai: s.otherTool?.ai ?? false } })} />}
          <span className="mu" style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--sans)", fontWeight: 400, fontSize: 12 }}>
            Building is cheap now; running is what matters. Who hosts it decides who holds the data, under which contract, and which level it may take.
          </span>
        </div>
      )}

      <div className="sentence-extras">
        {s.otherTool && !building && (
          <label className="field">
            <span>Does that tool use AI?</span>
            <div className="seg sm">
              <button type="button" className={!s.otherTool.ai ? "on" : ""} onClick={() => up({ otherTool: { ...s.otherTool!, ai: false } })}>No</button>
              <button type="button" className={s.otherTool.ai ? "on" : ""} onClick={() => up({ otherTool: { ...s.otherTool!, ai: true } })}>Yes</button>
            </div>
          </label>
        )}
        {s.about.label && (
          <label className="field">
            <span>Any of them under 18?</span>
            <div className="seg sm">
              {([["all_adults", "No"], ["some_under_18", "Some"], ["all_under_18", "All"]] as const).map(([v, l]) => (
                <button key={v} type="button" className={s.under18 === v ? "on" : ""} onClick={() => up({ under18: v })}>{l}</button>
              ))}
            </div>
          </label>
        )}
        {retrospective && (
          <label className="field">
            <span>Running since</span>
            <input type="month" value={since} onChange={(e) => setSince(e.target.value)} />
          </label>
        )}
        <span className="spacer" />
        <button type="button" className="btn dk" style={{ boxShadow: "4px 4px 0 var(--data)" }} onClick={go} disabled={!ready}>
          Next
        </button>
      </div>
      <p className="mu" style={{ marginTop: 12, fontSize: 13 }}>
        {s.product && tooHigh(s.product) ? `That tool isn't approved for level ${tier}. Pick another, or a lower level.` : "Roles and groups, never people's names. Next: a few quick questions, then we draw it."}
      </p>
    </div>
  );
}
