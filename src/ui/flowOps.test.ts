import { describe, expect, it } from "vitest";
import example from "../../data/example-copilot-marking.json";
import type { Flow } from "../engine/types";
import { addNode, applyDataKind, applyProduct, flowFromSentence, tidy } from "./flowOps";
import { ruleSet } from "../engine/ruleset";

describe("tidy up", () => {
  const flow = tidy(example as unknown as Flow, () => undefined);

  it("puts companies outside and everything else inside", () => {
    for (const n of flow.nodes) expect(n.inside, n.title).toBe(n.type !== "company");
  });

  it("puts a sub-processor straight under the company it works for", () => {
    const ms = flow.nodes.find((n) => n.id === "n_microsoft")!;
    const oa = flow.nodes.find((n) => n.id === "n_openai")!;
    expect(oa.position.x).toBe(ms.position.x);
    expect(oa.position.y).toBeGreaterThan(ms.position.y);
  });

  it("doesn't stack two nodes on the same spot", () => {
    const spots = flow.nodes.map((n) => `${n.position.x},${n.position.y}`);
    expect(new Set(spots).size).toBe(spots.length);
  });
});

describe("changing tool on the canvas", () => {
  const start = () =>
    flowFromSentence(
      { role: "Teacher", data: [{ kind: "attendance", label: "attendance records" }], about: { kind: "pupils_secondary", label: "pupils (11 to 16)" }, under18: "under_16", product: "m365_copilot", otherTool: null, purpose: { kind: "predict", label: "predict who might struggle" } },
      ruleSet,
      false,
    );
  const companies = (f: Flow) => f.nodes.filter((n) => n.type === "company").map((n) => String(n.fields.company_id)).sort();

  it("swapping Copilot for ChatGPT takes Microsoft and its sub-processor off the canvas, and back again", () => {
    const a = start();
    const sys = a.nodes.find((n) => n.type === "system")!;
    expect(companies(a)).toEqual(["microsoft", "openai_azure"]);
    const b = applyProduct(a, sys.id, "chatgpt", ruleSet);
    expect(companies(b)).toEqual(["openai_consumer"]);
    expect(b.edges.every((e) => b.nodes.some((n) => n.id === e.from) && b.nodes.some((n) => n.id === e.to))).toBe(true);
    const c = applyProduct(b, sys.id, "m365_copilot", ruleSet);
    expect(companies(c)).toEqual(["microsoft", "openai_azure"]);
  });

  it("a new data box can take a kind from the sentence list", () => {
    const a = start();
    const { flow: b, node } = addNode(a, "data");
    const c = applyDataKind(b, node.id, "sensitive");
    const n = c.nodes.find((x) => x.id === node.id)!;
    expect(n.title).toBe("Health, SEND or safeguarding information");
    expect(n.levers.special_category).toBe(true);
    expect(n.fields.categories).toContain("health");
  });
});
