// Company cards filled once, kept in this browser, reused by every flow that touches the company.
// The role stays on the flow; the card holds the facts about the company (region, retention, Article 28 evidence).
import { cards as seedCards } from "./flowOps";
import type { FlowNode } from "../engine/types";

const KEY = "plainflow.cards";
const CARD_FIELDS = ["region", "transfer_mechanism", "retention", "deletion_route", "security_assessment", "art28", "dpa_document", "prior_dpia", "owner", "review_date"] as const;

export interface SavedCard {
  company_id: string;
  title: string;
  saved_at: string;
  fields: Record<string, unknown>;
}

export function loadLibrary(): Record<string, SavedCard> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, SavedCard>;
  } catch {
    return {};
  }
}

/** A card for this company: the one saved here, else the seed card shipped with the app. */
export function cardFor(companyId: string | null | undefined): SavedCard | null {
  if (!companyId) return null;
  const saved = loadLibrary()[companyId];
  if (saved) return saved;
  const seed = Object.entries(seedCards).find(([, c]) => c.company_id === companyId);
  return seed ? { company_id: companyId, title: seed[1].title, saved_at: "", fields: seed[1].fields } : null;
}

export function saveCard(node: FlowNode): SavedCard | null {
  const companyId = node.fields.company_id as string | undefined;
  if (!companyId) return null;
  const fields: Record<string, unknown> = {};
  for (const k of CARD_FIELDS) if (node.fields[k] !== undefined) fields[k] = structuredClone(node.fields[k]);
  const card: SavedCard = { company_id: companyId, title: node.title, saved_at: new Date().toISOString(), fields };
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadLibrary(), [companyId]: card }));
  } catch {
    /* private window: nothing kept */
  }
  return card;
}

export function forgetCard(companyId: string) {
  try {
    const lib = loadLibrary();
    delete lib[companyId];
    localStorage.setItem(KEY, JSON.stringify(lib));
  } catch {
    /* nothing to forget */
  }
}
