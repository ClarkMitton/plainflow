// Builds the example canvases in data/examples from sentences and answers, the same way a person would,
// so they stay true to the rules. Run: npx vite-node scripts/make-examples.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { derive } from "../src/engine/derive";
import { ruleSet } from "../src/engine/ruleset";
import type { Flow } from "../src/engine/types";
import { flowFromSentence, tidy, type Sentence } from "../src/ui/flowOps";
import { apply, stepsFor } from "../src/ui/questions";

interface Example {
  file: string;
  title: string;
  sentence: Sentence;
  answers: Record<string, string>;
  riskOwner?: string;
}

const data = (kind: string, label: string) => ({ kind, label });

const EXAMPLES: Example[] = [
  {
    file: "01-lesson-plans-gemini",
    title: "Lesson plans in Gemini",
    sentence: { role: "Teacher", data: [{ kind: null, label: "lesson plans" }], about: { kind: null, label: "nobody in particular" }, under18: "all_adults", product: "gemini_consumer", otherTool: null, purpose: { kind: "plan", label: "plan lessons" } },
    answers: { names: "No, nobody can be identified", plan: "Free or personal accounts" },
  },
  {
    file: "02-parent-contacts-forms",
    title: "Parent contact details in Microsoft Forms",
    sentence: { role: "Admin staff", data: [data("contact", "names and contact details")], about: { kind: "parents", label: "parents" }, under18: "all_adults", product: "m365", otherTool: null, purpose: { kind: "messages", label: "send messages" } },
    answers: { lawful_basis: "It is part of our public task", told: "Yes, it is in our privacy notice" },
  },
  {
    file: "03-coded-work-copilot",
    title: "Coded student work in Copilot",
    sentence: { role: "Teacher", data: [data("work", "student work (essays, assignments)")], about: { kind: "students", label: "students (16 plus)" }, under18: "some_under_18", product: "m365_copilot", otherTool: null, purpose: { kind: "feedback", label: "draft feedback" } },
    answers: { names: "By a code we can look up", lawful_basis: "It is part of our public task", told: "Yes, it is in our privacy notice", use_case: "Suggest a mark or feedback" },
    riskOwner: "the head of department",
  },
  {
    file: "04-attendance-dashboard-power-bi",
    title: "Attendance dashboard in Power BI",
    sentence: { role: "IT", data: [data("attendance", "attendance records")], about: { kind: "pupils_secondary", label: "pupils (11 to 16)" }, under18: "under_16", product: "power_platform", otherTool: null, purpose: { kind: "predict", label: "predict who might struggle" } },
    answers: {
      data_facts: "It describes how a person is doing|We already hold it, collected for a different purpose",
      lawful_basis: "It is part of our public task",
      purpose_facts: "It produces a mark, grade, score or prediction about a person|It covers a whole cohort, or more than a thousand people|It runs continuously rather than once",
      told: "Yes, it is in our privacy notice",
    },
    riskOwner: "a deputy headteacher",
  },
  {
    file: "05-photos-canva",
    title: "Photos in Canva for a display",
    sentence: { role: "Head of department", data: [data("media", "photos or video")], about: { kind: "students", label: "students (16 plus)" }, under18: "some_under_18", product: "canva", otherTool: null, purpose: { kind: null, label: "make an open evening display" } },
    answers: { lawful_basis: "Consent, and they can refuse with no consequences", told: "Yes, it is in our privacy notice" },
  },
  {
    file: "06-wellbeing-notes-unknown-ai",
    title: "Wellbeing meeting notes in an AI note-taker",
    sentence: { role: "Admin staff", data: [data("recordings", "meeting or lesson recordings"), data("sensitive", "health, SEND or safeguarding information")], about: { kind: "students", label: "students (16 plus)" }, under18: "some_under_18", product: null, otherTool: { name: "Otter", ai: true }, purpose: { kind: "reports", label: "write reports" } },
    answers: { lawful_basis: "Consent, but refusing is not a realistic option", told: "No, or not sure" },
  },
  {
    file: "07-send-notes-copilot",
    title: "SEND notes in Copilot",
    sentence: { role: "SENCO", data: [data("sensitive", "health, SEND or safeguarding information")], about: { kind: "pupils_primary", label: "primary pupils (under 13)" }, under18: "under_13", product: "m365_copilot", otherTool: null, purpose: { kind: "reports", label: "write reports" } },
    answers: { lawful_basis: "It is part of our public task", told: "Yes, it is in our privacy notice", use_case: "Work with things people can be identified from" },
    riskOwner: "the headteacher",
  },
  {
    file: "08-health-information-free-chatgpt",
    title: "Health information in free ChatGPT",
    sentence: { role: "HR", data: [data("sensitive", "health, SEND or safeguarding information")], about: { kind: "staff", label: "staff" }, under18: "all_adults", product: "chatgpt", otherTool: null, purpose: { kind: null, label: "draft absence letters" } },
    answers: { lawful_basis: "Our legitimate interests", plan: "Free or personal accounts", told: "Yes, it is in our privacy notice" },
  },
  {
    file: "09-volunteer-dbs-list-partner",
    title: "Volunteer DBS list shared with a partner",
    sentence: { role: "Manager", data: [data("contact", "names and contact details"), data("criminal", "DBS or criminal record information")], about: { kind: null, label: "volunteers" }, under18: "all_adults", product: "spreadsheet_email", otherTool: null, purpose: { kind: "share", label: "share it with a partner organisation" } },
    answers: { lawful_basis: "Our legitimate interests", told: "No, or not sure" },
    riskOwner: "the chief executive",
  },
];

/** Answer the questions as the person would: anything not named keeps the guess. */
function answer(flow: Flow, answers: Record<string, string>): Flow {
  let f = flow;
  for (let pass = 0; pass < 3; pass++) {
    const d = derive(f, ruleSet, { cheapest: false });
    for (const step of stepsFor(f, d)) {
      const label = answers[step.q.id];
      if (!label) continue;
      if (step.q.type === "checklist") {
        const ticked = step.items.map((it) => label.split("|").includes(it.label));
        f = step.items.reduce((acc, it, i) => apply(acc, step.node?.id ?? null, ticked[i] ? it.on : it.off), f);
      } else {
        const a = step.q.answers?.find((x) => x.label === label);
        if (a) f = apply(f, step.node?.id ?? null, a);
      }
      f = { ...f, answers: { ...(f.answers ?? {}), [step.key]: label } };
    }
  }
  return f;
}

const dir = join(process.cwd(), "data", "examples");
mkdirSync(dir, { recursive: true });
for (const ex of EXAMPLES) {
  let flow = answer(flowFromSentence(ex.sentence, ruleSet, false), ex.answers);
  flow = tidy(flow, () => undefined);
  flow = { ...flow, id: `example_${ex.file.replace(/\W+/g, "_")}`, title: ex.title, checked: true, risk_owner: ex.riskOwner ?? null, changelog: [] };
  const d = derive(flow, ruleSet);
  writeFileSync(join(dir, `${ex.file}.json`), JSON.stringify(flow, null, 2) + "\n");
  console.log(`${ex.file}: Level ${d.highest_tier} · ${d.verdict.label} · ${d.outcome} · ${d.open_count} to do`);
}
