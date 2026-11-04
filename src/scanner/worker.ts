// The scan runs here, off the main thread, so the page stays responsive while code is parsed.
// Messages in: { url, token? }. Messages out: progress, then done (the report) or error.
import { fetchRepo, parseGithubUrl } from "./fetch-github";
import { scanFiles } from "./index";
import type { RepoIndex } from "./types";

export type WorkerIn = { type: "scan"; url: string; token?: string };
export type WorkerOut =
  | { type: "progress"; stage: string; message: string; done?: number; total?: number }
  | { type: "done"; report: RepoIndex; branch: string; truncated: boolean; fileCount: number }
  | { type: "error"; message: string };

const post = (m: WorkerOut) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const { url, token } = e.data;
  const ref = parseGithubUrl(url);
  if (!ref) { post({ type: "error", message: "That doesn't look like a GitHub repository link." }); return; }
  try {
    const { files, branch, truncated } = await fetchRepo(ref, (p) => post({ type: "progress", stage: p.stage, message: p.stage === "listing" ? "Listing the repository's files…" : `Downloading files: ${p.done} of ${p.total}`, done: p.done, total: p.total }), token);
    if (files.size === 0) { post({ type: "error", message: "No readable files found. Is the repository empty, or private?" }); return; }
    const report = await scanFiles(files, `${ref.owner}__${ref.repo}`, (p) => post({ type: "progress", stage: p.stage, message: p.message }));
    report.repo = `${ref.owner}/${ref.repo}`;
    post({ type: "done", report, branch, truncated, fileCount: files.size });
    files.clear();
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
