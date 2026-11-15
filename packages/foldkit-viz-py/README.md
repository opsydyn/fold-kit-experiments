# foldkit-viz for Python

Charts from [@opsydyn/foldkit-viz](https://www.npmjs.com/package/@opsydyn/foldkit-viz)
plot specs in Jupyter, as an [anywidget](https://anywidget.dev).

```python
from foldkit_viz import Plot

Plot({
    "width": 480,
    "height": 300,
    "title": "Dose response",
    "data": [{"dose": 1, "response": 2}, {"dose": 2, "response": 4}],
    "marks": [{"mark": "dot", "x": "dose", "y": "response"}],
})
```

- A spec is plain JSON: rows, or a column table
  (`{"length": n, "columns": {"name": [...]}}`), and marks whose channels name
  fields. See the [plot grammar](https://github.com/opsydyn/fold-kit-experiments/tree/main/packages/foldkit-viz#plot-grammar-unreleased).
- `Plot` checks the spec against the published JSON Schema
  (`plot-spec.schema.json`) and raises `PlotSpecError`, naming the spec path,
  before anything is drawn. `validate(spec)` runs the same check alone.
- The chart is drawn by foldkit-viz itself, so it matches the same spec drawn
  anywhere else. It follows the notebook's light or dark theme and carries a
  plain-language summary and a data table for screen readers.
- `Plot(spec, theme="high-contrast-dark")` draws in a named theme (one of
  `THEMES`) on its own background; the default, `None`, follows the notebook's
  light or dark theme. Assign `plot.theme` to change it.
- Assign `plot.spec` to redraw. What depends on the data, such as a field that
  is not in it, shows in place of the chart and in `plot.error`.

## Development

```sh
bun run build        # bundle js/widget.ts and copy the schema into the package
bun run test         # the front end, against a fake widget model
uv run pytest        # the Python package
```

Not yet published to PyPI.
