# ADR 0119: foldkit-dash spans and brushing, series keys, a key hint, and labelled tables

## Status

**Accepted**, 2026-11-18, for stage 7 of
[ADR 0109](0109-build-agent-first-static-dashboards-with-foldkit-dash.md), after stage 6
([ADR 0118](0118-foldkit-dash-read-outs-keys-legend-and-chosen-lines.md)).

## Context

Stage 6 left these open:

- brushing a range;
- a key to jump between series;
- a visible key hint;
- data tables headed by axis labels.

A dashboard's most common filter after a category is a period: "June to August". A
`range` input holds one number, which suits a threshold but not a period. The plot
grammar has no input of two ends, and dates are strings, not numbers. A reader also
expects to set a period by dragging across a time chart.

foldkit-viz has the parts: `invertAxis` turns a pixel into a value, and the plot overlay
draws a `brush` band.

## Decision

1. **A `between` input holds a span: two ends, numbers or ISO dates.**
   - Its fence gives `min` and `max`, or `options: { "data", "field" }` to take the
     least and greatest of a field.
   - Its `value` is `{ "min", "max" }`, the whole span by default.
   - The page shows a From and a to field (date or number, with `step`) and an All button
     back to the whole span. A change that would put From after To swaps the two ends.
   - In `where`, `{ "input": "weeks" }` is the span itself, so it keeps the rows between
     its ends, both included, as a written `{ "min", "max" }` does.
   - In the address and `--at` a span is `from..to` (`?weeks=2026-06-01..2026-08-31`).
     The MCP server's `at` takes `{ "min", "max" }`.
   - `check` draws its charts at the default and at the whole span.
2. **`"brush": "weeks"` on a plot spec lets a reader drag across it to set the span.**
   - The chart's `x` must be numbers or dates (a `spec` problem otherwise). The input
     must be a `between` of the same kind: dates on a time axis, numbers on a linear one
     (an `input` problem, path `brush`).
   - A release sets the span to the ends dragged across: days on a time axis, the
     input's `step` on a number axis, kept within the input's ends.
   - A click (a release within 4 pixels of the press) sets the whole span back.
   - The chart shows the span chosen as a band, and the drag as it happens. Pointer
     capture keeps a drag going outside the chart.
   - Horizontal drags brush, and vertical ones still scroll the page on a touch screen.
   - `describe` ends the chart's line with `Dragging across it sets weeks.`, and the
     envelope's charts gain `brushes`.
3. **Shift with Down or Up moves to the next or previous series** on a focused chart:
   its first value, wrapping round the ends.
4. **A focused chart shows its keys.** Until a value is pointed at, the read-out line
   says what the chart answers. For example: `Arrow keys read values; Shift with Up or
Down changes series; Enter chooses region; drag across to choose weeks.` The chart's
   accessible name says the same.
5. **foldkit-viz heads a data table by its labels.** A column whose field is plotted on a
   labelled scale (`x` or `y` for positions, `color` for fill and stroke) is headed by
   that label, not the field name.

## Consequences

- An agent adds a period filter with one input and, if wanted, one key on a chart.
  Neither needs a loader.
- A span from the data's own extent always keeps rows at both ends, so `check`'s two
  draws cannot fail for an empty range. A span written by hand can, and `check` says so.
- Dates are compared as text. That holds for ISO dates of one form (`2026-06-01`); data
  that mixes dates with times should be made uniform in its loader.
- foldkit-viz's table headings change for charts with labelled scales. The data and the
  table are unchanged.

## Options considered

- **Two `range` inputs, from and to.** They need numbers, so they cannot hold dates,
  and two inputs cannot keep their ends in order.
- **A two-thumbed slider.** It is hard to use from a keyboard and on a phone. Date and
  number fields are native, and a brush gives the pointer its quick path.
- **Brushing that filters the brushed chart itself.** It would collapse the chart to the
  span and lose the context to drag in. The band shows the span instead.

## Not in stage 7

Brushing on `y` or in two dimensions, spans of categories, read-outs on static pages,
legend entries for the keyboard, and every combination of a checkboxes input in `check`.
