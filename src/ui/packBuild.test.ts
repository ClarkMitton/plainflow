import { describe, expect, it } from "vitest";
import example from "../../data/example-copilot-marking.json";
import { derive } from "../engine/derive";
import { ruleSet } from "../engine/ruleset";
import type { Flow } from "../engine/types";
import { buildPack, packText } from "./packBuild";

const flow = { ...(example as unknown as Flow), risk_owner: "Deputy principal", answers: { "names:n_work": "Yes, names" } };
const d = derive(flow, ruleSet);
const pack = buildPack(flow, d, ruleSet);

describe("the pack", () => {
  it("gives the person a verdict, the facts with the law behind them, and a numbered action plan", () => {
    expect(pack.forPerson.verdict).toBe("Yes, once the deputy principal signs it off");
    expect(pack.forPerson.facts.map((f) => f.label)).toEqual(["The data", "Your policy", "DPIA"]);
    expect(pack.forPerson.facts[2].laws[0].ref).toBe("UK GDPR Art. 35");
    expect(pack.forPerson.actions.map((a) => a.n)).toEqual([1, 2, 3, 4, 5]);
    expect(pack.forPerson.actions.every((a) => a.who && a.howLong && a.meaning)).toBe(true);
    expect(pack.forPerson.easier?.change).toContain("Student work");
  });

  it("gives the DPO the screening, one card per outside company, and what was assumed", () => {
    expect(pack.forDpo.screening).toHaveLength(17);
    expect(pack.forDpo.cards.map((c) => c.title)).toEqual(["Microsoft", "OpenAI via Azure"]);
    expect(pack.forDpo.cards[0].art28.evidenced).toBe(8);
    expect(pack.forDpo.cards[0].dpa).toBe("DPA on file");
    expect(pack.forDpo.asked.filter((a) => a.answer)).toHaveLength(1);
    expect(pack.forDpo.laws.map((l) => l.id)).toContain("art35");
  });

  it("tells the next session what to bring", () => {
    expect(pack.forNext.riskOwner).toBe("Deputy principal");
    expect(pack.forNext.bring.join(" ")).toMatch(/Article 28 term/);
    expect(pack.forNext.assumed.length).toBeGreaterThan(0);
  });

  it("flattens to text that reads as an email", () => {
    const t = packText(pack);
    expect(t).toContain("CAN I DO IT?");
    expect(t).toContain("1. DPIA screening record");
    expect(t).toContain("[UK GDPR Art. 35]");
    expect(t).toContain("FOR THE DPO");
    expect(t).toContain("not legal advice");
    expect(t).not.toMatch(/undefined|null/);
  });
});
