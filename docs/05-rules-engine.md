# Rules engine

A pure function. `derive(flow, rules) -> result`. No side effects, no network, fully unit tested against `data/example-copilot-marking.json`. The rules themselves live in `data/rules.json` and are rendered in the app as a readable page so a DPO can challenge and edit them.

## Order of derivation

1. **Tier per data node.** From identifiability, categories and the "about how they're doing" lever. See the tier table below.
2. **Boundary crossings.** Every edge from a node inside the organisation to a company node outside, with the highest tier it carries.
3. **Blocked flows.** Any crossing at or above a tier into a company not marked as a sanctioned route for that tier. Blocked flows render red and stop; they do not generate paperwork.
4. **Screening answers A1 to A17.** Each from a lever or a graph shape, with a "because" sentence built from the lever name and node title.
5. **Screening outcome.** Any yes in A1 to A7 → full DPIA required. Two or more yes in A8 to A17 → required. One yes in A8 to A17 → recommended. None → not required.
6. **Use case floor.** The AI node's use case sets a minimum governance level; the outcome can be raised to meet it, never lowered.
7. **Requirements.** From `requirements.json`: each has a trigger expression over the result so far, an owner role, an effort estimate, and a "what this means for you" sentence.
8. **Risk meter.** Criteria count, highest tier, presence of under-18 subjects, number of crossings, special category. Low / medium / high.
9. **Effort meter.** Count of open requirements, who has to sign (you / DPO / executive), rough time (days / weeks).
10. **Cheapest change.** For each single lever flip that is allowed, re-run 1 to 7 and count requirements removed. Return the flip that removes the most, with what it would cost (the "what you'd give up" text from the lever definition).

## Tier table

| Tier | Meaning | Derivation |
| --- | --- | --- |
| 0 | Nothing personal | identifiability is anonymised or aggregated, and no special category |
| 1 | Account basics | named or pseudonymised, categories only from {name, email, job title, department, login, usage counts}, "about how they're doing" off |
| 2 | About a named person | named or pseudonymised and ("about how they're doing" on, or any category outside the Tier 1 set), no special category |
| 3 | Special category | special category on, or categories include health, SEND, biometrics, safeguarding, criminal |

Pseudonymised data stays at the tier of its content for the DPA question (the supplier still holds personal data) but drops one tier for screening severity. This is a policy choice; it is in `rules.json` as `pseudonymisation_credit` so it can be turned off.

## Tier rules (what each tier may do)

| Tier | Storage and AI | Always required |
| --- | --- | --- |
| 0 | Any tool | Nothing |
| 1 | External allowed with a DPA | DPA card per company, privacy notice coverage |
| 2 | Sanctioned routes only (e.g. Microsoft 365, Power Platform) | DPIA screening, DPA card, privacy notice coverage, retention note |
| 3 | Never leaves organisation systems; no AI | Full DPIA, DPO approval before anything |

The sanctioned list is per organisation and lives in `rules.json` under `sanctioned`.

## Screening questions and their source

| Q | Question (short) | Source in the graph |
| --- | --- | --- |
| A1 | Automated or AI-assisted significant decisions | purpose.decides_alone |
| A2 | Special category or criminal data | any data.special_category |
| A3 | Systematic monitoring | purpose.ongoing and purpose.whole_cohort |
| A4 | Evaluation or scoring, profiling, prediction | purpose.scores |
| A5 | Matching or combining datasets | two or more data nodes with different source systems feeding one purpose |
| A6 | Children or vulnerable | any people.age_mix != all_adults, or people.vulnerable |
| A7 | Breach could endanger physical safety | any data category in {safeguarding, location, health} |
| A8 | AI, ML, generative, innovative | any system.is_ai (locked) |
| A9 | Biometric | any data category biometrics |
| A10 | No privacy notice | not purpose.privacy_notice_linked |
| A11 | Tracking behaviour or location | purpose.tracks_behaviour |
| A12 | Data from a third party | any edge from an external controller into the organisation |
| A13 | Large scale | purpose.whole_cohort or purpose.scale > threshold |
| A14 | Existing data, new purpose | any data.new_purpose |
| A15 | New collection | any data.new_collection |
| A16 | Highly personal nature | any data.free_text_or_audio or categories include genetic |
| A17 | Denial of service | purpose.can_block |

## Use case floor (AI nodes)

| Use case | Minimum governance |
| --- | --- |
| generic templates, no personal data | general AI risk assessment |
| anonymised learner work | approved use case and risk assessment |
| identifiable learner work | DPO approval; screening with the AI block completed |
| formative mark | specific approved assessment use case; full DPIA |
| final grade | full DPIA plus assessment governance sign-off; human decision recorded |
| progression decision | high risk; full DPIA, DPO and executive sign-off, consider ICO consultation |

## Requirement trigger expressions

Expressions are evaluated against the result object. Keep them boolean and readable. Examples (full set in `requirements.json`):

