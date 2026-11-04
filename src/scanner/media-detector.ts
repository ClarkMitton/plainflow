import type { ServiceEvidence } from "./types";
import { extname, listFiles, type RepoFiles } from "./files";

/**
 * Camera / microphone / media-capture detector.
 *
 * Photos, audio and video of people are likely to contain biometric /
 * special-category data (GDPR Art. 9) — and in education apps, children's data
 * (Art. 8). The AST analyzer can confirm a file *upload* sink but cannot read
 * the file's contents, so a media-capture capability is a strong signal that the
 * uploads are photos/recordings of people and must be reviewed, not buried.
 */

export interface MediaCaptureResult {
  detected: boolean;
  evidence: ServiceEvidence[];
}

interface CaptureRule {
  pattern: RegExp;
  label: string;
}

const CAPTURE_RULES: CaptureRule[] = [
  { pattern: /getUserMedia\s*\(|mediaDevices\.getUserMedia/, label: "camera/microphone access (getUserMedia)" },
  { pattern: /getDisplayMedia\s*\(/, label: "screen capture (getDisplayMedia)" },
  { pattern: /new\s+MediaRecorder\b/, label: "audio/video recording (MediaRecorder)" },
  { pattern: /\bImageCapture\b/, label: "photo capture (ImageCapture)" },
  // HTML/JSX file input that opens the camera or accepts media
  { pattern: /<input\b[^>]*\bcapture\b/i, label: "camera capture input (capture attribute)" },
  { pattern: /accept\s*=\s*["'][^"']*(image|video|audio)\//i, label: "media file input (accept image/video/audio)" },
  // Common camera component libraries
  { pattern: /\bfrom\s+["'](react-webcam|expo-camera|react-native-camera|react-native-vision-camera|@react-native-camera\/[^"']+)["']/, label: "camera library import" },
  { pattern: /require\(\s*["'](react-webcam|expo-camera|react-native-camera|react-native-vision-camera)["']\s*\)/, label: "camera library import" },
];

const SKIP_DIRS = ["node_modules", ".git", "dist", "build", ".next", "coverage", "__pycache__"];
const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".html", ".vue", ".svelte"]);
const MAX_EVIDENCE = 5;

export async function detectMediaCapture(repo: RepoFiles): Promise<MediaCaptureResult> {
  const files = listFiles(repo, SKIP_DIRS);
  const codeFiles = files.filter((f) => CODE_EXTS.has(extname(f).toLowerCase()));

  const evidence: ServiceEvidence[] = [];

  for (const relFile of codeFiles) {
    if (evidence.length >= MAX_EVIDENCE) break;
    const content = repo.get(relFile);
    if (content === undefined) continue;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length && evidence.length < MAX_EVIDENCE; i++) {
      const line = lines[i]!;
      if (line.length > 2000) continue;
      for (const rule of CAPTURE_RULES) {
        if (rule.pattern.test(line)) {
          evidence.push({ file: relFile, line: i + 1, snippet: `${rule.label}: ${line.trim().slice(0, 140)}` });
          break;
        }
      }
    }
  }

  return { detected: evidence.length > 0, evidence };
}
