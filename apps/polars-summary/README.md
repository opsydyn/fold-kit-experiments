# Polars summary

A server route that keeps a million requests in a [Polars](https://pola.rs)
frame, bins them there on every request, and plots only the bins. It is the
summary counterpart to the web app's `/explore`, which sends the same million
requests to the browser and draws each one.

```sh
bun run dev:polars-summary   # http://localhost:4330
```

- `GET /` renders the page on the server: a latency histogram and a latency by
  payload density grid, with what each summary cost. No client script.
- `GET /spec.json` sends the histogram spec as JSON, naming the plot spec schema
  foldkit-viz publishes: what a Python or Rust service would send.
- `?bin=` sets the latency bin width (5–1000 ms) and `?max=` the latency cap
  (100–20000 ms). Anything else is a 400.

Polars sends each summary back as a column table of plain arrays, so a spec stays
JSON. The density grid colours cells by `log10(count)`, computed in Polars too,
because cell counts span four orders of magnitude.

On a 2024 laptop, once warm, a million requests become 61 histogram bins in
about 10 ms and 891 grid cells in about 12 ms (median of ten), and the page
sends those few hundred rows instead of /explore's million points. The first
request after start-up takes a few times longer.

## When to summarise in the engine

- **Summarise** when the chart shows a distribution, a total or a density: the
  picture comes from counts, and a few hundred rows travel instead of a million.
- **Send the points** when people inspect, brush or hover single rows, as on
  `/explore`.

`nodejs-polars` is a native Node add-on, so this runs on a Node or Bun server,
not on Cloudflare Workers, where the web app is deployed; this app is not
deployed.
