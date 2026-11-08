// Prints the pack text for the given example files, for reading as a person would. Run: npx vite-node scripts/pack-text.ts 10 11
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { derive } from "../src/engine/derive";
import { ruleSet } from "../src/engine/ruleset";
import type { Flow } from "../src/engine/types";
import { buildPack, packText } from "../src/ui/packBuild";

const dir = join(process.cwd(), "data", "examples");
const wanted = process.argv.slice(2);
for (const f of readdirSync(dir).filter((x) => /^\d\d-/.test(x) && (!wanted.length || wanted.some((w) => x.startsWith(w)))).sort()) {
  const flow = JSON.parse(readFileSync(join(dir, f), "utf8")) as Flow;
  console.log(`\n==================== ${f}\n`);
  console.log(packText(buildPack(flow, derive(flow, ruleSet), ruleSet)));
}
