# Plainflow

A node-canvas tool for building data flow diagrams with someone sitting beside you, which derives the DPIA screening, the DPA position for every company involved, and the whole document pack from the picture. Personal project, UK GDPR, built for people who don't know what they need to do.

## Read first

1. `README.md` for the one-page pitch and the build order.
2. `docs/01-concept-and-users.md` for who it's for and what they leave with.
3. `docs/05-rules-engine.md` and `data/rules.json` before touching any logic. The rules are the product; the canvas is the easy part.
4. `docs/03-design-system-a5.md` before touching any UI. The look is settled (A5, "Swiss"). Don't reinvent it.

## Non-negotiables

- Every requirement shown to a user must say which lever or edge caused it, and link to its source (ICO, DfE, the LDI tier rule). No unexplained red.
- The tool never claims a flow is lawful. It says "screening complete, here is what still needs a person". Full DPIA steps 3, 5 and 6 (consultation, risk scoring, measures) are always human.
- The rules live in `data/rules.json`, never in component code. A DPO must be able to edit the table without reading code. The app renders the rules table as a page.
- No real names in any free-text field. The canvas itself stays Tier 0. Validate every text input for name-like content and warn.
- Both directions must work: flow first (build, tier derived) and tier first (pick tier, palette constrained). Same engine, tier is input or output.
- No em dashes in any copy. Plain English on every lever: one sentence and one example.

## Stack (intended)

React + React Flow (xyflow) for the canvas. Flow state is one JSON document (`data/schema.flow.json`). Rules engine is a pure function `derive(flow, rules) -> {tier, triggers, requirements, risk, effort, cheapestChange}` with no side effects and full unit tests against `data/example-copilot-marking.json`. Documents are templates over the same JSON. Persistence can start as download/upload JSON; Supabase later if needed.

## Working style

- JSON wherever possible. Seed data, rules and the product directory are JSON files, not hard-coded.
- When you add a document to the pack, add it to `data/requirements.json` and write a template; don't special-case it.
- When you add a lever, add it to `docs/04-node-and-lever-spec.md` and to `data/rules.json` in the same change.
