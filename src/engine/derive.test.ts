import { describe, expect, it } from "vitest";
import example from "../../data/example-copilot-marking.json";
import { applyLever, derive, openKeys } from "./derive";
import { ruleSet } from "./ruleset";
import type { Flow } from "./types";

const flow = example as unknown as Flow;
const expected = example.expected_derivation;
const d = derive(flow, ruleSet);

describe("example: Copilot marking", () => {
  it("derives the data tier", () => {
    for (const [id, tier] of Object.entries(expected.tiers)) expect(d.tiers[id]).toBe(tier);
  });

  it("finds the one crossing", () => {
    expect(d.crossings).toEqual(expected.crossings);
  });

  it("answers the screening", () => {
    const yes = Object.fromEntries(Object.values(d.screening).map((a) => [a.id, a.yes]));
    expect(yes).toEqual(expected.screening);
  });

  it("gives a because for every yes", () => {
    for (const a of Object.values(d.screening).filter((x) => x.yes)) {
      expect(a.because.length).toBeGreaterThan(0);
      expect(a.source?.url).toMatch(/^https:/);
    }
  });

  it("reaches the outcome and floor", () => {
    expect(d.outcome).toBe(expected.outcome);
    expect(d.use_case_floor).toBe(expected.use_case_floor);
  });

  it("lists the requirements with their status", () => {
    for (const [key, status] of Object.entries(expected.requirements)) {
      expect(d.requirements.find((r) => r.key === key)?.status, key).toBe(status);
    }
  });

  it("has no open requirement the expected result doesn't name", () => {
    const named = Object.keys(expected.requirements);
    expect(openKeys(d).filter((k) => !named.includes(k))).toEqual([]);
  });

  it("says what caused every requirement and links a source", () => {
    for (const r of d.requirements.filter((x) => x.rail)) {
      expect(r.cause.text, r.key).not.toBe("");
      expect(r.source?.url, r.key).toBeTruthy();
    }
  });

  it("rates risk and effort", () => {
    expect(d.risk).toBe(expected.risk);
    expect(d.effort).toEqual(expected.effort);
  });

  it("finds the cheapest change", () => {
    const c = d.cheapest_change!;
    const e = expected.cheapest_change;
    expect({ node: c.node, lever: c.lever, to: c.to, cost: c.cost }).toEqual({ node: e.node, lever: e.lever, to: e.to, cost: e.cost });
    expect([...c.removes].sort()).toEqual([...e.removes].sort());
  });

  it("never claims the flow is lawful and keeps DPIA steps 3, 5, 6 human", () => {
    expect(d.needs_person.join(" ")).toMatch(/step 3/);
    expect(d.needs_person.join(" ")).toMatch(/step 5/);
    expect(d.needs_person.join(" ")).toMatch(/step 6/);
  });

  it("does not mutate the input flow", () => {
    expect(flow.nodes.find((n) => n.id === "n_work")!.levers.identifiability).toBe("named");
  });
});

