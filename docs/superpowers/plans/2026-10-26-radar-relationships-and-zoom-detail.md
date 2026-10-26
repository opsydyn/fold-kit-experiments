# 3D Radar: Relationships and Zoom Detail

**Status:** approved 2026-10-26 as proposed (these edges, all edges dimmed by default,
Zoom in and Zoom out buttons) and implemented. See "As built" at the end.

**Goal:** Show how radar entries relate (for example, FoldKit is _inspired by_ Elm)
as coloured, labelled edges between blips, and reveal more about each blip as you
zoom towards it.

**Base:** a new branch from `main`. PR #58 (the 3D radar) has merged, and PR #60
(Charts cards) doesn't touch the radar.

## 1. Relationship data

Relationships go in the dataset next to the entries, so the 2D radar could use them
later:

```ts
relationships: [{ from: 'foldkit', to: 'elm', type: 'inspired-by', note: '…' }, …]
```

`decodeRadarDataset` rejects a relationship that names an unknown entry, points at
itself, repeats an earlier pair and type, or has an unknown type. That matches how
entries are validated today.

**Five types.** Each has its own colour, a line style for redundancy (so it never
relies on colour alone) and a label:

| Type             | Label          | Line   | Direction                  |
| ---------------- | -------------- | ------ | -------------------------- |
| `inspired-by`    | Inspired by    | dashed | from → to                  |
| `builds-on`      | Builds on      | solid  | from → to                  |
| `alternative-to` | Alternative to | dotted | both ways                  |
| `complements`    | Complements    | solid  | both ways                  |
| `guards-against` | Guards against | dashed | from → to (into a caution) |

**Proposed edges** (16). Each has a one-line note shown in the details panel:

| From                    | Type           | To                           |
| ----------------------- | -------------- | ---------------------------- |
| FoldKit                 | Inspired by    | Elm                          |
| FoldKit                 | Builds on      | Effect                       |
| Gleam                   | Builds on      | BEAM                         |
| Unison Cloud            | Builds on      | Unison                       |
| Ollama                  | Builds on      | llama.cpp                    |
| Proof-guided generation | Builds on      | Lean                         |
| Claude Code             | Alternative to | Codex                        |
| Claude Code             | Alternative to | Pi                           |
| Codex                   | Alternative to | Pi                           |
| SQLite                  | Complements    | DuckDB                       |
| marimo                  | Complements    | DuckDB                       |
| Local-first sync        | Complements    | SQLite                       |
| RAG                     | Complements    | Structured model outputs     |
| WebGPU                  | Complements    | WebAssembly                  |
| Property-based testing  | Guards against | Unreviewed generated changes |
| Proof-guided generation | Guards against | Unreviewed generated changes |

Trim or add any you disagree with: the data is the content decision here.

## 2. Edges in the scene

- **Shape:** each edge is a `line` along a gentle arc that bows outward from the
  centre, so it never cuts through the core. Its points are sampled from a
  quadratic curve whose control point is the chord's midpoint pushed out past the
  higher of the two shells. Pure geometry in `space.ts`, tested.
- **Colour:** the type's colour. Five colours chosen with the dataviz palette
  checks against the dark stage, kept clear of the four category colours.
- **Focus:** edges touching the hovered or pinned blip are full strength and show
  their type label at the arc's midpoint (troika, billboarded, in the type's
  colour). Other edges are dimmed and unlabelled until you zoom in (see 3).
- **Filters:** an edge is shown only while both of its blips are visible. It fades
  with them.
- **Toggle:** a "Relationships" button (`aria-pressed`) shows or hides all edges.
  It's on by default.
- **Legend:** an HTML legend of the five types, with a colour swatch and line
  style for each.

## 3. Zoom reveals detail

Detail is decided per blip, from its **distance to the camera**. Zooming towards
part of the radar reveals that part without labelling all 32 entries at once:

| Distance to blip | Shows                                                               |
| ---------------- | ------------------------------------------------------------------- |
| far              | the blip only                                                       |
| mid              | its name                                                            |
| near             | its name, `Ring · Category`, and a wrapped description (`maxWidth`) |

Labels for edges between two near blips also appear. The thresholds are named
constants with a test that each level appears at the expected camera distance.
Wheel and pinch already zoom; I'd add **Zoom in** and **Zoom out** buttons so
keyboard users can reach every level.

## 4. Details panel and list

The pinned entry's panel lists its relationships as buttons, for example
"Inspired by · Elm". Choosing one pins that entry and turns the camera to it, the
same as the entry list. This gives a keyboard path through the graph.

## Verification

- **`bun:test`:**
  - dataset validation for relationships (unknown id, self, duplicate, bad type);
  - arc geometry (endpoints on the blips, every point outside the inner shell);
  - edge visibility under filters;
  - focus and dimming;
  - detail level by camera distance;
  - zoom buttons stay within the orbit limits;
  - relationship buttons in the panel;
  - a real scene-graph reconcile.
- The 2D radar's tests still pass, since it ignores relationships.
- **Repo checks:** `bun run check`, `bun typecheck`, `bun run test`.
- **Chromium:** hover and pin show labelled edges; filters hide edges; zooming in
  reveals names, then metadata; the Relationships toggle; dark stage at 375px.

## Out of scope

Editing relationships in the UI, relationships in the 2D radar, any push or PR
without a separate ask.

## Open questions

1. Are the relationship list and five types right?
2. Show all edges dimmed by default (proposed), or only the focused blip's edges?
3. Add Zoom in and Zoom out buttons (proposed), or wheel and pinch only?

## As built

Where the implementation differs from the plan above:

- **Colours:** no set of five hues from the dataviz reference palette passes its
  every-pair checks on the dark stage (`#12121f`). Four do, with a CVD warning that
  the line styles and labels answer: blue `#3987e5` (Builds on), yellow `#c98500`
  (Complements), magenta `#d55181` (Inspired by) and green `#008300` (Guards
  against). The peer type, Alternative to, takes a neutral ink `#c3c2b7` with a
  dotted line, as the skill folds an extra series into a neutral.
- **Arc shape:** a quadratic arc dipped up to a tenth inside the nearer shell near
  its ends (and more for opposite blips). Each edge now turns evenly round the
  sphere between its blips' directions, eases its distance from one shell to the
  other and lifts outward by a tenth of the outer shell in the middle. It never
  goes inside the nearer blip's shell, and opposite blips arc over the top.
- **Edge labels:** shown for the focused entry's edges and for any edge whose peak is
  within the name distance of the camera, rather than for edges between two near
  blips. The peak is where the label sits.
- **Zoom detail tuning:** the first browser pass labelled most of the radar at
  once. Detail now applies only to blips on the camera's side of the centre; names
  show within 7 units and ring, category and description within 4.5; edge labels need
  a focused entry or a peak on the camera's side within 4.5. The category names hide
  when the camera is closer than 8 units, where they would fill the view (the HTML
  legend still names them). From home nothing is labelled; one Zoom in is still an
  overview, two name the nearby blips, and three reveal their descriptions.
- **Data:** `relationships` is an optional dataset field, so existing datasets (and
  the 2D radar's tests) stay valid. One-way relationships read differently from the
  far end ("Elm · Inspired · FoldKit"); peer types read the same.
- **Tests:** 59 radar tests in the samples package (20 new): relationship
  validation, arc geometry, edge visibility, focus and line styles, phrasing from
  either end, detail by camera distance, zoom limits and a real reconcile.
