# Plainflow

Sit next to someone, draw what they want to do with data, and watch the paperwork work itself out.

## What it is

A node canvas with five node types (people, data, purpose, system, company) and one edge type. Each node has a few clickable levers. A rules engine reads the graph and produces:

- the data tier (0 to 3) of every data node, and the rule that follows from it
- the DPIA screening answers (17 questions) with a "because" for each
- the screening outcome (no DPIA, recommended, required) and the triggers
- one DPA card per company outside the organisation, with the Article 28 checklist
- the full pack of documents (see `docs/07-the-pack.md`)
- two meters (risk to people, effort to do it) and the single cheapest change

Flip a lever and everything updates. Pin version A, try version B, compare.

## Who it's for

1. The person with the idea. Leaves with a plain verdict (go, go once these are done, not like this) and an action plan.
2. The person sitting beside them (the governance lead). Leaves with the flow saved and the pack generated.
3. The DPO. Leaves with a screening they'd sign and evidence for every supplier.

## Folder

```
CLAUDE.md                     instructions for Claude Code
README.md                     this file
docs/
  01-concept-and-users.md     who, jobs, what they leave with
  02-success-criteria.md      how we'd know it works, and how it fails
  03-design-system-a5.md      colours, type, borders, shadows, wires, components
  04-node-and-lever-spec.md   every node type, lever, field, derived chip
  05-rules-engine.md          how derivation works, in order
  06-dpia-template.md         the flow-first DPIA and DPA template (the paper form of the canvas)
  07-the-pack.md              every document the canvas produces
  08-gaps-and-backlog.md      gaps from the user walkthrough, as a backlog
  09-build-plan.md            build order and milestones
  10-sources.md               ICO, DfE and legal references used
data/
  schema.flow.json            JSON Schema for a saved flow
  example-copilot-marking.json  the worked example used on every mockup
  rules.json                  tier derivation, screening triggers, requirements, locks
  requirements.json           the document catalogue
  products.json               product directory seed (product -> company -> sub-processors)
  questions.json              the plain-English Q&A that sets levers before the flow is drawn
  glossary.json               plain meanings for jargon, shown on hover wherever the word appears
  cards.json                  shared company cards (filled once, reused by every flow)
  tools.json                  sibling tools linked from the front door (the GDPR Repo Scanner)
  examples/                   a real scanner report, used as a test fixture
mockups/
  Master.html                 A5, flow first, the main canvas
  TierFirst.html              A5, tier first
  CompanyCard.html            A5, a company node opened
  Compare.html                A5, pin A / try B
  PaperA5.html                the chosen theme on the original layout
  PaperTypes.html             colour by node type, which A5 inherited
  Paper.html                  the base Paper theme
  Transit.html, Rack.html     two rejected concepts kept for reference
```

The mockups are static HTML. Open them in a browser. They were drawn on a design canvas and converted, so expect minor overlaps; they are references for layout and style, not pixel specs.

## Opening a code scan

The GDPR Repo Scanner (github.com/ClarkMitton/Node-TypeScript-API) reads an app's code and reports where personal data goes. Save its JSON report and open it on the front door: `src/ui/scanImport.ts` turns the report into a flow (the app as the system, each service as a company, each kind of data it saw as a data node), the Q&A asks what code can't tell, and the canvas gives the same answer it gives a sentence. Set the scanner's live address in `data/tools.json`.

## Running it

```
npm install
npm run dev      # the app, at http://localhost:5173
npm test         # the rules engine against the worked example
```

The product name lives in one place, `src/ui/brand.ts`.

## Build order (short version)

1. Rules engine as a pure function, tested against the example flow. No UI.
2. Product directory and company cards. This is where value compounds.
3. Canvas with the five node types, levers, and the requirements rail.
4. Sentence builder and the front door (new idea / check existing tool / open saved).
5. Pin and compare.
6. Pack generation, top of the table first (screening, diagram, DPA cards, RoPA entry).
7. Flow status, owner, change log, review reminders.

Full detail in `docs/09-build-plan.md`.
