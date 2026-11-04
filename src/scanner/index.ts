// The GDPR repo scanner, in the browser. Ported from github.com/ClarkMitton/Node-TypeScript-API
// (lib/gdpr-scanner) with the file system swapped for files in memory. Same analysers, same scoring.
export * from "./types";
export * from "./files";
export * from "./fetch-github";
export { applyReviewAnswers, cardFlowKey } from "./review";

import { runASTAnalyzer } from "./ast-analyzer";
import { analyzeDependencies } from "./dependency-analyzer";
import type { RepoFiles } from "./files";
import { buildRepoIndex } from "./gdpr-rule-engine";
import { detectMediaCapture } from "./media-detector";
import { detectServices } from "./service-detector";
import { runStaticScanner } from "./static-scanner";
import type { Finding, RepoIndex, ScanProgress, VerifiedFlow } from "./types";

function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.file}:${f.line ?? 0}:${f.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateFlows(flows: VerifiedFlow[]): VerifiedFlow[] {
  const seen = new Set<string>();
  return flows.filter((f) => {
    const key = `${f.source}→${f.sink}:${f.file}:${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Scan files already in memory. Pure apart from the progress callback. */
export async function scanFiles(repo: RepoFiles, repoName: string, onProgress?: (p: ScanProgress) => void): Promise<RepoIndex> {
  onProgress?.({ stage: "static", message: "Reading config and text files…" });
  const staticFindings = await runStaticScanner(repo);

  onProgress?.({ stage: "deps", message: "Looking at dependencies and services…" });
  const [deps, services, mediaCapture] = await Promise.all([analyzeDependencies(repo), detectServices(repo), detectMediaCapture(repo)]);

  onProgress?.({ stage: "ast", message: "Tracing where data goes in the code…" });
  const astResult = await runASTAnalyzer(repo, (done, total) => onProgress?.({ stage: "ast", message: `Tracing where data goes: file ${done} of ${total}` }));

  onProgress?.({ stage: "scoring", message: "Working out the score…" });
  const allFindings = deduplicateFindings([...staticFindings, ...astResult.findings]);
  const allVerifiedFlows = deduplicateFlows(astResult.verifiedFlows);
  const index = buildRepoIndex(repoName, allFindings, deps, allVerifiedFlows, services, mediaCapture);

  onProgress?.({ stage: "done", message: "Scan complete." });
  return index;
}
