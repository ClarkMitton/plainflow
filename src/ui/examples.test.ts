// The example canvases on the front door: each must still say what it was built to show.
import { describe, expect, it } from "vitest";
import { derive } from "../engine/derive";
import { ruleSet } from "../engine/ruleset";
import type { Flow } from "../engine/types";

const files = import.meta.glob<{ default: Flow }>("../../data/examples/0*.json", { eager: true });
const examples = Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([path, m]) => ({ path, flow: m.default }));

const expected: [string, number, string][] = [
  ["01-lesson-plans-gemini", 0, "go_once"],
  ["02-parent-contacts-forms", 1, "go_once"],
  ["03-coded-work-copilot", 2, "owner_decides"],
  ["04-attendance-dashboard-power-bi", 2, "owner_decides"],
  ["05-photos-canva", 2, "not_like_this"],
  ["06-wellbeing-notes-unknown-ai", 3, "stop"],
  ["07-send-notes-copilot", 3, "owner_decides"],
  ["08-health-information-free-chatgpt", 3, "stop"],
  ["09-volunteer-dbs-list-partner", 3, "owner_decides"],
];

describe("the example gallery", () => {
  it("has nine examples that cover every level and every kind of answer", () => {
    expect(examples).toHaveLength(9);
    for (const [name, tier, verdict] of expected) {
      const ex = examples.find((e) => e.path.includes(name))!;
      expect(ex, name).toBeTruthy();
      const d = derive(ex.flow, ruleSet);
      expect(d.highest_tier, `${name} level`).toBe(tier);
      expect(d.verdict.id, `${name} verdict`).toBe(verdict);
      expect(ex.flow.checked).toBe(true);
      expect(ex.flow.sentence_input).toBeTruthy();
    }
  });
});
