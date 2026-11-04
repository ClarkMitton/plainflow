import { describe, expect, it } from "vitest";
import scan from "../../data/examples/scan-play-anywhere.json";
import { derive } from "../engine/derive";
import { ruleSet } from "../engine/ruleset";
import { flowFromScan, isScanReport } from "./scanImport";

describe("opening a GDPR Repo Scanner report", () => {
  const flow = flowFromScan(scan, ruleSet);
  const d = derive(flow, ruleSet);
  const titles = flow.nodes.map((n) => n.title);

  it("recognises a scanner report and not a saved flow", () => {
    expect(isScanReport(scan)).toBe(true);
    expect(isScanReport(flow)).toBe(false);
  });

  it("draws the app, its users, the data it saw and the services it calls", () => {
    expect(flow.nodes.find((n) => n.type === "system")?.title).toBe("Play anywhere");
    expect(titles).toContain("Photos, audio or video");
    expect(titles).toContain("Account details");
    const supabase = flow.nodes.find((n) => n.title === "Supabase")!;
    expect(supabase.type).toBe("company");
    expect(supabase.inside).toBe(false);
    expect(supabase.fields.company_id).toBe("supabase");
    expect(supabase.fields.region).toBe("unknown");
  });

  it("is a check on something already built, and remembers where it came from", () => {
    expect(flow.retrospective).toBe(true);
    expect(flow.source?.kind).toBe("scan");
    expect(flow.source?.triggers.length).toBeGreaterThan(0);
  });

  it("gets the same answer the canvas would: photos are Level 2, Supabase is approved to Level 1, so not this way", () => {
    expect(d.highest_tier).toBe(2);
    expect(d.outcome).not.toBe("not_required");
    const supabase = flow.nodes.find((n) => n.title === "Supabase")!;
    expect(d.blocked.some((b) => b.to === supabase.id)).toBe(true);
    expect(d.verdict.id).toBe("not_like_this");
    expect(d.blocked[0].ways_out).toHaveLength(2);
  });
});
