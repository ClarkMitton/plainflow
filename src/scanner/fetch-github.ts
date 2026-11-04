// Fetch a public GitHub repository into memory, from the browser, with no server in between.
// Two hosts only: api.github.com for the file list, raw.githubusercontent.com for contents.
// Both allow browser requests. Nothing is stored; the files live in memory for the scan and are dropped.
import type { RepoFiles } from "./files";

export interface RepoRef {
  owner: string;
  repo: string;
  ref?: string;
}

export function parseGithubUrl(input: string): RepoRef | null {
  const m = input.trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+))?(?:[/?#].*)?$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2], ref: m[3] };
}

export interface FetchProgress {
  stage: "listing" | "downloading";
  done: number;
  total: number;
}

/** Skip what the scanner would skip anyway, and anything too big to be source. */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", "__pycache__", "vendor", ".venv"]);
const SKIP_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp", ".mp3", ".mp4", ".wav", ".ogg", ".webm", ".mov",
  ".woff", ".woff2", ".ttf", ".eot", ".otf", ".zip", ".gz", ".tar", ".pdf", ".docx", ".xlsx", ".pptx", ".lock", ".map",
  ".wasm", ".bin", ".exe", ".dll", ".so", ".dylib", ".class", ".jar",
]);
const MAX_FILE_BYTES = 400_000;
const MAX_FILES = 2500;

function skip(path: string, size: number | undefined): boolean {
  const parts = path.split("/");
  if (parts.slice(0, -1).some((d) => SKIP_DIRS.has(d))) return true;
  const base = parts[parts.length - 1];
  const i = base.lastIndexOf(".");
  const ext = i > 0 ? base.slice(i).toLowerCase() : "";
  if (SKIP_EXTS.has(ext)) return true;
  if (base === "package-lock.json" || base === "pnpm-lock.yaml" || base === "yarn.lock" || base === "bun.lock") return true;
  if (size !== undefined && size > MAX_FILE_BYTES) return true;
  return false;
}

async function api<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    throw new Error("GitHub's rate limit for this browser is used up for now. Try again in an hour, or scan a smaller repository.");
  }
  if (res.status === 404) throw new Error("GitHub can't find that repository. Check the link; private repositories can't be scanned.");
  if (!res.ok) throw new Error(`GitHub replied ${res.status} while listing the repository.`);
  return (await res.json()) as T;
}

/**
 * Download a public repository's text files. `token` is optional and only ever used for this
 * request; it's never stored. The caller should drop the returned map once the scan is done.
 */
export async function fetchRepo(ref: RepoRef, onProgress?: (p: FetchProgress) => void, token?: string): Promise<{ files: RepoFiles; branch: string; truncated: boolean }> {
  const base = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
  onProgress?.({ stage: "listing", done: 0, total: 0 });
  let branch = ref.ref;
  if (!branch) {
    const info = await api<{ default_branch: string }>(base, token);
    branch = info.default_branch;
  }
  const tree = await api<{ tree: { path: string; type: string; size?: number }[]; truncated?: boolean }>(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`, token);
  const wanted = tree.tree.filter((t) => t.type === "blob" && !skip(t.path, t.size)).slice(0, MAX_FILES);

  const files: RepoFiles = new Map();
  let done = 0;
  onProgress?.({ stage: "downloading", done, total: wanted.length });
  // A handful at a time: fast enough, and polite to GitHub.
  const queue = [...wanted];
  const worker = async () => {
    while (queue.length) {
      const item = queue.shift()!;
      try {
        const res = await fetch(`https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${branch}/${item.path.split("/").map(encodeURIComponent).join("/")}`);
        if (res.ok) {
          const text = await res.text();
          // A replacement character means binary slipped through; the analysers skip those anyway.
          if (!text.includes("\u0000")) files.set(item.path, text);
        }
      } catch {
        /* a missing file is not a failed scan */
      }
      onProgress?.({ stage: "downloading", done: ++done, total: wanted.length });
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return { files, branch, truncated: !!tree.truncated || tree.tree.length > MAX_FILES };
}
