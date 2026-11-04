// The scanner engine reads a repository as files in memory, never from disk.
// A RepoFiles is a map of relative path -> text content. The fetcher fills it; the analysers read it.

export type RepoFiles = Map<string, string>;

const DOT = /\/\.|^\./;

/** Every path in the repo, skipping the usual noise directories; dotfiles only when asked. */
export function listFiles(repo: RepoFiles, skipDirs: readonly string[], opts: { dot?: boolean } = {}): string[] {
  const out: string[] = [];
  for (const p of repo.keys()) {
    const parts = p.split("/");
    if (parts.slice(0, -1).some((d) => skipDirs.includes(d))) continue;
    if (!opts.dot && DOT.test(p)) continue;
    out.push(p);
  }
  return out.sort();
}

export function extname(p: string): string {
  const base = basename(p);
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(i) : "";
}

export function basename(p: string): string {
  return p.slice(p.lastIndexOf("/") + 1);
}
