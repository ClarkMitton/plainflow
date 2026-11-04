import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import report from "../../data/examples/scan-play-anywhere.json";
import { parseGithubUrl, scanFiles, type RepoFiles } from "./index";

// The original scanner's clone of the same repository, if it's on this machine.
const CLONE = "C:/Users/clark/Desktop/Projects/Node-TypeScript-API-main/artifacts/api-server/repos/ClarkMitton__play-anywhere";

function load(dir: string): RepoFiles {
  const files: RepoFiles = new Map();
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name === "node_modules" || name === ".git") continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (statSync(p).size < 400_000) {
        try { files.set(relative(dir, p).replace(/\\/g, "/"), readFileSync(p, "utf8")); } catch { /* binary */ }
      }
    }
  };
  walk(dir);
  return files;
}

describe("the scanner, in memory", () => {
  it("reads GitHub links in the forms people paste", () => {
    expect(parseGithubUrl("https://github.com/ClarkMitton/play-anywhere")).toEqual({ owner: "ClarkMitton", repo: "play-anywhere", ref: undefined });
    expect(parseGithubUrl("github.com/ClarkMitton/play-anywhere/tree/main/src")).toMatchObject({ owner: "ClarkMitton", repo: "play-anywhere", ref: "main" });
    expect(parseGithubUrl("https://github.com/ClarkMitton/play-anywhere.git")).toMatchObject({ repo: "play-anywhere" });
    expect(parseGithubUrl("not a link")).toBeNull();
  });

  it("scans a small repository held in memory", async () => {
    const files: RepoFiles = new Map([
      ["package.json", JSON.stringify({ dependencies: { "@supabase/supabase-js": "^2", openai: "^4" } })],
      ["src/upload.ts", "const file = e.target.files[0];\nawait supabase.storage.from('x').upload(name, file);\n"],
      ["src/ask.ts", "const q = req.body.question;\nconst r = await openai.chat.completions.create({ messages: [{ role: 'user', content: q }] });\n"],
    ]);
    const index = await scanFiles(files, "test__repo");
    expect(index.auditSummary.thirdPartyServices.map((s) => s.name)).toEqual(expect.arrayContaining(["Supabase", "OpenAI"]));
    expect(index.summary.gdprScore).toBeGreaterThan(0);
  });

  it.skipIf(!existsSync(CLONE))("matches the original scanner on Play Anywhere", async () => {
    const index = await scanFiles(load(CLONE), "ClarkMitton__play-anywhere");
    const expected = report.auditSummary;
    expect(index.auditSummary.thirdPartyServices.map((s) => s.name).sort()).toEqual(expected.thirdPartyServices.map((s) => s.name).sort());
    expect(index.auditSummary.mediaCapture?.detected).toBe(expected.mediaCapture?.detected);
    expect(index.auditSummary.dpiaScreening.dpiaRecommended).toBe(expected.dpiaScreening.dpiaRecommended);
    expect(index.verifiedFlows.length).toBe(report.verifiedFlows.length);
    expect(index.summary.gdprScore).toBe(report.summary.gdprScore);
  });
});