describe("variations", () => {
  it("pseudonymising drops the outcome to recommended", () => {
    const b = derive(applyLever(flow, "n_work", "identifiability", "pseudonymised"), ruleSet);
    expect(b.outcome).toBe("recommended");
    expect(b.tiers.n_work).toBe(2);
    expect(b.screening_tiers.n_work).toBe(1);
  });

  it("special category data into Microsoft is gated, not blocked: an Article 9 condition and a Level 3 AI sign-off", () => {
    const b = derive(applyLever(flow, "n_work", "special_category", true), ruleSet);
    expect(b.tiers.n_work).toBe(3);
    expect(b.blocked).toEqual([]);
    expect(b.requirements.find((r) => r.id === "art9_condition")?.status).toBe("to_do");
    expect(b.requirements.find((r) => r.id === "level3_ai_signoff")?.status).toBe("to_do");
    expect(b.requirements.find((r) => r.key === "dpa_card:n_microsoft")).toBeDefined();
  });

  it("special category data into a supplier not approved for Level 3 is blocked", () => {
    const b = derive(applyLever({ ...flow, nodes: flow.nodes.map((n) => (n.id === "n_microsoft" ? { ...n, fields: { ...n.fields, company_id: "canva", card_ref: null } } : n)) }, "n_work", "special_category", true), ruleSet);
    expect(b.blocked.length).toBeGreaterThan(0);
    expect(b.blocked[0].message).toMatch(/Level 3 data only goes to a supplier your policy approves for it/);
  });

  it("tier 2 into an unlisted company is blocked with two ways out", () => {
    const f: Flow = { ...flow, nodes: flow.nodes.map((n) => (n.id === "n_microsoft" ? { ...n, title: "Some app", fields: { ...n.fields, company_id: "unknown_co", card_ref: null } } : n)) };
    const b = derive(f, ruleSet);
    expect(b.blocked).toHaveLength(1);
    expect(b.blocked[0].ways_out).toHaveLength(2);
    // Pseudonymised data keeps its content tier for the supplier question, so only the swap clears it.
    expect(b.cheapest_change).toMatchObject({ lever: "company_id", to: "microsoft", unblocks: 1 });
  });

  it("a joint controller needs a sharing agreement, not a DPA", () => {
    const b = derive(applyLever(flow, "n_microsoft", "role", "joint_controller"), ruleSet);
    expect(b.requirements.some((r) => r.key === "dsa_outline:n_microsoft")).toBe(true);
    expect(b.requirements.some((r) => r.key === "dpa_card:n_microsoft")).toBe(false);
  });

  it("students using it directly raises the children's code check", () => {
    const b = derive(applyLever(flow, "n_work", "student_facing", true), ruleSet);
    expect(b.requirements.some((r) => r.id === "children_code")).toBe(true);
  });

  it("locks vulnerable on for learners", () => {
    const f = applyLever(flow, "n_students", "vulnerable", false);
    const b = derive(f, ruleSet);
    expect(b.facts.n_students.vulnerable).toBe(true);
    expect(b.locks.n_students.vulnerable).toBeTruthy();
  });
});

describe("bright lines and risk ownership", () => {
  const withField = (f: Flow, id: string, field: string, value: unknown): Flow => ({
    ...f,
    nodes: f.nodes.map((n) => (n.id === id ? { ...n, fields: { ...n.fields, [field]: value } } : n)),
  });

  it("the worked example hits no bright line and goes to a risk owner", () => {
    expect(d.bright_lines).toEqual([]);
    expect(d.verdict.id).toBe("needs_owner");
    const owned = derive({ ...flow, risk_owner: "Deputy principal" }, ruleSet);
    expect(owned.verdict.label).toBe("Yes, once the deputy principal signs it off");
  });

  it("consent from students is a hard stop", () => {
    const b = derive(withField(flow, "n_work", "lawful_basis", "consent"), ruleSet);
    expect(b.bright_lines.map((x) => x.id)).toContain("consent_imbalance");
    expect(b.verdict.id).toBe("stop");
  });

  it("a supplier that trains on the data, or refuses terms, is a hard stop", () => {
    expect(derive(applyLever(flow, "n_microsoft", "trains_on_inputs", true), ruleSet).bright_lines.map((x) => x.id)).toContain("trains_on_data");
    expect(derive(withField(flow, "n_microsoft", "vendor_position", "refused"), ruleSet).bright_lines.map((x) => x.id)).toContain("vendor_refuses");
  });

  it("a less intrusive design, or rights that can't be honoured, stop it", () => {
    expect(derive(withField(flow, "n_purpose", "less_intrusive", "yes"), ruleSet).verdict.id).toBe("stop");
    expect(derive(withField(flow, "n_purpose", "rights_possible", "no"), ruleSet).verdict.id).toBe("stop");
  });

  it("automatic decisions that can block vulnerable people point to the ICO", () => {
    let f = applyLever(flow, "n_purpose", "decides_alone", true);
    f = applyLever(f, "n_purpose", "can_block", true);
    const b = derive(f, ruleSet);
    expect(b.bright_lines.find((x) => x.id === "ico_consult")?.kind).toBe("consult");
    expect(b.verdict.id).toBe("consult");
  });

  it("a late check on something already running says so", () => {
    expect(derive({ ...flow, retrospective: true }, ruleSet).notes.length).toBe(1);
  });
});
