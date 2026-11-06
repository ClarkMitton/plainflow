import { describe, expect, it } from "vitest";
import example from "../../data/example-copilot-marking.json";
import { derive } from "../engine/derive";
import { ruleSet } from "../engine/ruleset";
import type { Flow } from "../engine/types";
import { addNode, disconnect, smartConnect } from "./flowOps";

const flow = example as unknown as Flow;
const edgesOf = (f: Flow, id: string) => f.edges.filter((e) => e.from === id || e.to === id);

describe("adding a box wires it in", () => {
  it("new data goes into the tool and is about the students", () => {
    const { flow: f, node, wiredTo } = addNode(flow, "data");
    expect(wiredTo).toEqual(["Copilot"]);
    expect(f.edges.some((e) => e.from === node.id && e.to === "n_copilot" && e.kind === "carries")).toBe(true);
    expect(node.fields.about).toEqual(["n_students"]);
    // and it changes the answer straight away: a second personal data node reaches Microsoft
    expect(derive(f, ruleSet).reach.n_microsoft).toContain(node.id);
  });

  it("a new company receives from the tool, outside the organisation", () => {
    const { flow: f, node } = addNode(flow, "company");
    expect(node.inside).toBe(false);
    expect(f.edges.some((e) => e.from === "n_copilot" && e.to === node.id)).toBe(true);
  });

  it("new people are about the purpose", () => {
    const { flow: f, node } = addNode(flow, "people");
    expect(f.edges.some((e) => e.from === node.id && e.to === "n_purpose" && e.kind === "about")).toBe(true);
  });
});

describe("connecting by choosing", () => {
  it("picks the direction from what the boxes are, whichever way round you choose", () => {
    const a = smartConnect(flow, "n_microsoft", "n_teacher");
    const b = smartConnect(flow, "n_teacher", "n_microsoft");
    const edgeA = a.edges.find((e) => e.id !== "e1" && (e.from === "n_teacher" || e.to === "n_teacher") && (e.from === "n_microsoft" || e.to === "n_microsoft"))!;
    const edgeB = b.edges.find((e) => e.id !== "e1" && (e.from === "n_teacher" || e.to === "n_teacher") && (e.from === "n_microsoft" || e.to === "n_microsoft"))!;
    expect(edgeA.from).toBe("n_teacher");
    expect(edgeB.from).toBe("n_teacher");
  });

  it("a company chosen from a company becomes the one behind it", () => {
    const f = smartConnect(flow, "n_openai", "n_microsoft");
    expect(f.edges.some((e) => e.from === "n_openai" && e.to === "n_microsoft" && e.kind === "sub_processor")).toBe(true);
  });

  it("sends a purpose to a company, as sharing with a partner", () => {
    const f = smartConnect(flow, "n_purpose", "n_microsoft");
    expect(f.edges.some((e) => e.from === "n_purpose" && e.to === "n_microsoft")).toBe(true);
  });

  it("doesn't add the same wire twice", () => {
    expect(smartConnect(flow, "n_work", "n_copilot").edges.length).toBe(flow.edges.length);
  });

  it("disconnecting removes just that wire", () => {
    const f = disconnect(flow, "e4");
    expect(f.edges.length).toBe(flow.edges.length - 1);
    expect(edgesOf(f, "n_microsoft").some((e) => e.id === "e6")).toBe(true);
    expect(derive(f, ruleSet).crossings).toEqual([]);
  });
});
