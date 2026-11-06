// People coming to a contractor for help, run through Plainflow end to end: the sentence, the questions it
// would ask, and the answer. Each prints what the person would be told, and asserts the parts that must hold.
import { describe, expect, it } from "vitest";
import { applyLever, derive } from "../engine/derive";
import { ruleSet } from "../engine/ruleset";
import type { Derivation, Flow } from "../engine/types";
import { addNode, connect, flowFromSentence, subject, type Sentence } from "./flowOps";
import { buildPack } from "./packBuild";
import { groupLines, policyAnswer, stillNo } from "./plain";
import { apply, isDecisive, matches, stepsFor } from "./questions";
import { lighterRoutes, swapProduct } from "./lighter";

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
    const flow = answer(build({ role: "Sales manager", product: "chatgpt" }), { plan: "Free or personal accounts", lawful_basis: "Our legitimate interests", told: "Yes, it is in our privacy notice" });
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
    const answered = answer(flow, { names: "No, nobody can be identified", plan: "Free or personal accounts" });
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
    expect(d.blocked[0].ways_out.join(" ")).toMatch(/approved route/);
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

describe("whose policy, and the youngest pupils", () => {
  it("says when the ceiling is just the default for an unlisted company, and what would change it", () => {
    const flow = build({ role: "Marketing", product: null, otherTool: { name: "Mailshot Co", ai: false } });
    const d = derive(flow, ruleSet);
    const policy = policyAnswer(flow, d, ruleSet);
    expect(policy.unowned).toBe(true); // the seed rules table has no owner yet
    expect(policy.source).toMatch(/owner not set/);
    expect(policy.lines[0].text).toMatch(/is not on your approved list/);
    expect(policy.lines[0].text).toMatch(/If your policy approves Mailshot Co for Level 1/);
  });

  it("primary pupils can't be asked for consent themselves", () => {
    const flow = answer(build({ role: "Teacher", data: [choices.data("work")], about: { kind: "pupils_primary", label: "primary pupils" }, under18: "under_13", product: "m365_copilot", purpose: choices.purpose("feedback", "draft feedback") }), { lawful_basis: "Consent, but refusing is not a realistic option" });
    const d = derive(flow, ruleSet);
    tell("Primary school, consent, Copilot", flow, d);
    expect(d.bright_lines.map((b) => b.id)).toContain("consent_under_13");
  });
});

describe("the lighter route", () => {
  it("offers Copilot Chat instead of free ChatGPT, with less to do and nothing to sign", () => {
    const flow = answer(build({ role: "Sales manager", product: "chatgpt" }), { plan: "Free or personal accounts" });
    const d = derive(flow, ruleSet);
    const routes = lighterRoutes(flow, d, ruleSet);
    expect(routes.map((r) => r.feature.id)).toEqual(["copilot_chat", "copilot"]);
    const chat = routes[0];
    expect(chat.ours.blocked + chat.ours.hardLines).toBe(0);
    expect(chat.ours.toDo).toBeLessThan(chat.theirs.toDo);
    expect(chat.ours.cost).toMatch(/included/);
    expect(chat.lighter).toBe(true);
    // the swap removed OpenAI and brought Microsoft
    expect(chat.altFlow.nodes.some((n) => n.fields.company_id === "openai_consumer")).toBe(false);
    expect(chat.altFlow.nodes.some((n) => n.fields.company_id === "microsoft")).toBe(true);
  });

  it("knows the licence: full Copilot is an add-on, Copilot Chat is included", () => {
    const flow = { ...answer(build({ role: "Sales manager", product: "chatgpt" }), { plan: "A paid business plan" }), organisation: { name: "Kitlab", type: "small_business", m365_licence: "business_standard" } };
    const routes = lighterRoutes(flow, derive(flow, ruleSet), ruleSet);
    expect(routes[0].ours.cost).toBe("included in your Business Standard");
    expect(routes[1].ours.cost).toMatch(/£24 a seat/);
  });

  it("offers nothing lighter when they're already on Microsoft", () => {
    const flow = build({ role: "Teacher", product: "m365_copilot" });
    expect(lighterRoutes(flow, derive(flow, ruleSet), ruleSet)).toEqual([]);
  });

  it("finds a route for an unknown AI note-taker from what it's for", () => {
    const flow = build({ role: "Admin staff", data: [choices.data("recordings")], product: null, otherTool: { name: "Otter", ai: true }, purpose: choices.purpose("reports", "write reports") });
    const routes = lighterRoutes(flow, derive(flow, ruleSet), ruleSet);
    expect(routes.map((r) => r.feature.id)).toContain("teams_transcription");
    const swapped = swapProduct(flow, flow.nodes.find((n) => n.type === "system")!.id, "m365", ruleSet);
    expect(swapped.nodes.some((n) => n.title === "Otter")).toBe(false);
  });
});

