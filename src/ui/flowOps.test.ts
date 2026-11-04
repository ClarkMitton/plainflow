import { describe, expect, it } from "vitest";
import example from "../../data/example-copilot-marking.json";
import type { Flow } from "../engine/types";
import { tidy } from "./flowOps";

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
