// Five more people, after the first five: a SENCO, HR, a sixth form, a charity and a teacher with nothing personal.
// Same harness as personas.test.ts: the sentence, the answers they'd give, and what they'd be told.
import { describe, expect, it } from "vitest";
import { derive } from "../engine/derive";
import { ruleSet } from "../engine/ruleset";
import type { Derivation, Flow } from "../engine/types";
import { flowFromSentence, type Sentence } from "./flowOps";
import { policyAnswer, stillNo } from "./plain";
import { apply, isDecisive, stepsFor } from "./questions";
import { lighterRoutes } from "./lighter";
import { buildPack } from "./packBuild";

const choices = {
  data: (id: string) => ({ kind: id, label: id }),
  about: (id: string) => ({ kind: id, label: id }),
  purpose: (id: string, label = id) => ({ kind: id, label }),
};

function build(s: Partial<Sentence> & { product: string | null; otherTool?: Sentence["otherTool"] }, retrospective = false): Flow {
  const sentence: Sentence = {
    role: "Manager",
    data: [choices.data("contact")],
    about: choices.about("customers"),
    under18: "all_adults",
    otherTool: null,
    purpose: choices.purpose("messages", "send messages"),
    ...s,
  };
  return flowFromSentence(sentence, ruleSet, retrospective);
}

/** Answer the Q&A as the persona would: a map of question id to answer label; anything else keeps the guess. */
function answer(flow: Flow, answers: Record<string, string>): Flow {
  let f = flow;
  for (let pass = 0; pass < 3; pass++) {
    const d = derive(f, ruleSet, { cheapest: false });
    for (const step of stepsFor(f, d)) {
      const label = answers[step.q.id];
      if (!label) continue;
      if (step.q.type === "checklist") {
        const ticked = step.items.map((it) => label.split("|").includes(it.label));
        f = step.items.reduce((acc, it, i) => apply(acc, step.node?.id ?? null, ticked[i] ? it.on : it.off), f);
      } else {
        const a = step.q.answers?.find((x) => x.label === label);
        if (a) f = apply(f, step.node?.id ?? null, a);
      }
    }
  }
  return f;
}

function tell(name: string, flow: Flow, d: Derivation) {
  const asked = stepsFor(flow, d).filter((s) => isDecisive(s, flow, ruleSet, d)).map((s) => s.q.id);
  const policy = policyAnswer(flow, d, ruleSet);
  const lines = [
    `\n=== ${name}`,
    `story: ${flow.story}`,
    `questions it would ask (${asked.length}): ${asked.join(", ")}`,
    `can I do it: ${d.verdict.label}`,
    `data: Tier ${d.highest_tier} | policy: ${policy.ok ? "allows it" : "no"} | DPIA: ${d.outcome} | to do: ${d.open_count}`,
    ...policy.lines.map((l) => `  policy: ${l.text}${l.ways.length ? " ways out: " + l.ways.join(" / ") : ""}`),
    ...d.bright_lines.map((b) => `  hard line: ${b.title}`),
    `  to do: ${d.requirements.filter((r) => r.rail && r.status === "to_do").map((r) => r.short).join(", ") || "nothing"}`,
    `  make it easier: ${d.cheapest_change ? `${d.cheapest_change.node_title} ${d.cheapest_change.lever} -> ${String(d.cheapest_change.to)} (${d.cheapest_change.unblocks ? "clears the block" : `lifts ${d.cheapest_change.removes.length}`})` : "nothing"}`,
  ];
  console.log(lines.join("\n"));
  return { asked, policy };
}

