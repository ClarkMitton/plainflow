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
