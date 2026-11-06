# The pack

The pack is what the person leaves with. Every document is a template over the same flow JSON, so they always agree with each other. Each one carries a "still needs a person" box where the canvas cannot answer. Machine-readable version: `data/requirements.json`.

## Fully filled from the canvas

| Document | For whom | Filled from |
| --- | --- | --- |
| One-page summary | The person with the idea | Story, diagram, verdict (go / go once / not like this), the safer version and what it gives up |
| Action plan | The person with the idea | Every open requirement as a numbered step with owner and rough effort |
| DPIA screening record | DPO | All 17 answers with their "because", outcome, cheapest change |
| Data flow diagram | DPO, the DPIA | Canvas export as image and JSON |
| DPA card per company | DPO, procurement | Role, Article 28 checklist with evidence links, sub-processors, hosting, retention, status |
| Record of processing entry | DPO | Purpose, categories, subjects, recipients, retention, lawful basis |
| Retention schedule line | DPO, IT | What is kept, where, how long, who deletes |
| Tier decision note | DPO, owner | Tier, derivation, the rule that follows |

## Drafted, a person finishes

| Document | For whom | Left for a person |
| --- | --- | --- |
| Full DPIA | DPO | Consultation, risk scoring, measures adopted, sign-off |
| Privacy notice paragraph | Students, parents, customers | Wording approval |
| Human review procedure | The team running it | Named people |
| Supplier question sheet | The vendor | Sending it |
| Lawful basis statement | DPO | Legitimate interests reasoning if chosen |
| Transfer mechanism note | DPO | Confirming the mechanism is in place |
| Children's code check | DPO | Answers |
| Data sharing agreement outline | A joint controller | The agreement itself |

## Rules for the pack

- Export is one zip or one combined PDF, with DOCX for anything the DPO will edit.
- Change a lever and every document regenerates. Documents are never edited in place; the flow is.
- Each document prints the "still needs a person" list from the derivation result.
- Build in the order of the first table, then the second. The top rows need no judgement.
- Every requirement in the rail shows three things beside it: what it means in one sentence, who does it, and roughly how long. Otherwise "Full DPIA" reads as "no".

## As built (v0.6)

The Finish tab (`src/ui/Pack.tsx`, data from `src/ui/packBuild.ts`) produces three sheets from the one derivation, so they always agree:

1. **For the person with the idea:** the verdict in plain words, the three facts with the law behind them, hard lines with ways past them, the easier version with its cost, a numbered action plan (what, who, how long, why, law), and what still needs a person.
2. **For the DPO:** data and levels, the 17 screening answers with reasons and law, where personal data goes, one card per outside company (role, plan, contract position, hosting, retention, Article 28 evidence, open actions, supplier questions if there's no card), what was asked and what was assumed, and the law list.
3. **For next time:** what was agreed, what to bring (supplier answers, missing Article 28 evidence, retention and hosting unknowns, a risk owner), what was assumed, and the session's changes.

Print to PDF (each sheet on its own page), "Copy as text" for an email or Teams message, and "Save the file" for the picture. Company cards can be saved from the drawer into a library in the browser (`src/ui/cardLibrary.ts`), and a new company node picks the saved card up next time. The one-page summary and action plan are the first sheet; the screening record, DPA cards and supplier question sheet are the second; the RoPA entry, retention note and tier note are still to be drafted as their own documents.
