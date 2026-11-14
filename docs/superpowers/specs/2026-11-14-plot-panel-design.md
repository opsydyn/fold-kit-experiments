# Plot panel — design

**Status:** approved, 2026-11-14. Follows foldkit-viz 0.22.0 on the
[data-science release track](../../roadmap.md#viz-data-science-release-track--2026-11-13).

## Goal

The linked-charts, request-diagnostics and comparison reference apps compose
interactive chart children with typed out-messages. Their two children,
`ui/histogram-chart` and `ui/scatter-chart`, are the last bespoke chart modules
in the web app. Replace both with one generic child that draws any plot spec,
so the reference apps keep demonstrating parent-owned composition while every
chart comes from the grammar.

## Where it lives

In the web app, as `ui/plot-panel`. It installs pointer listeners through a
Mount, which the roadmap's non-goals keep out of foldkit-viz. It builds only on
the library's pure helpers: `compilePlot`, `indexPlot`, `invertAxis`,
`pointerToPlot`, `plotChart` and its overlay.

## Contract

- `init({ spec, mark?, brush? })`. `mark` is the index of the mark that pointer
  and keyboard target (default 0); `brush` lets the pointer select a range on a
  continuous x axis.
- The model holds the spec, the active target, and the brush gesture and band.
  The parent owns everything linked: it reads out-messages and passes
  `highlight` and `emphasis` back as view props.
- Messages: `MovedPointer`, `LeftPlot`, `PressedPointer` and `ReleasedPointer`
  in plot pixels, from the Mount; `PressedKeyNav`; `HoveredTarget` and
  `BlurredTarget` for parents and tests; `ClearedBrush`; and `ReplacedRows`, which
  swaps the spec's data, such as filtered points.
- Out-messages:
  - `InspectedPoint { key, x, y }` for a dot, with its row's x and y values.
  - `InspectedRange { domain, includeEnd }` for a rectangle such as a histogram
    bin, from its edges.
  - `ClearedInspection`.
  - `SelectedRange { domain }` and `ClearedSelection` when brushing.
- `targetsOf(model)` lists the interactive targets in x order, with each one's
  data range, so a parent can find the bin holding a value.
- View props:
  - `highlight` is a data highlight on the interactive mark, such as the points
    in a hovered bin.
  - `emphasis` lists target indices to emphasise, such as the bin holding a
    hovered point.
  - `ariaLabel` names the chart.

## Accessibility

- The panel is focusable. Arrow keys move through the targets.
- An `aria-live` region announces the active target's title.
- A visually hidden table lists every target's title.

## Exit criteria

The three reference apps use `ui/plot-panel`; `ui/histogram-chart` and
`ui/scatter-chart` are removed; their behaviour (hover linking, brushing,
filtering, keyboard navigation) is covered by tests against the new child.

## Outcome, 2026-11-14

- Implemented as designed. A press that starts a brush is visible to the parent
  as the panel's `drag` becoming set, which request diagnostics turns into its
  machine's `StartedSelection`.
- Pointer input first went through a Mount stream. The comparison scene tests
  showed a key press could then overtake an earlier pointer move, so moves and
  presses are re-dispatched as a synchronous DOM event instead, as the old
  scatter did. Leaves and releases use the ordinary handlers.
- A hovered dot is ringed rather than dimming the other dots, so a parent's
  linked highlight stays visible; a hovered bar dims the others.
- The panel needs no width observer: its SVG scales to its box, and pointer
  positions convert through the rendered box.
