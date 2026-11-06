# Node and lever spec

Five node types and one edge type cover the whole DPIA template. Levers are the clickable switches on the node face (three or four at most). Fields open in a side drawer. Derived values are computed and shown as chips, never edited. Every lever has one plain sentence and one example, shown on hover and in the drawer.

## People (data subject)

| Lever | Plain sentence | Example | Default |
| --- | --- | --- | --- |
| age mix: adults / 16 to 18 / under 16 / under 13 | Are any of the people this is about under 18, and how young? Every under-18 is a child in law; under 13 they can't consent to an online service themselves (DPA 2018 s.9), which is a hard line when consent is the basis | A Level 3 class with 16 and 19 year olds is "16 to 18"; a Year 6 class is "under 13" | 16 to 18 for students |
| vulnerable | Are they in a position where they can't easily say no or understand what's happening? | Learners, patients, people in care | on for students, patients |

Fields: group description (no names), rough size.
Derived: A6 (children or vulnerable) answered; locks shown with a reason.
Several People nodes allowed; students and staff in one flow screen differently.

## Data

| Lever | Plain sentence | Example | Default |
| --- | --- | --- | --- |
| identifiability: named / pseudonymised / anonymised / aggregated | Can you tell who someone is from this? | "Named" has their name on it; "pseudonymised" uses a code you can look up; "anonymised" nobody can look up; "aggregated" is totals only | named |
| about how they're doing | Does it say anything about a named person's performance, progress, behaviour or needs? | Marks, attendance, support notes | off |
| special category inside | Does it reveal health, ethnicity, religion, sexual orientation, union membership, biometrics, or criminal matters? | SEND notes, a sick note, a dietary requirement that reveals religion | off |
| free text or audio | Does it include open text or recordings where anything could be written or said? | Essays, meeting recordings, comments boxes | off |
| already held, new purpose | Did you already have this data for a different reason? | Attendance data now used to predict dropout | off |
| new collection | Are you collecting something you didn't collect before? | A new form, a new login | off |
| student-facing | Will the people it's about use the tool themselves? | A revision app students log into | off |

Fields: category tick list (name, email, DOB, address, grades, attendance, SEND, health, images, location, free text, audio, video, biometrics, financial, safeguarding), source system, lawful basis (picker: public task, legal obligation, contract, consent, legitimate interests, vital interests; default by organisation type).
Derived: tier (0 to 3), A2, A5 (with other data nodes), A7, A9, A14, A15, A16.

## Purpose

| Lever | Plain sentence | Example | Default |
| --- | --- | --- | --- |
| scores or ranks people | Does it produce a mark, grade, score, rank or prediction about a person? | A suggested grade, a risk score, a "likely to pass" flag | off |
| decides without a human | Could the outcome happen with nobody checking it? | An automatic fail, an automatic referral | off |
| staff can override | Can a person change every output before it counts? | A teacher can alter any suggested mark | on |
| ongoing, not one-off | Does it keep running rather than happen once? | Weekly monitoring vs one survey | off |
| whole cohort | Does it cover everyone in a large group? | All students in a college vs one class | off |
| tracks behaviour by person | Does it log what individuals do, where they are, or what they click? | Login times per student, location, browsing | off |
| can block access or a right | Could it stop someone getting a service or exercising a right? | Blocking enrolment, denying an extension | off |
| covered by a privacy notice | Have the people been told about this use, somewhere they'd see it? | A line in the student privacy notice | off until a notice is linked |

Fields: value (what it achieves), alternatives (could it be done with less data), should it be done at all (one sentence), dates (launch or "already running since"), scale, challenge route (how someone contests an outcome).
Derived: A1, A3, A4, A10, A11, A13, A17, screening outcome, cheapest change, use case floor.

## System (AI variant)

| Lever | Plain sentence | Example | Default |
| --- | --- | --- | --- |
| is AI | Does it use AI, machine learning or generative models anywhere? | Copilot, AI Builder, a model behind an app | off |
| output type: draft / suggestion / score / decision | What does it hand back? | A draft email; a suggested mark; a score; a pass/fail | suggestion |
| validated by a person | Does someone check the output before it's used? | A teacher reads the feedback before it goes out | on |
| staff can override | Can a person change any output? | | on |
| plan: free / business / enterprise | Which plan is this tool on? The same product is a different thing on each. | Free ChatGPT trains on chats and has no contract; ChatGPT Business doesn't and does | free (shown only when the product has plans in `products.json`) |

Fields: product (from the directory; sets the company and sub-processors), use case (generic templates / anonymised work / identifiable work / formative mark / final grade / progression decision), testing record (date, sample, result), fairness check (SEND, EAL, protected characteristics).
Derived: A8 locked on when is AI; use case floor; C1 to C12.

## Company

| Lever | Plain sentence | Example | Default |
| --- | --- | --- | --- |
| role: processor / joint controller / independent controller / sub-processor | Who decides what happens to the data? | Microsoft running Copilot on your instructions is a processor; a partner school you share with is joint | processor |
| decides the purpose | Does this company choose why the data is used? | | off |
| decides the means | Does this company choose how it's processed? | | off |
| uses it for its own purposes | Does it use your data for product improvement, analytics or marketing? | Free tiers often do | off |
| trains on inputs | Could your data be used to train their models? | | off |
| keeps data after use | Do they retain prompts, uploads, outputs or logs? | 30 day log retention | off |
| sanctioned route | Is this company on the approved list for this tier? | | derived from the sanctioned list |

Fields: region (UK / EU / US / other), transfer mechanism (adequacy / IDTA / addendum / none), retention period, deletion route, security assessment (status, date), Article 28 evidence per clause (clause ref or link), DPA document link, prior DPIA link, owner, review date, sub-processors (edges to child company nodes).
Derived: DPA status (yes / partial / no), open actions, A12 (data arriving from an external controller), B3.7.
Role per flow: the same company can be a processor in one flow and a controller in another. The card is shared; the role is on the edge.

## Edge (flow)

Properties: which data node travels, direction, crosses boundary (derived from endpoints).
Derived: tier badge at the crossing (highest tier carried), A5 (two data nodes from different sources into one purpose), A12, B1.5 (sub-processor link).

## Locked levers

Shown with the value and "locked" plus a reason, never hidden:

- People: vulnerable is locked on for learners, patients, people in care.
- System: A8 innovative technology is locked on when is AI is on.
- Company: sanctioned route is derived from the list, not toggled.

## Collapse levels

- Pill: title and kind only (the story word).
- Standard: levers on the face.
- Detail: drawer content inline (Article 28 clauses, fields). See `mockups/CompanyCard.html`.
