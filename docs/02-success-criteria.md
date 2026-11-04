# Success criteria

## Measure these

| Criterion | Target | How to test |
| --- | --- | --- |
| A non-specialist can build their own flow from the sentence builder without help, and the derived tier matches what the governance lead would have said | 4 of 5 people | Five people, five real ideas, no coaching |
| Time from "I've got an idea" to a screening the DPO accepts | One sitting, down from weeks | Log the first ten real flows |
| The DPO accepts the generated screening with no more than minor edits | First three real flows | If they rewrite it, the rules table is wrong, not the person |
| Company cards get reused | By the tenth flow, more than half the companies on it already have a card | Count |
| People change their design because of the tool | The pseudonymise lever gets pulled in real sessions; flows go live with less personal data than first drawn | Compare pinned A to shipped B |
| The DPO trusts the rules enough to edit the rules table themselves | At least one edit made by the DPO, not the builder | Change log |
| The rules engine reproduces past decisions | Rebuild three real past assessments; outcome matches the DPO's in all three | Do this before building any UI |

## The sharpest test

Take three real past assessments. Rebuild them on the canvas. If the engine reaches the same outcome the DPO did, the tool earns its place. If not, you've found the rules that need fixing, which is cheaper to find now than in production.

## How it fails

- **False confidence.** A green light from a rules engine isn't legal advice. Every output carries a "still needs a person" box. The honest message is "screening complete, here is what still needs judgement".
- **The rules are the product.** If the trigger table is wrong or stale, everything downstream is wrong and looks authoritative. The table needs an owner and a review date like any policy, and it is rendered as a readable page in the tool.
- **Scope creep into a full DPIA tool.** Keep it at screening, DPA cards, the diagram and the pack. Don't try to score risk for people.
- **Stale company cards.** Supplier terms change. Every card has a review date and an owner, or it becomes a liability.
- **Whiteboard drift.** Anything you can draw that doesn't derive something is noise. If a node or lever has no row in `rules.json`, it doesn't go on the canvas.