describe("roleplay C: an AI note-taker in wellbeing meetings", () => {
  const sam = () =>
    answer(
      build({
        role: "Admin staff",
        data: [{ kind: "recordings", label: "meeting or lesson recordings" }, { kind: "sensitive", label: "health, SEND or safeguarding information" }],
        about: { kind: "students", label: "students (16 plus)" },
        under18: "some_under_18",
        product: null,
        otherTool: { name: "Otter", ai: true },
        purpose: choices.purpose("reports", "write reports"),
      }),
      {
        data_facts: "It could reveal health, SEND, religion, ethnicity, sexuality or criminal matters|It contains free text or recordings",
        lawful_basis: "Consent, but refusing is not a realistic option",
        told: "No, or not sure",
      },
    );

  it("reads as a sentence, with SEND still SEND", () => {
    expect(sam().story).toBe("Admin staff put meeting or lesson recordings and health, SEND or safeguarding information about students (16 plus) into Otter, to write reports.");
    expect(subject("Teacher")).toEqual({ text: "A teacher", plural: false });
    expect(subject("Exams officer").text).toBe("An exams officer");
    expect(subject("HR")).toEqual({ text: "HR", plural: false });
  });

  it("says no, puts policy up front in Levels, and names the same hard line once", () => {
    const flow = sam();
    const d = derive(flow, ruleSet);
    tell("Sam: Otter in wellbeing meetings", flow, d);
    expect(["stop", "not_like_this"]).toContain(d.verdict.id);
    expect(d.highest_tier).toBe(3);
    const policy = policyAnswer(flow, d, ruleSet);
    expect(policy.ok).toBe(false);
    expect(d.blocked.map((b) => b.message).join(" ")).toMatch(/Level 3 data only goes to a supplier your policy approves for it/);
    expect(d.blocked.map((b) => b.message).join(" ")).not.toMatch(/Tier/);
    const consent = groupLines(d.bright_lines, flow).filter((g) => g.b.id === d.bright_lines[0].id);
    expect(consent).toHaveLength(1);
    expect(consent[0].others).toEqual(["Health, SEND or safeguarding information"]);
  });

  it("guesses 'don't know' for whether an unknown note-taker trains on it", () => {
    const flow = sam();
    const otter = flow.nodes.find((n) => n.type === "company")!;
    expect(otter.levers.trains_on_inputs).toBeNull();
    const step = stepsFor(flow, derive(flow, ruleSet)).find((s) => s.q.id === "trains")!;
    const guess = (step.q.answers ?? []).find((a) => matches(flow, step.node, a));
    expect(guess?.label).toBe("Not known yet");
  });

  it("is honest that the Teams route is still a no for Level 3", () => {
    const flow = sam();
    const routes = lighterRoutes(flow, derive(flow, ruleSet), ruleSet);
    const teams = routes.find((r) => r.feature.id === "teams_transcription")!;
    expect(teams.ours.verdictId).not.toBe("go");
    expect(stillNo(teams)).toMatch(/^Still a no on its own/);
  });
});

