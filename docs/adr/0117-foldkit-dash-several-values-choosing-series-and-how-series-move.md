# ADR 0117: foldkit-dash inputs of several values, choosing a series, and how a series moves

## Status

**Accepted**, 2026-11-18, for stage 5 of
[ADR 0109](0109-build-agent-first-static-dashboards-with-foldkit-dash.md), after stage 4
([ADR 0116](0116-foldkit-dash-charts-that-choose-inputs-and-inputs-in-the-url.md)).

## Context

Stage 4 left these open:

- choosing more than one value at once;
- clicking lines and dots rather than only bars;
- describing what a series does between its low and high.

The last has come up in every acceptance run since stage 1. An agent wants to write
"Scotland dips in summer, then climbs". `describe` gives the low and the high, which can
be the first and last weeks, so it cannot confirm the dip. The run then cuts the claim.

## Decision

1. **A `checkboxes` input chooses several values.** Its fence takes `options` as a
   select's does (a list, or `{ "data", "field" }`), and its `value` is the list ticked
   at first (every choice when not given). The page shows a group of checkboxes, and its
   value is the list ticked, in the options' order.

   A list in `where` keeps the rows whose field is any value in it, so
   `"where": { "region": { "input": "regions" } }` works unchanged, and a list written by
   hand works too. An empty list keeps no rows: the reader sees the note `check` would
   give.

   `check` draws each chart at the default and at each choice ticked alone. It does not
   try every combination or none ticked.

   In the address, each ticked value is a parameter of its own (`?regions=North&regions=Wales`),
   and none ticked is one empty parameter (`?regions=`). `--at` takes a comma-separated
   list (`--at regions=North,Wales`). The MCP server's `at` takes a JSON list. The
   envelope names the type `checkboxes`.

2. **`select` chooses a series on line, area and dot charts.** On a chart whose first
   mark draws several series (a `stroke`, `fill` or `z` field), a press chooses the
   series of the nearest point within 24 pixels and sets the named select or radio to it.
   Bar charts and other charts with an axis of categories still choose the category.

   `check` requires every series the chart draws at the defaults to be one of the
   input's choices. A chosen dot series is highlighted. Lines and areas are not dimmed:
   foldkit-viz's `highlight` does not apply to them.

   Nearness is measured on linear, time and band axes. A chart on a log or other scale
   chooses nothing by series. `describe` ends such a chart's line with
   `Clicking it sets region.`

3. **`describe` gives each series' largest fall and rise.** For a line, area or dot
   series, the largest fall runs from a high to a later low, and the largest rise from a
   low to a later high, read in `x` order. That order is sorted when every `x` is a
   number or an ISO date, and is the rows' order otherwise (month names). An example:
   `largest fall 312 at 2026-06-01 to 202 at 2026-08-03; largest rise 202 at 2026-08-03
to 312 at 2026-10-19`. The envelope's series gain `fall` and `rise`. A series that
   never falls has no `fall`. The climb after the largest fall (`then up to 312 at
   2026-10-19`, the envelope's `recovery`) runs from its low to the highest point after
   it, so "dips, then climbs" is the fall and this, not the largest rise, which can
   start before the dip.

## Consequences

- "Scotland dips in summer, then climbs" can be checked: a largest fall into August and
  a largest rise out of it say exactly that. A dip that is not the largest fall still
  cannot be confirmed; `--at` on a narrower range can isolate it.
- Comparing two or three parts of the data is one input and no loader.
- Clicking a series needs the chart's points, which the page already has, and no new
  foldkit-viz API: foldkit-dash maps a point to pixels itself for the three common axis
  types.

## Options considered

- **`"multiple": true` on a select.** A `<select multiple>` is hard to use on a phone and
  with a mouse. Checkboxes show what is ticked.
- **Every local low and high.** On weekly data, noise makes dozens. The largest fall and
  rise are each one fact, and the ones a sentence about a trend usually means.
- **Clicking legend entries.** It still waits: foldkit-viz draws the legend as HTML, and
  making its entries clickable means changing that package's API.

## Acceptance (2026-11-18)

A fresh agent, given only the skill, built the dashboard it was asked for:

- tick boxes to compare regions on a weekly orders line chart;
- clicking a line to pick a focus region, which filters a revenue chart;
- prose on when each region fell and climbed most.

It used a one-line shell loader. `check` exited 0 on both runs, and `describe` confirmed
every claim it kept, five regions' falls and rises among them. In Chromium, from
`file://`:

- unticking two regions redrew the chart (`3 of 5 groups drawn`) and set
  `?regions=Scotland&regions=London&regions=South+East`;
- clicking London's line set the focus to London and filtered the revenue chart to it;
- reopening that address showed the same state;
- the console showed no errors.

It found two problems, both fixed before merging:

- **Largest rise can start before the dip.** For Scotland it runs from the first week
  to October, so it could not confirm "climbed back from August". `describe` now gives
  the climb after the largest fall (`recovery`), and Scotland's line reads `largest
fall 255 at 2026-06-08 to 202 at 2026-08-03, then up to 312 at 2026-10-19`.
- **A bad `--at` value exited 1.** It printed every chart at its defaults, with the
  error last. It now exits 2, as a misspelt input name does.

The skill now covers:

- a one-line loader for a CSV elsewhere, and its `--fresh` caveat;
- that pressing a chosen category again keeps it when the input has no `all`;
- that a focus select can name a region the checkboxes untick;
- that the series lines are `describe`'s alone, not in the chart's summary.

## Not in stage 5

Hover read-outs, brushing a range, clicking legend entries, highlighting a chosen line,
and every combination of a checkboxes input in `check`.
