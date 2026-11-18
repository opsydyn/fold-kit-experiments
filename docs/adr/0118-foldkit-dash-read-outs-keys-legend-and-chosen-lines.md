# ADR 0118: foldkit-dash read-outs, chart keys, legend choices and chosen lines

## Status

**Accepted**, 2026-11-18, for stage 6 of
[ADR 0109](0109-build-agent-first-static-dashboards-with-foldkit-dash.md), after stage 5
([ADR 0117](0117-foldkit-dash-several-values-choosing-series-and-how-series-move.md)).

## Context

Stage 5 left these open:

- hover read-outs;
- brushing a range;
- clicking legend entries;
- dimming a chosen line.

Two more needs remain:

- A chart that selects can only be chosen from with a pointer. The select beside it is
  the keyboard's way in, but nothing on the chart itself answers a key.
- A reader can see a value only through each SVG element's `title` tooltip, which
  appears slowly, does not show for a line, and is not read out.

foldkit-viz already has what this needs. Its framework-free keyboard contract
(`chartCommandOf`, `targetAfter`) is the one the web app's plot panel uses. Its plot
`overlay` draws a ring. The plot panel also shows how to bring pointer moves into a
Foldkit Model as plot pixels: a Mount listens, and a custom element event carries the
fact.

## Decision

1. **A read-out follows the pointer.**
   - Every chart on an interactive page has a read-out line under it, announced
     politely to screen readers.
   - Moving the pointer over the chart points at a value and rings it on the chart: the
     bar under the pointer on a bar chart, else the nearest point within 24 pixels.
   - The read-out names the series if there is one, then the `x` and `y` with their axis
     labels: `Wales, Week starting 2026-07-27: Orders 259`. Leaving the chart clears it.
   - The server renders the read-out empty, so hydration is unchanged.
2. **Charts answer keys.**
   - Each chart is focusable.
   - Arrows step through its values, and Page Up and Page Down step ten at a time. Home
     and End jump to the ends, and Escape stops pointing. This is foldkit-viz's
     keyboard contract.
   - Values are read series by series, in `color.domain` order (else as they first
     appear), each along `x` (sorted for numbers and ISO dates). Bars are read in the
     rows' order.
   - On a chart that selects, Enter or Space chooses the value pointed at, as a press
     would. So a chart's own keys can now do what only a press could.
3. **A legend entry chooses what it names.** On a chart that selects, pressing a legend
   entry sets the input to the entry's label when that is one of its choices.
4. **A chosen line or area stands out.** foldkit-viz's `highlight` now dims lines and
   areas a series at a time: a series stays lit when any of its rows matches. foldkit-dash
   highlights the chosen series of a line or area chart, as it already did for bars and
   dots.

## Consequences

- A reader on a phone, a mouse or a keyboard can read any value without the data table,
  and choose from a chart without the select.
- Every chart on an interactive page now takes a tab stop. Static pages (no inputs) are
  unchanged and ship no script, so they have no read-outs; their figures keep their
  summaries and tables.
- foldkit-viz gains a behaviour (line and area highlights), released as a feature of
  that package. Charts without a highlight are unchanged.

## Options considered

- **The SVG `title` tooltips alone.** Slow to appear, not shown for lines, and never
  read out.
- **A floating tooltip by the pointer.** It covers the chart on a phone and needs
  positioning code. A line under the chart is always in the same place.
- **Pointer events with screen positions only** (Foldkit's `OnPointerMove`). They cannot
  be mapped to the drawing without the client position; the Mount reads it where the
  event happens.

## Acceptance (2026-11-18)

A fresh agent, given only the skill, built the dashboard it was asked for:

- a weekly orders line chart of all regions, where choosing a region (by its line, its
  legend entry or the keyboard) highlights it and filters a revenue chart;
- exact values readable from the charts;
- prose naming the regions that peaked earliest and latest.

`check` exited 0 on every run, and `describe` confirmed every claim it kept. In
Chromium, from `file://`, using the keyboard only:

- two Tabs reached the chart;
- arrows read `Scotland, Week starting 2026-05-04: Orders 200` and on;
- End then Enter chose South East, highlighted its line and filtered the revenue chart.

With the mouse, hovering read out values, clicking a legend entry and clicking a line
both chose a region, and the other lines dimmed to 0.15. The console showed no errors.

It found one defect and one layout bug, both fixed before merging:

- **Enter could choose the wrong region.** Pressed straight after End, Enter chose the
  value pointed at before End: the key handler read the model the page was last drawn
  with. Chart keys are now a Message, applied in `update` to the model as it is.
- **Pages were thousands of pixels too tall.** foldkit-viz's visually hidden data table
  kept its full height, because a table does not shrink to 1px. The hiding is now on a
  wrapper, in foldkit-viz, for static pages too.

Also changed or documented:

- A chart's tab stop is now named ("interactive chart", with its keys).
- Read-outs group thousands.
- The skill now gives:
  - the full key list;
  - where axis labels go;
  - that read-outs update after the event;
  - that the legend is pointer-only and lists every group;
  - that claims across series are checked by comparing their `describe` lines.

Still open: a key to jump between series, a visible key hint, legend entries for the
keyboard, and data tables headed by axis labels.

## Not in stage 6

Brushing a range, read-outs on static pages, reading every series at one `x` together,
and checking every combination of a checkboxes input.