describe("roleplay D: a dropout dashboard, then shared with the council", () => {
  const leah = () =>
    answer(
      build({
        role: "IT",
        data: [{ kind: "attendance", label: "attendance records" }],
        about: { kind: "students", label: "students (16 plus)" },
        under18: "some_under_18",
        product: "power_platform",
        purpose: choices.purpose("predict", "predict who might struggle"),
      }),
      {
        data_facts: "It describes how a person is doing|We already hold it, collected for a different purpose",
        names: "Yes, by name",
        lawful_basis: "It is part of our public task",
        purpose_facts: "It produces a mark, grade, score or prediction about a person|It covers a whole cohort, or more than a thousand people|It runs continuously rather than once|It tracks what individuals do, when or where",
        told: "No, or not sure",
      },
    );

  /** Leah adds the council from the canvas, names it, and makes it a joint controller fed by the purpose. */
  const withCouncil = () => {
    const flow = leah();
    const { flow: added, node } = addNode(flow, "company");
    const named: Flow = {
      ...added,
      nodes: added.nodes.map((n) =>
        n.id === node.id
          ? { ...n, title: "The council", levers: { ...n.levers, role: "joint_controller", decides_purpose: true }, fields: { ...n.fields, region: "UK", transfer_mechanism: "none_needed" } }
          : n,
      ),
    };
    return connect(named, named.nodes.find((n) => n.type === "purpose")!.id, node.id);
  };

  it("is a yes with sign-off and a full DPIA, not an ICO matter", () => {
    const flow = leah();
    const d = derive(flow, ruleSet);
    const { asked } = tell("Leah: the dropout dashboard", flow, d);
    expect(d.highest_tier).toBe(2);
    expect(d.outcome).toBe("required");
    expect(d.bright_lines).toEqual([]);
    expect(d.verdict.id).toBe("needs_owner");
    expect(asked).toContain("risk_owner");
    const yes = Object.values(d.screening).filter((s) => s.yes).map((s) => s.id);
    expect(yes).toEqual(expect.arrayContaining(["A3", "A4", "A6", "A13", "A14"]));
    expect(d.requirements.find((r) => r.id === "human_review")?.status).toBe("to_do");
  });

  it("turns 'we already had it for another reason' into a to-do, in words that agree", () => {
    const d = derive(leah(), ruleSet);
    const check = d.requirements.find((r) => r.id === "new_purpose_check")!;
    expect(check.status).toBe("to_do");
    expect(check.cause.text).toMatch(/^A14: Attendance records was held for a different reason/);
    expect(d.requirements.find((r) => r.id === "ropa_entry")?.cause.text).toBe("there's personal data in Attendance records");
    expect(d.requirements.find((r) => r.id === "privacy_notice_line")?.cause.text).toMatch(/^A10: no privacy notice covers/);
  });

  it("treats the council as a partner: shared with, one policy line, a sharing agreement and no supplier questions", () => {
    const flow = withCouncil();
    const d = derive(flow, ruleSet);
    tell("Leah: shared with the council", flow, d);
    expect(d.verdict.id).toBe("needs_owner");
    const policy = policyAnswer(flow, d, ruleSet);
    expect(policy.ok).toBe(true);
    expect(policy.lines.filter((l) => l.text.includes("The council"))).toHaveLength(1);
    expect(d.requirements.find((r) => r.id === "retention_note")?.cause.text).toBe("a copy stays with Microsoft and The council");
    const pack = buildPack(flow, d, ruleSet);
    const council = pack.forDpo.cards.find((c) => c.title === "The council")!;
    expect(council.dpa).toMatch(/^sharing agreement/);
    expect(council.art28.of).toBe(0);
    expect(council.questions).toEqual([]);
    expect(pack.forDpo.cards.find((c) => c.title === "Microsoft")?.art28.of).toBe(9);
  });
});

describe("roleplay E: a parent app built on Lovable, already in use, with under-13s", () => {
  const marcus = () =>
    answer(
      build(
        {
          role: "Admin staff",
          data: [{ kind: "contact", label: "names and contact details" }, { kind: "media", label: "photos or video" }],
          about: { kind: "pupils_primary", label: "primary pupils (under 13)" },
          under18: "under_13",
          product: "lovable_app",
          purpose: choices.purpose("messages", "send messages"),
        },
        true,
      ),
      { lawful_basis: "Consent, but refusing is not a realistic option", plan: "Free or personal accounts", told: "No, or not sure" },
    );

  it("says no for three reasons at once, and that the check is late", () => {
    const flow = marcus();
    const d = derive(flow, ruleSet);
    tell("Marcus: the Lovable parent app", flow, d);
    expect(d.verdict.id).toBe("stop");
    expect(d.highest_tier).toBe(2);
    expect(d.outcome).toBe("required");
    const lines = new Set(d.bright_lines.map((b) => b.id));
    expect(lines).toEqual(new Set(["consent_imbalance", "consent_under_13", "trains_on_data"]));
    expect(d.blocked.length).toBeGreaterThan(0);
    expect(d.notes.join(" ")).toMatch(/already in use/);
  });

  it("doesn't ask whether contact details have names on, and names everything over the line", () => {
    const flow = marcus();
    const d = derive(flow, ruleSet);
    const contact = flow.nodes.find((n) => n.title === "Names and contact details")!;
    expect(d.locks[contact.id]?.identifiability).toBeTruthy();
    const names = stepsFor(flow, d).filter((s) => s.q.id === "names" && isDecisive(s, flow, ruleSet, d)).map((s) => s.node?.title);
    expect(names).not.toContain("Names and contact details");
    expect(d.blocked[0].ways_out[0]).toBe("Send less: reduce Names and contact details and Photos or video to what Level 0 allows.");
  });

  it("offers Power Apps in the tenant as the lighter route, honestly still a no until consent is fixed", () => {
    const flow = marcus();
    const routes = lighterRoutes(flow, derive(flow, ruleSet), ruleSet);
    const apps = routes.find((r) => r.feature.id === "power_apps_standard")!;
    expect(apps).toBeTruthy();
    expect(apps.ours.blocked).toBe(0);
    expect(stillNo(apps)).toMatch(/^Still a no on its own/);
  });
});
