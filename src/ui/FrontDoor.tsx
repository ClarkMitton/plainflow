import { useRef, useState } from "react";
import example from "../../data/example-copilot-marking.json";
import type { Flow, RuleSet } from "../engine/types";
import { APP_NAME } from "./brand";
import { GROUP_LABEL } from "./context";
import { flowFromSentence, type Sentence } from "./flowOps";
import { nameWarning } from "./names";
import { Glossed, Term } from "./plain";

type Route = null | "new" | "existing" | "tier";

interface Props {
  set: RuleSet;
  /** "questions" goes to the Q&A first; "canvas" opens straight onto the canvas. */
  onOpen(flow: Flow, to: "questions" | "canvas"): void;
}

export function FrontDoor({ set, onOpen }: Props) {
  const [route, setRoute] = useState<Route>(null);
  const [tier, setTier] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const upload = async (f: File) => {
    try {
      const flow = JSON.parse(await f.text()) as Flow;
      if (!Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) throw new Error("not a flow");
      onOpen(flow, "canvas");
    } catch {
      setError("That file isn't a saved flow.");
    }
  };

  const pick = (r: Route) => { setRoute(r); if (r !== "tier") setTier(null); };

  return (
    <div className="page">
      <div className="inner">
        <p className="lab">{APP_NAME}</p>
        <h1 style={{ fontSize: 44 }}>Got an idea that uses people's data?<br />Let's see what it needs.</h1>
        <p className="lede">
          Answer a few plain questions. {APP_NAME} draws your idea as a picture, tells you whether policy allows it and what you need to do, and shows the one change that would make it easier. No legal knowledge needed.
        </p>

        <div className="door">
          <button type="button" onClick={() => pick("new")} style={route === "new" ? { boxShadow: "6px 6px 0 var(--data)" } : undefined}>
            <strong>I've got an idea</strong>
            <span>Something you'd like to start doing. Check it before it begins.</span>
          </button>
          <button type="button" onClick={() => pick("existing")} style={route === "existing" ? { boxShadow: "6px 6px 0 var(--data)" } : undefined}>
            <strong>Check something we already use</strong>
            <span>A tool that's been running a while. It's never too late to check.</span>
          </button>
          <button type="button" onClick={() => pick("tier")} style={route === "tier" ? { boxShadow: "6px 6px 0 var(--data)" } : undefined}>
            <strong>Start from the data tier</strong>
            <span>You know how sensitive the data is. See what's allowed at that level, then build inside it.</span>
          </button>
        </div>
        {error && <div className="box alert">{error}</div>}

        {route === "tier" && <TierPicker set={set} tier={tier} setTier={setTier} />}

        {(route === "new" || route === "existing" || (route === "tier" && tier != null)) && (
          <SentenceBuilder key={`${route}${tier}`} set={set} retrospective={route === "existing"} tier={route === "tier" ? tier : null} onBuild={(f) => onOpen(f, "questions")} />
        )}

        <p style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={() => onOpen(structuredClone(example) as unknown as Flow, "canvas")}>Open the worked example: Copilot marking</button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>Open a saved flow</button>
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
      <p className="lab">Which is the most sensitive data your idea uses? (<Term t="tier" />)</p>
      <div className="tiers">
        {[0, 1, 2, 3].map((t) => {
          const x = set.rules.tiers[String(t)];
          return (
            <button key={t} type="button" className={`tiercard${tier === t ? " on" : ""}`} onClick={() => setTier(t)}>
              <span className="num">Tier {t}</span>
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

function SentenceBuilder({ set, retrospective, tier, onBuild }: { set: RuleSet; retrospective: boolean; tier: number | null; onBuild(f: Flow): void }) {
  const [s, setS] = useState<Sentence>({
    role: "Teacher",
    data: ["student work"],
    about: "Students",
    aboutGroup: "learners",
    under18: "some_under_18",
    product: "m365_copilot",
    purpose: "suggest a mark",
  });
  const [since, setSince] = useState("");
  const up = (p: Partial<Sentence>) => setS({ ...s, ...p });
  const warnings = [s.role, s.about, s.purpose, ...s.data].map(nameWarning).filter(Boolean);

  const tooHigh = (productId: string) => {
    if (tier == null) return false;
    const company = set.products.products[productId]?.company;
    if (!company) return false;
    const list = set.rules.sanctioned.list;
    const max = list[company]?.max_tier ?? list[productId]?.max_tier ?? set.rules.sanctioned.unlisted_max_tier;
    return max < tier && tier > 0;
  };

  const go = () => {
    const flow = flowFromSentence(s, set, retrospective, tier);
    if (retrospective) flow.dates = { ...flow.dates, running_since: since || null };
    onBuild(flow);
  };

  return (
    <div className="panel" style={{ padding: 24, boxShadow: "6px 6px 0 var(--ink)" }}>
      <p className="lab" style={{ marginBottom: 8 }}>First, say it in one sentence</p>
      <div className="sentence">
        A <input value={s.role} onChange={(e) => up({ role: e.target.value })} size={10} aria-label="Who does it" />
        {retrospective ? " has been putting " : " wants to put "}
        {s.data.map((d, i) => (
          <span key={i}>
            {i > 0 && " and "}
            <input value={d} onChange={(e) => up({ data: s.data.map((x, j) => (j === i ? e.target.value : x)) })} size={12} aria-label="What data" />
          </span>
        ))}
        <button type="button" className="btn sm" onClick={() => up({ data: [...s.data, ""] })} style={{ verticalAlign: "middle", marginRight: 6 }}>and ___</button>
        about{" "}
        <input value={s.about} onChange={(e) => up({ about: e.target.value })} size={9} aria-label="About whom" />
        into{" "}
        <select value={s.product} onChange={(e) => up({ product: e.target.value })} aria-label="Which tool">
          {Object.entries(set.products.products).map(([id, p]) => (
            <option key={id} value={id} disabled={tooHigh(id)}>{p.name}{tooHigh(id) ? ` (not at Tier ${tier})` : ""}</option>
          ))}
        </select>{" "}
        to <input value={s.purpose} onChange={(e) => up({ purpose: e.target.value })} size={14} aria-label="What for" />.
      </div>

      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginTop: 18, alignItems: "flex-end" }}>
        <label className="field">
          <span>Any of them under 18?</span>
          <div className="seg sm">
            {([["all_adults", "No"], ["some_under_18", "Some"], ["all_under_18", "All"]] as const).map(([v, l]) => (
              <button key={v} type="button" className={s.under18 === v ? "on" : ""} onClick={() => up({ under18: v })}>{l}</button>
            ))}
          </div>
        </label>
        <label className="field">
          <span>They are</span>
          <select value={s.aboutGroup} onChange={(e) => up({ aboutGroup: e.target.value })}>
            {Object.entries(GROUP_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {retrospective && (
          <label className="field">
            <span>Running since</span>
            <input type="month" value={since} onChange={(e) => setSince(e.target.value)} />
          </label>
        )}
        <span className="spacer" />
        <button type="button" className="btn dk" style={{ boxShadow: "4px 4px 0 var(--data)" }} onClick={go} disabled={tooHigh(s.product)}>Next: a few questions</button>
      </div>
      {warnings.length > 0 && <div className="warn" style={{ marginTop: 10 }}>{warnings[0]}</div>}
      <p className="mu" style={{ marginTop: 14, fontSize: 13 }}>Use roles and groups, never people's names. Then about a dozen yes or no questions, and we draw it.</p>
    </div>
  );
}
