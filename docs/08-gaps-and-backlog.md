# Gaps and backlog

Found by walking the canvas through as a teacher who wants Copilot to mark essays. Each is a backlog item. Priority: P1 before first real use, P2 before sharing with a DPO, P3 later.

| P | Gap | What is needed | Where it lands |
| --- | --- | --- | --- |
| P1 | Blank start | Front door with three modes: new idea, check something we already use, open a saved flow. Existing tools have no launch date; retrospective mode asks "running since" | Front door |
| P1 | Who runs this product? | Product directory (`products.json`): pick Copilot and Microsoft plus OpenAI come with it. Unknown product produces the supplier question sheet immediately | System and company nodes |
| P1 | "Named" is jargon | Ask "will their names be on it?" and allow "and ___" in the sentence so work, grades and support notes become separate data nodes | Story builder |
| P1 | Levers are legal words | One plain sentence and one example on hover for every lever (in `04-node-and-lever-spec.md`) | All nodes |
| P1 | "Full DPIA" reads as no | Beside every requirement: what it means, who does it, roughly how long (in `requirements.json`) | Rail and action plan |
| P1 | The tool's own data | No real names in any free-text field; name-like input warns. The canvas stays Tier 0 | Validation |
| P2 | Mixed ages | "Some are under 18" rather than a lock; FE and adult cohorts are mixed | People node |
| P2 | More than one subject | Students and staff in one flow screen differently | People node, several allowed |
| P2 | Lawful basis | Picker in plain words with a default by organisation type | Data node |
| P2 | Partners, not suppliers | Joint controllers need a data sharing agreement, not an Article 28 DPA | Company role |
| P2 | No AI at all | A spreadsheet emailed to a partner is a flow; nothing may assume AI (`spreadsheet_email` product) | Rules |
| P2 | "On file" is not evidence | Attach or link the DPA on the company card | Company card |
| P2 | How do I pseudonymise? | A short "how" beside the cheapest change | Readout |
| P2 | What happens after export? | Flow status (draft, with DPO, approved, live, review due), named owner, list of flows waiting on the DPO | Flow record |
| P2 | Trust | Change log; a lever change reopens only the rows it touches and marks documents stale | Flow record |
| P3 | Students use it directly | Student-facing toggle raises the Children's Code questions | Data node |
| P3 | Non-UK hosting | Transfer mechanism question for US vendors | Company card |
| P3 | Review reminders | Review date on flows and cards; a list of what's due | Flow record |
| P3 | DPO inbox | A view of flows with status "with DPO", oldest first | DPO view |
| P3 | Templates | Common starting flows (AI marking, Power BI dashboard, app on Lovable, sharing with a partner) | Front door |
| P3 | Rules page | The rules table rendered readably, with the DPO able to propose edits | Settings |

## Things deliberately out of scope

- Scoring risk likelihood and severity for people.
- Writing consultation.
- Declaring lawfulness.
- Being a general whiteboard: no free-form shapes, no node without a rule.
