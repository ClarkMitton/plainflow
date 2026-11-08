import { describe, expect, it } from "vitest";
import { derive } from "../engine/derive";
import { ruleSet } from "../engine/ruleset";
import { flowFromSentence, type Sentence } from "./flowOps";
import { isDecisive, stepsFor } from "./questions";

const sentence = (product: string): Sentence => ({
  role: "Teacher",
  data: [{ kind: "work", label: "student work (essays, assignments)" }],
  about: { kind: "students", label: "students" },
  under18: "some_under_18",
  product,
  otherTool: null,
  purpose: { kind: "mark", label: "suggest a mark" },
});

function asked(product: string) {
  const flow = flowFromSentence(sentence(product), ruleSet, false);
  const d = derive(flow, ruleSet);
  const steps = stepsFor(flow, d);
  return { steps, asked: steps.filter((s) => isDecisive(s, flow, ruleSet, d)).map((s) => s.q.id) };
}

describe("a shorter Q&A", () => {
  it("asks no more than nine questions for the worked example idea", () => {
    const { asked: ids } = asked("m365_copilot");
    expect(ids.length).toBeLessThanOrEqual(9);
  });

  it("always asks the hard-line questions", () => {
    const { asked: ids } = asked("m365_copilot");
    expect(ids).toContain("hard_checks");
    expect(ids).toContain("lawful_basis");
    expect(ids).toContain("data_facts");
  });

  it("doesn't ask about a supplier we already have a card for", () => {
    expect(asked("m365_copilot").steps.map((s) => s.q.id)).not.toContain("vendor_terms");
  });

  it("asks about a supplier we know nothing about", () => {
    const { steps } = asked("nearpod");
    expect(steps.map((s) => s.q.id)).toContain("vendor_terms");
  });
});
