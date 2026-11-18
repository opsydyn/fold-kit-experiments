# ADR 0116: foldkit-dash charts that choose inputs, inputs in the URL, and ranked bars

## Status

**Accepted**, 2026-11-18, for stage 4 of
[ADR 0109](0109-build-agent-first-static-dashboards-with-foldkit-dash.md), after stage 3
([ADR 0111](0111-foldkit-dash-mcp-server-loaders-in-any-language-and-csv.md)).

## Context

Stage 2 ([ADR 0110](0110-interactive-foldkit-dash-pages-from-input-fences.md)) left two
things a reader of an interactive page expects. The first is clicking a chart to filter
the others: choosing a region by clicking its bar, not only from a select. The second is
a link that opens the page as they left it. Stage 3's acceptance run left one gap in
`describe`: for a bar chart it names the highest and lowest bars, but not the ones in
between. So "South East sold most, then London" could not be checked.

foldkit-viz already has the parts. `pointerToPlot` and `invertPlot` turn a pointer into
the category under it, without a listener of their own (the parent owns events and
state). A mark's `highlight` dims the rows that do not match. Foldkit's `replaceUrl`
changes the address without adding a history entry.

## Decision

1. **`"select": "name"` on a plot spec makes its categories clickable.** A press on the
   chart's axis of categories (a bar chart's `x`, or `y` for horizontal bars) sets the
   named select or radio input to the category under it. Pressing the chosen category
   again sets the input back to `all`, when the input has one. While a category is
   chosen, the chart dims the others (a `highlight` on its first mark's category field,
   unless the mark sets its own). Like `where`, `select` is foldkit-dash's, removed before
   `compilePlot`. The input's own control stays on the page, so a keyboard or screen
   reader user has the same choice.
2. **`check` checks `select`.** It must name a select or radio input on the page. The
   chart must have an axis of categories (a `spec` problem otherwise). Every category it
   shows at the defaults must be one of the input's choices (an `input` problem, path
   `select`). `describe` ends such a chart's line with
   `Clicking a category sets region.`, and the envelope's charts gain `selects`.
3. **Inputs live in the query string.** A page with inputs reads `?region=North&floor=300`
   when its script starts. Each parameter that names an input, with a value that input
   can take (as `--at` reads it: `all` for a select's `all`), sets it. Anything else,
   such as another site's parameter or a choice the data no longer has, is ignored, so an
   old link still opens the page. Each change replaces the address (no new history entry)
   with the inputs that differ from their defaults, in the page's order, so the page at
   its defaults has a plain address. The server-rendered HTML stays the defaults:
   hydration adopts it, then applies the query.
4. **`describe` ranks bars.** A bar chart's series lists every bar, highest first, when
   it has at most 24 (`highest first: South East 509206.5, London 400000, ...`). Past
   that it gives the highest and lowest only. A tie keeps the rows' order. The envelope's
   series gain `ranked`.

## Consequences

- An agent adds cross-filtering with one more key on a spec, checked like the rest. It
  writes no event code, and a person gets the same pages.
- A page's address is shareable. The cost is that `?region=...` in a link the page did
  not write is read as a choice: harmless, since it can only pick a choice the page
  offers.
- A press is a pointer event on the chart, read through the SVG's rendered size, so it
  works at any width. There is no hover, and no clicking of lines or dots (no categories
  to choose); those wait for a need.
- Ranking 24 bars is enough for dashboards of categories. A chart with more bars is a
  distribution, which `describe` already summarises.

## Options considered

- **Click handlers in the plot grammar.** Rejected: the grammar stays a description of a
  chart, and foldkit-viz's interaction helpers leave events to the parent, here the page
  app.
- **Clicking a legend entry.** Kept for later: the legend is HTML outside the SVG, and a
  colour is not always a field an input chooses.
- **The hash instead of the query.** The query is what servers and analytics read, and
  `file://` pages keep it too; the hash stays free for headings.

## Not in stage 4

Hover read-outs, brushing a range to set a `range` input, clicking lines, dots or legend
entries, more than one value chosen at once, and a description of what a series does
between its low and high.
