# Flow-first DPIA and DPA template

This is the paper form of the canvas. Every question is answered by a node, a lever or an edge, so the canvas can generate the document and a person can still fill it by hand. It keeps the common UK structure (Part A screening, then a full DPIA following the ICO seven steps) so a DPO sees a familiar document. The "Answered by" column is also the specification for the node types.

Three things differ from a standard template:

1. The flow comes first. The story sentence, the diagram and the tier are recorded before any screening question, because the screening depends on them.
2. One DPA card per external company. Standard forms ask "has a DPA been put in place" once for all suppliers. Here each processor, joint controller and sub-processor gets its own card with the Article 28 checklist and evidence.
3. AI has its own block. Each AI node answers retention, training, override, validation and fairness separately.

## Part 0: The flow

| Row | Question | Answered by |
| --- | --- | --- |
| 0.1 | Owner, accountable executive, contact, version | Document header |
| 0.2 | The story sentence: A [role] puts [data] into [system] run by [company] to [purpose] | Story builder |
| 0.3 | Data flow diagram: boundary, every node, every edge | Canvas export (image and JSON) |
| 0.4 | Data subjects (staff, under 18, adults, parents, external) | People nodes |
| 0.5 | Categories of personal data | Data node category list |
| 0.6 | Identifiability: named, pseudonymised, anonymised, aggregated | Data node lever |
| 0.7 | Is any of it about how a named person is doing? | Data node lever |
| 0.8 | Tier (0 to 3) and the rule that follows | Derived |
| 0.9 | Value: what this achieves | Purpose field |
| 0.10 | Could it be done another way with less personal data? | Purpose field; pin-and-compare answers it with evidence |
| 0.11 | Should it be done at all? Risk versus reward in one sentence | Purpose field |
| 0.12 | Timeline: launch or running since, review date | Purpose dates |

## Part A: Screening

Seventeen questions (ICO list plus the European nine). Any yes in A1 to A7 requires a full DPIA; two or more in A8 to A17 requires one; one in A8 to A17 recommends one. The canvas answers each from a lever and writes the "because"; a person can overwrite.

| Q | Question (short) | Answered by | Default |
| --- | --- | --- | --- |
| A1 | Automated, AI-assisted or similarly significant decisions | Purpose: decides without a human | No |
| A2 | Special category or criminal offence data | Data: special category | No |
| A3 | Systematic monitoring | Purpose: ongoing and whole cohort | No |
| A4 | Evaluation or scoring, profiling, prediction | Purpose: scores or ranks | No |
| A5 | Matching or combining datasets | Two data nodes from different sources into one purpose | Derived |
| A6 | Children or vulnerable individuals | People: age mix or vulnerable | Yes if learners (locked) |
| A7 | A breach could jeopardise physical safety | Data: safeguarding, location or health category | No |
| A8 | AI, ML, generative or innovative technology | Any AI node | Yes if AI (locked) |
| A9 | Biometric data | Data: biometrics category | No |
| A10 | No privacy notice | Purpose: covered by a notice (inverted) | Yes until linked |
| A11 | Tracking location or behaviour | Purpose: tracks behaviour | No |
| A12 | New data from a third party | Edge from an external controller inwards | Derived |
| A13 | Large scale | Purpose: whole cohort or scale over threshold | No |
| A14 | Existing data, new purpose | Data: new purpose | No |
| A15 | New collection | Data: new collection | Derived |
| A16 | Highly personal nature | Data: free text or audio, or genetic | No |
| A17 | Denial of service | Purpose: can block | No |

### Screening outcome

| Row | Outcome | Answered by |
| --- | --- | --- |
| A.O1 | Any yes in A1 to A7? | Derived |
| A.O2 | Two or more yes in A8 to A17? | Derived |
| A.O3 | One yes in A8 to A17? | Derived |
| A.O4 | Full DPIA required? Rationale | Derived; lists triggering questions and the lever that set each |
| A.O5 | If no DPIA: has the relevant DPA been reviewed? | Links to Part B cards |
| A.O6 | If no DPIA: have security risks been assessed? | Links to the security row on each card |
| A.O7 | Cheapest change that would remove the requirement, if any | Derived, shown as a suggestion |

## Part B: One DPA card per external company

Filled once per company and reused. Sub-processors get a short nested card.

### B1 Role

| Row | Question | Answered by |
| --- | --- | --- |
| B1.1 | Company, service, contract reference | Company fields |
| B1.2 | Role for this flow: processor, joint controller, independent controller, sub-processor | Company lever (one role per flow) |
| B1.3 | Who decides purpose and means? | Company levers |
| B1.4 | Does the supplier use the data for its own purposes? | Company lever; yes moves the role to joint or independent |
| B1.5 | Parent company and whether its DPA authorises this sub-processor | Sub-processor edge |

### B2 Article 28 contract checklist

Ticked against evidence (clause number or link), not on trust.

| Row | Term | In practice |
| --- | --- | --- |
| B2.1 | Processing on documented instructions only | Only for the agreed purpose |
| B2.2 | Confidentiality | Staff and contractors bound |
| B2.3 | Security measures | Appropriate technical and organisational measures |
| B2.4 | Sub-processor authorisation | Must get authorisation and list them |
| B2.5 | Assistance with individual rights | Helps answer SARs and requests |
| B2.6 | Breach assistance | Helps investigate and report |
| B2.7 | DPIA assistance | Provides information when asked |
| B2.8 | Deletion or return at end of contract | As instructed, subject to legal retention |
| B2.9 | Audit and evidence of compliance | Evidence can be obtained, audits arranged |

