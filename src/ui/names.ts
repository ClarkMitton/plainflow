// The canvas itself stays Tier 0: warn when free text looks like it holds a real person's name or contact.
import products from "../../data/products.json";

const TITLES = /\b(mr|mrs|ms|miss|mx|dr|prof|sir)\.?\s+[a-z]/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE = /(\+44|\b0)\d[\d\s]{8,}\d/;

const allow = new Set(
  [
    ...Object.values(products.products).map((p) => p.name),
    ...Object.values(products.companies).map((c) => c.name),
    "Level Year Key Stage Student Students Teacher Teachers Staff Learner Learners Parent Parents Work Data Group Class Team Teams",
    "Microsoft Google Apple Amazon Power Automate Apps BI Copilot Azure OpenAI Forms SharePoint Outlook Excel Word Canva Lovable Supabase",
    "Suggest Mark Marking Feedback Support Notes Attendance Grades Record Records Report Reports Survey Admin Centre Organisation Privacy Notice",
    "Monday Tuesday Wednesday Thursday Friday January February March April May June July August September October November December",
    "UK EU US DPA DPIA DPO SEND GCSE BTEC AI App",
  ]
    .join(" ")
    .split(/[\s()/,]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase()),
);

/** Returns a warning sentence, or null when the text looks fine. */
export function nameWarning(text: string | null | undefined): string | null {
  if (!text) return null;
  if (EMAIL.test(text)) return "This looks like an email address. Use a role instead; the canvas must not hold personal data.";
  if (PHONE.test(text)) return "This looks like a phone number. Leave it out; the canvas must not hold personal data.";
  if (TITLES.test(text)) return "This looks like a person's name. Use a role or group instead (Teacher, Year 12).";
  // Two capitalised words in a row that aren't known product or role words: likely a first and last name.
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i].replace(/[^A-Za-z'-]/g, "");
    const b = words[i + 1].replace(/[^A-Za-z'-]/g, "");
    const cap = (w: string) => /^[A-Z][a-z'-]{1,}$/.test(w);
    if (cap(a) && cap(b) && !allow.has(a.toLowerCase()) && !allow.has(b.toLowerCase())) {
      return "This looks like a person's name. Use a role or group instead (Teacher, Year 12).";
    }
  }
  return null;
}