- `full_dpia`: `outcome == "required"`
- `screening_record`: `true` (always)
- `dpa_card`: per company node with role in {processor, sub-processor} and any crossing into it
- `dsa_outline`: per company node with role == joint_controller
- `human_review`: `A1 or A4` (scoring or automated decisions)
- `privacy_notice_line`: `A10 or (A8 and any people node)` (AI use must be told); status `covered` once the purpose says people have been told about this use
- `retention_note`: any company node with keeps_data on, or retention unknown
- `supplier_questions`: any company node with no card
- `transfer_mechanism`: any company node with region not in {UK, EU}
- `children_code`: any data.student_facing and any people with under 18
- `ropa_entry`: `true`

## What the engine never does

- It never scores likelihood or severity of a risk. It generates the starter list; a person scores it.
- It never writes consultation.
- It never declares lawfulness. The result object has `needs_person: [...]` and every document prints it.

## Testing

`example-copilot-marking.json` must derive to: tier 2 on Student work; one crossing (Student work → Microsoft, T2); A4, A6, A8 yes; A10 no (notice linked); outcome required (A6 is in A1 to A7, and three criteria overall); requirements: full_dpia, screening_record, dpa_card (Microsoft, on file), sub_processor_check (OpenAI, covered), human_review, privacy_notice_line (covered, the notice already says so), retention_note, ropa_entry; risk high; effort weeks, DPO; cheapest change: Student work identifiability → pseudonymised, removing full_dpia (outcome drops to recommended because A6 still applies but pseudonymisation credit lowers severity).

If the DPO disagrees with that expected result, change the rules, then the test.

## How it is built (v0.2)

The engine is `src/engine/derive.ts`; the expression language is `src/engine/expr.ts`. Every `when` in `rules.json` and `requirements.json` is a small boolean expression (see `expression_help` at the top of `rules.json`). Code only works out graph facts (what data reaches which node, which wires cross the boundary, who a sub-processor works for); every decision is an expression in the JSON. Run the tests with `npm test`.

Graph facts available to expressions:

- data: `tier`, `screening_tier`, `reaches_ai`, `crosses`
- purpose: `sources`, `source_count` (distinct source systems of the data reaching it)
- company: `receives_tier` (-1 if none), `crossing`, `blocked`, `sends_inside`, `has_card`, `parent_title`, `parent_authorised`, `sanctioned_max_tier`
- wires (blocked rules only): `tier`, `max_tier`, `company`, `data`, `into_ai`, `via_ai`, `ai_approved`, `crosses`
- flow: `A1` to `A17`, `mandatory_yes`, `criteria_yes`, `highest_tier`, `outcome`, `use_case_floor`, `open_count`, `blocked_count`

## Policy choices made to reach the expected result (DPO to confirm)

The worked example's `expected_derivation` could not be met by the rules as first written, so three choices were made. Each lives in `rules.json` and can be changed there.

1. **Pseudonymisation credit lowers the outcome and the floor one step.** With no named data and no A2, A7 or A9, the screening outcome and the AI use case floor each drop one step. Without this, A4 and A6 (both mandatory) keep the outcome at "required" whatever you do to the data, and the formative-mark floor forces a full DPIA anyway.
2. **The AI privacy notice line is triggered by named data going into AI**, not by any AI plus any people: `A10 || (A8 && any(data, identifiability == 'named' && reaches_ai))`.
3. **Anonymising is not offered when the purpose scores people**, because a score has to go back to a person. Otherwise anonymising beats pseudonymising as the cheapest change.

Also changed: pseudonymised data keeps its content tier at the boundary, so it does not clear a Tier 2 wire into a Tier 1 company. The TierFirst mockup says "Pseudonymise the work first" for Canva; under these rules only switching tool (or sending less) clears it. Decide which is right and change `blocked` or the tier rules to match.

## Hard lines and risk ownership (v0.3)

A DPIA rarely says no because nobody defines what a no looks like, and the DPO is advisory by design (Article 38): the controller decides. So the engine separates the two:

- **Hard lines** (`bright_lines` in `rules.json`) are yes/no facts that end a flow early, each with a reason, ways past it and a source: consent where there's a power imbalance, no lawful basis, a less intrusive design exists, a supplier that won't sign or trains on the data, a transfer with no mechanism, rights that can't be honoured. `ico_consult` marks combinations the ICO treats as high risk; if the risk can't be brought down, Article 36 prior consultation applies.
- **Everything else goes to a risk owner** (`flow.risk_owner`, a role). The verdict becomes "Needs someone to own the risk" until one is named, then "{owner} decides, once these are done". The sign-off lines follow the ICO template: measures approved, residual risk accepted, DPO advice accepted or overruled with reasons.
- A check on something already running carries a note that it's late (`notes`).

"No" should be rare. If the hard lines are doing their job, most flows that reach a full DPIA should pass.

## Where it comes from (v0.4)

