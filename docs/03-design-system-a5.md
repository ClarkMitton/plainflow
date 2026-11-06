# Design system: A5 ("Swiss")

Chosen after 20 boards. White ground, heavy ink borders, big titles, and one colour per node family carried as a hard offset shadow. Colour is rare and always means something. The reference implementation is `mockups/Master.html` and the CSS at the top of it.

## Principles

1. Colour encodes the node family, nothing else. Six colours, fixed. The legend is the palette.
2. Personal data is the only coloured wire. Everything else is ink.
3. Nothing curves. Right-angle wiring, square corners, hard shadows. This is what stops it looking like a whiteboard.
4. One typeface for reading, one mono for values and labels.
5. Anything interactive has a 2px ink border. Anything derived (a chip, a meter) has none.

## Colour

| Token | Hex | Use |
| --- | --- | --- |
| ink | #17171A | text, borders, plain wires, toggles on |
| paper | #FFFFFF | canvas and node ground |
| paper-2 | #F6F5F1 | the "outside" zone tint, info boxes |
| rule | #DCDAD3 | hairlines, disabled borders |
| muted | #6B6A66 | labels, secondary text |
| muted-2 | #8A8882 | kinds, hints |
| people | #2D5FD3 | People node family |
| data | #F0A818 | Data node family, and the personal-data wire |
| purpose | #2E8556 | Purpose node family |
| system | #6B47D1 | System and AI node family |
| company | #3E4756 | Company and sub-processor family |
| paperwork | #D63B22 | Paperwork output node, "to do" states, blocked wires |
| ok | #2F7D4A | "on file", "covered", allowed |
| rq | #C4321D | "to do", "needed" (text on white) |

Text on a family colour is white, except on data (amber) where it is ink. Both pass 4.5:1.

## Type

- Body and titles: Inter Tight, self-hosted from `public/fonts` (no request to Google). 400 body, 600 labels, 700 titles.
- Mono: IBM Plex Mono. 400 and 600. Used for values, chips, zone labels, legend.
- Node title 21px/24px, weight 700, letter-spacing -0.01em.
- Node kind 12px, opacity .85 on the family band.
- Row text 14px. Value 13px mono 600.
- Zone label 11px mono 600, uppercase, letter-spacing .12em, muted.
- Top bar title 18px 700.

## Node anatomy

```
+------------------------------+  2px ink border, no radius
| ● Title                 band |  58px, family colour fill, white (or ink on amber) text
|   Kind                       |
+------------------------------+
| o row label          value   |  36px rows, 16px side padding
| [toggle] lever               |
| row label            value o |  ports: 12px circle, 2px ink border, white fill
+------------------------------+
                          ####    6px 6px 0 family-colour shadow
```

- Ports: white circle, 2px ink. Ports carrying personal data are filled amber.
- Toggle: 30 by 16, 2px ink border, square knob. On = ink fill, white knob right.
- Chip (segmented choice): 1.5px ink border, mono 11px. Selected = ink fill, white text.
- Locked lever: shows the value and the word "locked" in mono, no toggle.
- Derived chip (tier, trigger count): mono, no border, sits in the value slot.

## Wires

- Plain relationship: 2px ink, right-angle, `stroke-linejoin: round`.
- Personal data: 5px amber, right-angle. Crossing the boundary gets a black "T2 crosses" tag in mono 11px.
- Sub-processor link: 2px ink dashed 6 5.
- Blocked: 2.5px paperwork-red dashed 8 6, with an X at the blocked end and an explanation box.

Routing rule: leave a port horizontally for at least 24px, turn once, arrive horizontally. Never diagonal.

## Zones

- Boundary: 2px dashed ink vertical line. Outside zone tinted paper-2.
- Zone labels top-left of each zone in mono uppercase.

## Buttons

- Default: 2px ink border, white, 13px 600, 6px 12px padding.
- Primary: ink fill, white text, plus a 4px 4px 0 shadow in the colour of what it does (red for export, amber for a data change).
- Segmented (flow first / tier first): two buttons in one 2px border; active is ink fill.

## Boxes

- Info box: 2px ink border, 10px 12px padding, 13px text.
- Alert box (blocked wire): 2px red border and 5px 5px 0 red shadow.
- Dashed box: for "what you'd give up" and other provisional content.

## Layout

- Canvas 1400 by 820 in mockups; real app is fluid with the same spacing.
- Top bar 52px with 2px ink bottom border.
- Right rail (paperwork, readout) 260px wide.
- Grid snap 24px.

## Compare view

- A and B side by side, 480px each, 320px middle column.
- The changed lever gets a 3px amber ring.
- Removed requirements are struck through and muted, with a reason in the value slot.
- Deltas in big type: "5 to 3", with the new value on an amber highlight.

## Don'ts

- No curves, no gradients, no rounded corners on nodes, no drop shadows other than the hard family shadow.
- No stamps or decorative marks. Tried, rejected.
- No icons unless they carry meaning that text can't. Prefer a word.
- No colour that isn't in the table.

## Canvas additions (v0.3)

Each one shows something the picture was missing: which way data moves, where it ends up, and where the work is. No new colours.

- **Direction.** Wires that carry data (carries, feeds) end in a solid arrowhead in the wire's own colour (ink 12px, amber 16px, red 13px), stopping short of the port. Personal-data wires also carry a slow paper-white dash (3 on, 13 off) moving the way the data travels. It stops under `prefers-reduced-motion`.
- **Trace.** Hovering a node's header, a wire or a word in the story strip lights that data's route (amber outline on nodes, wires one step thicker) and fades everything else to about 25%. An ink caption with an amber shadow under the story strip says the route in words: inside first, then what leaves.
- **Story strip.** The flow's sentence above the canvas, one chip per node, underlined 4px in the node's family colour. Hover to trace, click to open.
- **Tier meter.** On data nodes: three 12px squares with a 2px ink border, filled ink up to the tier, then the tier in mono. At Tier 3 the filled squares are paperwork red.
- **Node tags.** Mono tags sit on the top edge of a node, right-aligned: "2 to do" in ink, "hard line" or "blocked" in paperwork red. Clicking one opens the node. A node on a hard line also gets a 3px red dashed outline.
- **Pill.** Double-click a header to fold the node to its header (the collapse level "pill"). Ports move to the header's middle.
- **Preview ring.** While the cheapest change is previewed, the lever it would flip gets a 3px amber ring.
- **Zones.** Zone labels are ink with a one-line plain subtitle: "You decide what happens to the data" / "Companies that handle it for you".

## Adding, connecting, undoing (v0.5)

- **Add** wires the new box in (data into the tool and about the people; people about the purpose; a company receiving from the tool) and drops it below the lowest box in its column, so it changes the answer at once instead of floating.
- **Connect by choosing**: the drawer lists what a box is connected to, with × to disconnect, and an "Also connect to…" list. Plainflow picks the direction from what the boxes are (`smartConnect`); dragging between ports still works for those who find it.
- **Undo and Redo** in the tools strip and on Ctrl+Z / Ctrl+Shift+Z. Typing in a field within a second coalesces into one step. Each undo reports what it changed, like any other change.
- **×** on a box's top-left corner on hover removes it; Undo brings it back.