For a joint controller this table is replaced by the Article 26 arrangement: who answers to data subjects, who handles rights requests, how the arrangement is published.

### B3 Hosting, transfers, retention and AI terms

| Row | Question | Answered by |
| --- | --- | --- |
| B3.1 | Where is the data hosted and processed? | Region field |
| B3.2 | Any transfer outside the UK and under what mechanism? | Derived from B3.1 |
| B3.3 | How long are prompts, uploads, outputs and logs kept? | Retention field |
| B3.4 | Does the supplier train models on inputs? Contractually excluded? | Trains on inputs lever |
| B3.5 | Can the organisation delete on demand, and how? | Deletion route field |
| B3.6 | Supplier security assessment completed and accepted? | Security assessment field |
| B3.7 | Is this a sanctioned route for this tier? | Derived |

### B4 Card status

| Row | Status | Answered by |
| --- | --- | --- |
| B4.1 | DPA on file: yes, partial, no | Derived from B2 |
| B4.2 | Covered by an existing signed-off DPIA? | Prior DPIA link |
| B4.3 | Owner and next review date | Fields |
| B4.4 | Open actions | Derived |

## Part C: AI block, one per AI node

| Row | Question | Answered by | Governance it triggers |
| --- | --- | --- | --- |
| C1 | What goes in, at what identifiability? | Edges into the AI node | Tier rule |
| C2 | What comes out: draft, suggestion, score, decision? | Output type lever | Score or decision raises A4 or A1 |
| C3 | Retains submissions, prompts, outputs? For how long? | Company card B3.3 | Retention note |
| C4 | Trains on inputs? | Company card B3.4 | Contractual exclusion |
| C5 | Could it work on pseudonymised or anonymised input? | Identifiability lever, tested with compare | Minimisation evidence |
| C6 | Who validates the output before use? | Validated by a person lever | Human oversight |
| C7 | Can staff override every output? | Override lever | DUAA human review |
| C8 | Tested for accuracy on the organisation's material? | Testing field | Accuracy |
| C9 | Checked for fairness (SEND, EAL, protected characteristics)? | Fairness field | Bias, PSED |
| C10 | Are people told AI is used, how, and how to challenge it? | Privacy notice link and challenge route | DUAA transparency |
| C11 | Sanctioned route for this tier? | Derived | Bright-line rule |
| C12 | Which approved use case? | Use case picker | Sets the governance floor |

### Use case ladder

| Use case | Minimum governance |
| --- | --- |
| Generic templates, no personal data | General AI risk assessment |
| Anonymised learner work | Approved use case and risk assessment |
| Identifiable learner work | DPO approval; screening with Part C completed |
| Formative mark | Specific approved assessment use case; full DPIA |
| Final grade | Full DPIA plus assessment governance sign-off; human decision recorded |
| Progression decision | High risk; full DPIA, DPO and executive sign-off, consider ICO consultation |

## Part D: Full DPIA (only if required)

| Step | ICO step | Pre-filled from | Person writes |
| --- | --- | --- | --- |
| D1 | Identify the need | Part A outcome and rationale | Nothing |
| D2 | Describe the processing | Parts 0, B, C | Context: relationship with individuals, expectations, prior concerns |
| D3 | Consultation | Nothing | Who was consulted internally, externally, and whether data subjects were asked |
| D4 | Necessity and proportionality | Lawful basis, notice, minimisation evidence from compare, retention, rights | Why less data wouldn't do; Article 9 conditions if A2 |
| D5 | Identify and assess risks | Starter list: one row per yes in Part A, per open card action, per unticked oversight lever | Likelihood and severity, plus risks the canvas can't see |
| D6 | Measures to reduce risk | Suggested measures from the levers with their effect in compare | Which are adopted, residual risk, acceptance |
| D7 | Sign off | Part E | DPO advice, risk owner acceptance, ICO consultation decision |

Risk table columns: risk to individuals, source (trigger or card), likelihood (remote, possible, probable), severity (minimal, significant, severe), overall, measure, residual.

## Part E: Sign-off chain and review

| Outcome | Who signs | Also notified |
| --- | --- | --- |
| No DPIA, Tier 0 or 1, sanctioned route | Flow owner | DPO for the record |
| No DPIA but a new supplier card | Flow owner and DPO | IT |
| Full DPIA required | Flow owner, DPO advice, business risk owner | Accountable executive |
| Residual high risk remains | As above plus ICO consultation before processing | Executive and board as policy requires |

| Row | Record | Answered by |
| --- | --- | --- |
| E1 | DPO advice summary | Typed |
| E2 | Does the ICO need to be consulted? | Typed; forced yes if D6 residual risk is high |
| E3 | Risk owner | Typed |
| E4 | Accepted by the business risk owner, with date | Typed |
| E5 | Next review date | Defaults to one year |
| E6 | What triggers an earlier review | Derived: any lever change on a triggering node reopens the screening |

A saved flow keeps its sign-off state. If a lever later changes, the document is marked stale and the affected rows are listed, so a change reopens exactly the questions it touches.