`data/law.json` holds the legal anchors: for each article (UK GDPR Art. 5, 6, 7, 9, 13, 15, 22, 26, 28, 30, 32, 35, 36, 44, DPA 2018 s.123, the Data (Use and Access) Act 2025) a short reference, what it says in plain words, why it matters to the person, and a link to the legislation. Screening questions, requirements, hard lines and tiers carry a `law` id. The engine attaches the law object to every answer, the rail shows it under each fact, to-do and hard line, and the Record page lists every law used. The ICO and DfE `source` links stay as the guidance on top of the law.

## Partners, new purposes and when the ICO comes in (v0.6)

Run as the MIS manager with a dropout dashboard shared with the council:

- `ico_consult` no longer fires on tracking plus a missing privacy notice. Telling people is a to-do (`privacy_notice_line`), not a reason to consult the regulator; the ICO's own line is high risk that a DPIA can't bring down. It still fires on automated decisions that can block children or vulnerable people, and on biometrics of children.
- `new_purpose_check` is a requirement when A14 is yes: using data you already hold for a new reason needs a written compatibility judgement, and usually a line in the privacy notice. It cites the ICO's purpose limitation guidance.
- A company with the role joint or independent controller is a partner, not a supplier: the story says "shared with", the pack gives it a sharing agreement instead of Article 28 terms, and the supplier questions are not sent to it. Picking either role turns "decides the purpose" on, since that is what the role means.
- Requirement causes are phrased so that one or many titles read the same ("there's personal data in X", "a copy stays with X and Y").

Run as the IT director of a trust with a parent app built on Lovable (v0.6, continued):

- Contact details lock `identifiability` to named (`locks` in `rules.json`): an email or phone number identifies someone by itself, so the "names on it?" question is not asked about names and contact details. Student work with names on it is not locked; coding it is the whole point there.
- A blocked wire's "send less" way out names every data item over the allowed level, not only the highest one.
- The under-13 consent line no longer tells people to get parental consent as if that settled it; the imbalance of power still has to be answered.

## Level 3: a gate, not a wall (v0.7)

Policy choices, made after the roleplays; both live in `rules.json` and `requirements.json`, not code.

- **The Microsoft tenant takes Level 3.** `sanctioned.microsoft` and `power_platform` go to `max_tier: 3`, since health, SEND and safeguarding records already live in SharePoint, Teams and Outlook. `tier3_leaves` now blocks only a processor whose limit is below 3; a partner sharing Level 3 needs the sharing agreement to say so, and the policy line says that.
- **Level 3 into AI is a sign-off, not a block.** `tier3_ai` is gone. In its place `level3_ai_signoff` is a requirement whenever Level 3 data reaches an AI system: the DPO's advice and the risk owner's written sign-off, on an approved route. An AI route that isn't approved for personal data is still blocked by `ai_not_approved`.
- **An Article 9 condition is always asked for.** `art9_condition` is a requirement whenever A2 is yes: which Article 9(2) condition applies, usually with a DPA 2018 Schedule 1 condition and the appropriate policy document on file. A person picks it; the tool never guesses.

## Five more people (v0.8)

A SENCO in free ChatGPT, HR in Power BI, a sixth form display in Canva, a charity's volunteer list by email, and lesson plans in Gemini. What they changed:

- **Consent can hold when saying no costs nothing.** The legal reason question now splits consent in two: "could say no with nothing lost" sets `consent_free` on the data, and `consent_imbalance` only fires without it. A photo for a display or a newsletter is the everyday case; being marked by AI is not.
- **Tier 2 has two reasons.** "Says how a named person is doing" and "holds more than account basics about a named person" (photos, essays) are separate rules, so the tier note no longer says a photo is about performance.
- **Anonymising is not offered for images, video or biometrics.** A face is not anonymous without a name on it.
- **DBS or criminal record information** is a data choice in the sentence, tier 3 by category.
- A product name that starts with "A" or "An" reads in lower case mid-sentence.

## Why each level (v0.9)

`tiers[n].basis` in `rules.json` carries the evidence for each level: the law ids it rests on, the guidance ids, the sentence that is this organisation's own choice, the harm the level guards against, and where it sits in a public, internal, confidential and restricted scheme. `tiers_about` holds the argument for having levels at all and the two known limits. The Rules page renders it under "Why each level"; the DPO page of the pack prints the note for each level in use. `law.json` gained Recital 26, Article 4, Article 10 and the Protection of Freedoms Act s.26 to anchor Levels 0, 1 and 3.

The copy across the questions, rules, requirements, guides and screens was also rewritten in one register: plain, direct, and professional. The engine is unchanged; answer labels changed, so a flow saved before this version shows its old answer text in the record.

## Sitting beside someone (v0.9, continued)

Three runs with a facilitator in mind: changing their mind mid-way, comparing two tools, and finishing. What they changed:

- Switching the tool on the canvas replaces the old tool's company and sub-processors instead of leaving them wired in; the story and the hard lines follow the new tool.
- Compare leads with the answer and the hard lines, then the to-do count.
- A new data box offers the sentence's kinds as a one-click pick, which names it and sets its switches.
- "T2" reads as "Level 2" on wires and cards; asking for the answer no longer produces a "What that changed" box.
- Check it pauses for under two seconds and narrates what was read, with real counts, before the answer lands.
