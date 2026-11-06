// People coming to a contractor for help, run through Plainflow end to end: the sentence, the questions it
// would ask, and the answer. Each prints what the person would be told, and asserts the parts that must hold.
import { describe, expect, it } from "vitest";
import { applyLever, derive } from "../engine/derive";
import { ruleSet } from "../engine/ruleset";
import type { Derivation, Flow } from "../engine/types";
import { flowFromSentence, type Sentence } from "./flowOps";
import { policyAnswer } from "./plain";
import { apply, isDecisive, stepsFor } from "./questions";

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

describe("people a contractor meets", () => {
  it("the LinkedIn poster: a teamwear SME wants ChatGPT for sales messages, on personal logins", () => {
    const flow = answer(build({ role: "Sales manager", product: "chatgpt" }), { plan: "Free or personal accounts", lawful_basis: "It's in our legitimate interests", told: "Yes, it's in our privacy notice" });
    const d = derive(flow, ruleSet);
    tell("LinkedIn poster, free ChatGPT", flow, d);
    expect(d.highest_tier).toBe(1);
    expect(d.verdict.id).toBe("stop"); // free ChatGPT trains on what you type: a hard line, not just policy
    expect(d.blocked[0].message).toContain("free or personal accounts");
    expect(d.cheapest_change).toMatchObject({ lever: "plan", to: "business" });

    const paid = applyLever(flow, flow.nodes.find((n) => n.type === "system")!.id, "plan", "business");
    const d2 = derive(paid, ruleSet);
    tell("LinkedIn poster, ChatGPT Business", paid, d2);
    expect(d2.blocked).toEqual([]);
    expect(d2.verdict.id).not.toBe("not_like_this");
    expect(d2.requirements.some((r) => r.id === "dpa_card" && r.status === "to_do")).toBe(true);
  });

  it("same SME: design briefs with nothing personal in Claude, free accounts", () => {
    const flow = build({ role: "Designer", data: [{ kind: null, label: "design briefs and product copy" }], about: { kind: null, label: "nobody in particular" }, product: "claude", purpose: choices.purpose("plan", "draft kit designs") });
    const answered = answer(flow, { names: "No way to tell who", plan: "Free or personal accounts" });
    const d = derive(answered, ruleSet);
    tell("Designer, Claude free, nothing personal", answered, d);
    expect(d.highest_tier).toBe(0);
    expect(d.outcome).toBe("not_required");
    expect(["go", "go_once"]).toContain(d.verdict.id);
  });

  it("HR wants staff appraisals in ChatGPT Business", () => {
    const flow = answer(build({ role: "HR", data: [choices.data("notes")], about: choices.about("staff"), product: "chatgpt", purpose: choices.purpose("reports", "write appraisal summaries") }), { plan: "A paid business plan" });
    const d = derive(flow, ruleSet);
    tell("HR, appraisals, ChatGPT Business", flow, d);
    expect(d.highest_tier).toBe(2);
    expect(d.verdict.id).toBe("not_like_this");
    expect(d.bright_lines).toEqual([]); // the business plan doesn't train, so no hard line
    // Honest: no single flip makes Tier 2 fit a Tier 1 route; the ways out are to send less or use Microsoft.
    expect(d.blocked[0].ways_out.join(" ")).toMatch(/sanctioned route/);
  });

  it("wants to build: an order tracker on Lovable", () => {
    const base = build({ role: "Office manager", data: [choices.data("contact")], product: "lovable_app", purpose: choices.purpose("reports", "track orders") });
    const free = answer(base, { plan: "Free or personal accounts" });
    const dFree = derive(free, ruleSet);
    tell("Builder, Lovable free", free, dFree);
    expect(dFree.verdict.id).toBe("stop"); // free Lovable trains on the build by default
    expect(dFree.cheapest_change?.lever).toBe("plan");

    const paid = answer(base, { plan: "A paid business plan" });
    const dPaid = derive(paid, ruleSet);
    tell("Builder, Lovable Business", paid, dPaid);
    expect(dPaid.blocked).toEqual([]);
    expect(dPaid.requirements.map((r) => r.id)).toContain("dpa_card");
  });

  it("wants to build the same thing, but with order notes about named customers, in our Microsoft tenant", () => {
    const flow = build({ role: "Office manager", data: [choices.data("notes")], product: "custom_app_m365", purpose: choices.purpose("reports", "track orders") });
    const d = derive(flow, ruleSet);
    tell("Builder, our Microsoft tenant, Tier 2 notes", flow, d);
    expect(d.highest_tier).toBe(2);
    expect(d.blocked).toEqual([]);
  });

  it("already built: a booking app on Base44 that collects health details", () => {
    const flow = answer(build({ role: "Clinic manager", data: [choices.data("sensitive")], about: choices.about("patients"), product: "base44_app", purpose: choices.purpose("reports", "manage bookings") }, true), { plan: "A paid business plan" });
    const d = derive(flow, ruleSet);
    tell("Already built, Base44, health data", flow, d);
    expect(d.highest_tier).toBe(3);
    expect(["stop", "not_like_this"]).toContain(d.verdict.id); // Tier 3 can't leave, and Base44's business plan trains
    expect(d.notes.length).toBe(1); // it's already running, so the check is late
  });

  it("introduce AI: a teacher wants Copilot to suggest marks (the worked example, by sentence)", () => {
    const flow = build({ role: "Teacher", data: [choices.data("work")], about: choices.about("students"), under18: "some_under_18", product: "m365_copilot", purpose: choices.purpose("mark", "suggest a mark") });
    const d = derive(flow, ruleSet);
    tell("Teacher, Copilot marking", flow, d);
    expect(d.verdict.id).toBe("needs_owner");
    expect(d.outcome).toBe("required");
  });

  it("marketing wants customer photos in Canva", () => {
    const flow = build({ role: "Marketing", data: [choices.data("media")], product: "canva", purpose: choices.purpose("messages", "make social posts") });
    const d = derive(flow, ruleSet);
    tell("Marketing, customer photos, Canva", flow, d);
    expect(d.highest_tier).toBe(2);
    expect(d.verdict.id).toBe("not_like_this");
  });

  it("someone keen on Grok Business for customer emails", () => {
    const flow = answer(build({ role: "Sales manager", product: "grok" }), { plan: "A paid business plan" });
    const d = derive(flow, ruleSet);
    tell("Grok Business, customer emails", flow, d);
    expect(d.verdict.id).toBe("not_like_this");
    expect(d.cheapest_change?.lever === "plan" && d.cheapest_change.to === "business").toBe(false);
  });

  it("a charity sharing parents' details with a partner by spreadsheet", () => {
    const flow = build({ role: "Volunteer coordinator", data: [choices.data("contact")], about: choices.about("parents"), product: "spreadsheet_email", purpose: choices.purpose("share", "share it with a partner organisation") });
    const d = derive(flow, ruleSet);
    tell("Charity, spreadsheet to a partner", flow, d);
    // A partner is a company outside, a joint controller: a sharing agreement, not a processor contract, and no "route" ceiling.
    const partner = flow.nodes.find((n) => n.type === "company")!;
    expect(partner.levers.role).toBe("joint_controller");
    expect(d.blocked).toEqual([]);
    expect(d.requirements.some((r) => r.id === "dsa_outline" && r.status === "to_do")).toBe(true);
  });
});
