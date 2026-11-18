# Marks and scales, briefly

The parts of the plot spec a dashboard uses most. The project's
`plot-spec.schema.json` is the plot grammar's whole contract (look up
`definitions.<Name>Mark`, `PositionScaleSpec` and `ColorScaleSpec`); this is the short
version. foldkit-dash adds `where`, `select` and `{ "input": ... }`, which that schema does
not know.

A channel is a field name (`"sales"`) or a constant (`{ "value": 4 }`). Every mark
also takes `title` (a channel shown on hover and in the data table), `opacity` and
`strokeWidth`.

## Marks on x and y axes

| Mark      | Required          | Optional                                                                  | For                                                     |
| --------- | ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `line`    | `x`, `y`          | `stroke` (a series per value), `z`, `curve`, `transform`                  | Trends over time                                        |
| `area`    | `x`, `y`          | `y0`, `fill`, `z`, `curve`, `stack`, `transform` (window)                 | Volumes, stacked shares                                 |
| `bar`     | `x`, `y`          | `fill`, `stroke`, `stack`, `group: true` (side by side), `x0`/`y0`         | Comparing categories; one axis is a band of categories  |
| `dot`     | `x`, `y`          | `r`, `fill`, `stroke`, `symbol`                                           | Relationships between two measures                      |
| `rect`    | `x` (with `transform: { "type": "bin" }`) | `fill`, `x1`/`x2`/`y1`/`y2`, `inset`             | Histograms                                              |
| `box`     | `x`, `y`          | `fill`, `stroke`                                                          | Distributions per category                              |
| `violin`  | `x`, `y`          | `fill`, `stroke`, `bandwidth`                                             | Distribution shapes per category                        |
| `cell`    | `x`, `y`          | `fill`                                                                    | Heatmaps of two categories                              |
| `rule`    | `x` or `y`        | `stroke`                                                                  | Targets and thresholds (`{ "value": 100 }`)             |
| `text`    | `x`, `y`, `text`  | `fill`, `anchor`, `dx`, `dy`                                              | Labels on points                                        |

Line transforms, alone or in a list: `{ "type": "regression" }` (with a confidence
band), `{ "type": "loess" }`, `{ "type": "window", "size": 4, "reduce": "mean" }`
(a moving average) and `{ "type": "downsample", "method": "lttb" }`.

Marks that fill their panel instead: `treemap`, `sunburst`, `sankey`, `parallel`,
`tree`, `pack`, `chord`, `force`, `geo` (maps). Read their definitions in the schema.

## Scales and layout

- `x` and `y` (`PositionScaleSpec`): `label`, `domain` (two numbers, or the list of
  categories in the order to show them), `type` (`linear`, `log`, `symlog`, `pow`,
  `time`, `band`).
- `color` (`ColorScaleSpec`): `label`, `domain` (categories in legend order),
  `scheme`, or `range` for explicit colours per category.
- Types are inferred: numbers make linear axes, strings make band axes, ISO date
  strings make time axes. A band axis shows its categories in the order they first
  appear in the rows; give `domain` to order them yourself (largest first, say).
- `facet: { "x": "field" }` splits the chart into one panel per value, on shared
  scales. `title` and `description` label the whole chart.
- There is no tick-number format: put units in the label (`"Revenue (£)"`).

## What describe says

`describe` prints one sentence group per chart: what is drawn and how many (a box
or violin counts once), each axis (a band axis with its categories in order when
there are six or fewer; a continuous axis from its lowest to highest value, bars
from 0), and what colour shows. Whole numbers print exactly; others round to four
significant figures, so 509,206.5 prints as 509,200. On a page with inputs, a chart is
described at its inputs' defaults, or the `--at` values, named first:
`[region = "North"] Shows 1 line.` A line, area, dot or bar chart then lists each
series (by its `stroke`, `fill` or `z` field, unless that field is the category axis
itself, as when bars are coloured by their own category) with its points, exact low and
high, and every `x` each is reached at (two, when a low is reached in two weeks). For
bars, those are the highest and lowest categories; horizontal bars (numbers on `x`) are
measured along `x`. One series is named by its field and the `where` that chose its rows;
several follow `color.domain` when the spec sets one, else the data's order.
