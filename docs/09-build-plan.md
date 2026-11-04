# Build plan

## Stack

- React, TypeScript, React Flow (xyflow) for the canvas, Zustand or plain context for state.
- One JSON document per flow (`data/schema.flow.json`). Start with download/upload. Add Supabase later only if sharing between people is needed.
- Rules engine as a pure module with no React imports. Vitest tests against `data/example-copilot-marking.json` and its `expected_derivation`.
- Documents as templates (Markdown or HTML) over the derivation result; export to PDF via print stylesheet first, DOCX later.
- Styling from `03-design-system-a5.md`. CSS variables for the colour table. No component library.

## Milestones

### M1 Engine (no UI)

- `derive(flow, rules)` implementing `05-rules-engine.md` in order.
- Tests: the example flow derives to its `expected_derivation`. Then three real past assessments rebuilt as flows, expected outcomes agreed with the DPO.
- Rules page: render `rules.json` as a readable table. This is also how you review the rules with the DPO.

Done when: all three real rebuilds match.

### M2 Product directory and company cards

- Load `products.json`. Pick a product, get the company and sub-processors.
- Company card UI (the `CompanyCard.html` mockup): role switch, Article 28 checklist with evidence fields, hosting, retention, sub-processors, status, open actions.
- Cards are shared across flows by `company_id`; role is per flow.
- Supplier question sheet generated for unknown products.

Done when: Microsoft, Lovable, Supabase and Canva cards exist and are reused by two flows.

### M3 Canvas

- Five node types with the levers from `04-node-and-lever-spec.md`. Hover text on every lever.
- Right-angle edges, personal-data edges in amber, boundary line, zone tint.
- Requirements rail driven by the derivation, each row with meaning, owner, effort, and the lever that caused it.
- Readout with the two meters and the cheapest change, with hover preview (ghost strike-through in the rail).
- Blocked flows render red with the explanation box and the two ways out.

Done when: the `Master.html` mockup is reproduced live from the example JSON.

### M4 Front door and story builder

- Three modes: new idea, check something we already use, open saved.
- Sentence builder with slots; each slot creates a node; "and ___" adds data nodes.
- Tier-first mode: tier picker, palette constrained, `TierFirst.html`.
- Name-like input validation on every text field.

### M5 Compare

- Pin as A (snapshot in `flow.pinned`). Edit. Compare view as `Compare.html`: changed levers ringed, removed requirements struck, deltas in big type, keep A or go with B.

### M6 Pack

- Templates for the fully-filled documents first: one-page summary, action plan, screening record, diagram export, DPA cards, RoPA entry, retention note, tier note.
- Then the drafted ones.
- Print stylesheet to PDF. Zip export. DOCX when the DPO asks for it.

### M7 Lifecycle

- Status, owner, change log, review dates. A lever change marks documents stale and lists reopened rows.
- DPO list of flows waiting.

## Test with real people

After M3: five people, five real ideas, no coaching. Does the derived tier match what the governance lead would say? Four of five is the bar.

After M6: three real flows through the DPO. Minor edits only, or fix the rules.