describe("five more people", () => {
  it("F. a primary SENCO drafting EHCP paperwork in free ChatGPT: no, and Copilot in the tenant is the way", () => {
    const flow = answer(
      build({ role: "SENCO", data: [{ kind: "sensitive", label: "health, SEND or safeguarding information" }, { kind: "notes", label: "feedback or support notes" }], about: { kind: "pupils_primary", label: "primary pupils (under 13)" }, under18: "under_13", product: "chatgpt", purpose: { kind: null, label: "draft EHCP paperwork" } }),
      { lawful_basis: "It is part of our public task", plan: "Free or personal accounts", told: "No, or not sure" },
    );
    const d = derive(flow, ruleSet);
    tell("F. SENCO, EHCP paperwork, free ChatGPT", flow, d);
    expect(d.verdict.id).toBe("stop");
    expect(d.highest_tier).toBe(3);
    expect(d.bright_lines.map((b) => b.id)).toEqual(["trains_on_data"]);
    expect(d.blocked[0].message).toMatch(/limit is Level 0/);
    expect(d.requirements.find((r) => r.id === "art9_condition")?.status).toBe("to_do");
    const copilot = lighterRoutes(flow, d, ruleSet).find((r) => r.feature.id === "copilot_chat")!;
    expect(copilot.ours.verdictId).toBe("needs_owner");
    expect(copilot.ours.blocked).toBe(0);
    expect(stillNo(copilot)).toBeNull();
  });

  it("G. HR looking for sickness absence patterns in Power BI: yes with sign-off, plus the Article 9 condition", () => {
    const flow = answer(
      build({ role: "HR", data: [{ kind: "sensitive", label: "health, SEND or safeguarding information" }, { kind: "attendance", label: "attendance records" }], about: { kind: "staff", label: "staff" }, under18: "all_adults", product: "power_platform", purpose: { kind: null, label: "spot absence patterns" } }),
      { lawful_basis: "Our legitimate interests", told: "Yes, it is in our privacy notice", purpose_facts: "It covers a whole cohort, or more than a thousand people|It runs continuously rather than once" },
    );
    const d = derive(flow, ruleSet);
    tell("G. HR, sickness patterns, Power BI", flow, d);
    expect(d.verdict.id).toBe("needs_owner");
    expect(d.highest_tier).toBe(3);
    expect(d.blocked).toEqual([]);
    expect(policyAnswer(flow, d, ruleSet).ok).toBe(true);
    const ids = d.requirements.filter((r) => r.status === "to_do").map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["art9_condition", "lawful_basis", "full_dpia"]));
    expect(ids).not.toContain("level3_ai_signoff");
  });

  it("H. a sixth form display in Canva: photos are Level 2 for the right reason, and consent holds when saying no costs nothing", () => {
    const sentence = { role: "Head of department", data: [{ kind: "media", label: "photos or video" }], about: { kind: "students", label: "students (16 plus)" }, under18: "some_under_18" as const, product: "canva", purpose: { kind: null, label: "make an open evening display" } };
    const coerced = answer(build(sentence), { lawful_basis: "Consent, but refusing is not a realistic option", told: "Yes, it is in our privacy notice" });
    const free = answer(build(sentence), { lawful_basis: "Consent, and they can refuse with no consequences", told: "Yes, it is in our privacy notice" });
    const dc = derive(coerced, ruleSet);
    const df = derive(free, ruleSet);
    tell("H. Sixth form display in Canva, consent they can't refuse", coerced, dc);
    tell("H. Sixth form display in Canva, consent they can refuse", free, df);
    expect(dc.bright_lines.map((b) => b.id)).toEqual(["consent_imbalance"]);
    expect(df.bright_lines).toEqual([]);
    expect(df.highest_tier).toBe(2);
    expect(df.tier_because[free.nodes.find((n) => n.type === "data")!.id]).toBe("it holds more than account basics about a named person");
    expect(df.blocked[0].message).toMatch(/Canva is allowed up to Level 1/);
    expect(df.cheapest_change?.to).not.toBe("anonymised");
  });

  it("I. a charity emailing a volunteer list with DBS status to a partner: a sharing agreement that covers Level 3", () => {
    const flow = answer(
      build({ role: "Manager", data: [{ kind: "contact", label: "names and contact details" }, { kind: "criminal", label: "DBS or criminal record information" }], about: { kind: null, label: "volunteers" }, under18: "all_adults", product: "spreadsheet_email", purpose: choices.purpose("share", "share it with a partner organisation") }),
      { lawful_basis: "Our legitimate interests", told: "No, or not sure" },
    );
    const d = derive(flow, ruleSet);
    tell("I. Charity, volunteer list with DBS status, emailed to a partner", flow, d);
    expect(flow.story).toBe("A manager puts names and contact details and DBS or criminal record information about volunteers into a spreadsheet sent by email, to share it with a partner organisation.");
    expect(d.highest_tier).toBe(3);
    expect(d.verdict.id).toBe("needs_owner");
    expect(d.blocked).toEqual([]);
    const policy = policyAnswer(flow, d, ruleSet);
    expect(policy.lines[0].text).toMatch(/If Level 3 data is shared, the agreement has to say so/);
    const ids = d.requirements.filter((r) => r.status === "to_do").map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["art9_condition", "dsa_outline"]));
  });

  it("J. a teacher making lesson plans in free Gemini: nothing personal, so yes", () => {
    const flow = answer(
      build({ role: "Teacher", data: [{ kind: null, label: "lesson plans" }], about: { kind: null, label: "nobody in particular" }, under18: "all_adults", product: "gemini_consumer", purpose: choices.purpose("plan", "plan lessons") }),
      { names: "No, nobody can be identified", plan: "Free or personal accounts" },
    );
    const d = derive(flow, ruleSet);
    tell("J. Teacher, lesson plans, free Gemini", flow, d);
    expect(d.highest_tier).toBe(0);
    expect(d.outcome).toBe("not_required");
    expect(d.verdict.id).toBe("go_once");
    expect(d.open_count).toBe(1);
  });
});

describe("why each level", () => {
  it("every level carries evidence that resolves, and the pack prints the note for the levels in use", () => {
    for (const [t, x] of Object.entries(ruleSet.rules.tiers)) {
      expect(x.basis, `Level ${t} has a basis`).toBeTruthy();
      for (const id of x.basis!.law) expect(ruleSet.laws[id], `law ${id} on Level ${t}`).toBeTruthy();
      for (const id of x.basis!.guidance) expect(ruleSet.rules.sources[id], `source ${id} on Level ${t}`).toBeTruthy();
      expect(x.basis!.policy.length).toBeGreaterThan(20);
    }
    const flow = answer(
      build({ role: "HR", data: [{ kind: "sensitive", label: "health, SEND or safeguarding information" }, { kind: "attendance", label: "attendance records" }], about: { kind: "staff", label: "staff" }, under18: "all_adults", product: "power_platform", purpose: { kind: null, label: "spot absence patterns" } }),
      { lawful_basis: "Our legitimate interests", told: "Yes, it is in our privacy notice" },
    );
    const pack = buildPack(flow, derive(flow, ruleSet), ruleSet);
    expect(pack.forDpo.tierNotes.map((n) => n.tier)).toEqual([2, 3]);
    const three = pack.forDpo.tierNotes.find((n) => n.tier === 3)!;
    expect(three.laws.map((l) => l.id)).toContain("art9");
    expect(three.crosswalk).toBe("restricted");
  });
});
