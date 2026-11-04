import { useEffect, useRef, useState } from "react";
import type { Flow, RuleSet } from "../engine/types";
import type { RepoIndex } from "../scanner/types";
import type { WorkerIn, WorkerOut } from "../scanner/worker";
import { Glossed } from "./plain";
import { flowFromScan } from "./scanImport";

interface Props {
  set: RuleSet;
  onOpen(flow: Flow, to: "questions" | "canvas"): void;
  onOpenFile(): void;
}

type State =
  | { kind: "idle" }
  | { kind: "running"; message: string; done?: number; total?: number }
  | { kind: "done"; report: RepoIndex; fileCount: number; truncated: boolean }
  | { kind: "error"; message: string };

/**
 * Scan a public GitHub repository right here, in the browser. The code is fetched from GitHub into
 * memory, read by the scanner, and dropped; only the report stays, and only if you open it.
 */
export function ScanPage({ set, onOpen, onOpenFile }: Props) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const worker = useRef<Worker | null>(null);

  useEffect(() => () => worker.current?.terminate(), []);

  const scan = () => {
    worker.current?.terminate();
    const w = new Worker(new URL("../scanner/worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    setState({ kind: "running", message: "Starting…" });
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.type === "progress") setState({ kind: "running", message: m.message, done: m.done, total: m.total });
      if (m.type === "done") setState({ kind: "done", report: m.report, fileCount: m.fileCount, truncated: m.truncated });
      if (m.type === "error") setState({ kind: "error", message: m.message });
    };
    w.onerror = () => setState({ kind: "error", message: "The scan stopped unexpectedly. Try again." });
    w.postMessage({ type: "scan", url } satisfies WorkerIn);
  };

  const s = state.kind === "done" ? state.report.auditSummary : null;

  return (
    <div className="panel sentence-panel scanpanel">
      <p className="lab">Scan the code of an app you've built</p>
      <p style={{ margin: "6px 0 12px", fontSize: 15, lineHeight: 1.5 }}>
        Paste the link to a public GitHub repository. Plainflow reads the code here in your browser: where personal data goes, which outside services and AI it calls, and whether a DPIA looks likely. The code is fetched from GitHub into memory for the scan and then dropped; nothing is sent anywhere else.
      </p>
      <form className="scanform" onSubmit={(e) => { e.preventDefault(); if (url.trim()) scan(); }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repository" aria-label="GitHub repository link" spellCheck={false} />
        <button type="submit" className="btn dk" style={{ boxShadow: "4px 4px 0 var(--data)" }} disabled={!url.trim() || state.kind === "running"}>
          {state.kind === "running" ? "Scanning…" : "Scan it"}
        </button>
      </form>

      {state.kind === "running" && (
        <div className="scanprog" role="status">
          <div className="bar"><span style={{ width: state.total ? `${(100 * (state.done ?? 0)) / state.total}%` : "30%" }} /></div>
          <div className="mono" style={{ fontSize: 12, marginTop: 6 }}>{state.message}</div>
        </div>
      )}
      {state.kind === "error" && <div className="box alert" style={{ marginTop: 14 }}>{state.message}</div>}

      {state.kind === "done" && s && (
        <div className="scanresult">
          <div className="scanhead">
            <div>
              <p className="lab">Scanned {state.report.repo} · {state.fileCount} files{state.truncated ? " (large repository, first part only)" : ""}</p>
              <div className="big" style={{ fontSize: 30 }}>{s.dpiaScreening.dpiaRecommended ? "A DPIA looks likely" : "No DPIA triggers found in the code"}</div>
            </div>
            <div className="mono" style={{ fontSize: 12, textAlign: "right" }}>
              scanner score {state.report.summary.gdprScore}/100<br />{state.report.summary.riskLevel.toLowerCase().replace("_", " ")}
            </div>
          </div>
          <dl className="scanfacts">
            <dt>Outside services</dt>
            <dd>{s.thirdPartyServices.length ? s.thirdPartyServices.map((x) => `${x.name}${x.isAI ? " (AI)" : ""}`).join(", ") : "none found"}</dd>
            <dt>Data flows traced</dt>
            <dd>{state.report.verifiedFlows.length}{s.aiFlowCount ? `, ${s.aiFlowCount} into AI` : ""}</dd>
            <dt>Camera or microphone</dt>
            <dd>{s.mediaCapture?.detected ? "yes, the app can capture photos, audio or video" : "not found"}</dd>
            {s.dpiaScreening.detectedTriggers.length > 0 && (
              <>
                <dt>Why</dt>
                <dd><ul className="plain" style={{ margin: 0 }}>{s.dpiaScreening.detectedTriggers.map((t) => <li key={t}>{t}</li>)}</ul></dd>
              </>
            )}
          </dl>
          <p style={{ fontSize: 14, margin: "10px 0 12px" }}><Glossed text="The code can't tell who the people are, the legal reason, or who signs. A few questions follow, then the picture and the answer. The full report, with the code evidence, is on the Report tab once it's open." /></p>
          <button type="button" className="btn dk" style={{ boxShadow: "4px 4px 0 var(--data)", fontSize: 16, padding: "10px 18px" }} onClick={() => onOpen(flowFromScan({ ...state.report, githubUrl: url.trim() }, set), "questions")}>
            Open it as a picture
          </button>
        </div>
      )}

      <p className="mu" style={{ fontSize: 13, margin: "14px 0 0" }}>
        Got a report file from the scanner already? <button type="button" className="linkish" onClick={onOpenFile}>Open a scanner report</button>
      </p>
    </div>
  );
}
