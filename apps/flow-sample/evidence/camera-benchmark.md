# Workbench camera benchmark

The large workflow contains 320 editable nodes and 452 edges across 20 lanes.
The browser driver compares the three-node release workflow with the large
workflow in default and Minimal modes. All cases use the production Astro
build, the default card renderer, and the same 1280 × 1100 viewport.

## Reproduce

From the repository root, build the workbench and run the driver from
`apps/web`, which provides the installed Playwright dependency.

```sh
bun run --filter @opsydyn/flow-sample build
cd apps/web
bun - < ../flow-sample/evidence/camera-benchmark.mjs
FLOW_BENCHMARK_REVERSE=1 bun - < ../flow-sample/evidence/camera-benchmark.mjs
```

Set `FLOW_BENCHMARK_SCREENSHOT` to an absolute PNG path to capture the large
workflow at Fit view. The driver prints counts and p50/p95 values as JSON and
fails if a sampled input doesn't change the camera or if the page reports a
runtime error.

## Method

Each case gets a fresh page. Each interaction starts near 100% zoom, with
three runs per case and four warm-up events before the 20 measured inputs in
each run. The driver sends trusted pointer or wheel input and waits for one
observed camera update and its subsequent animation-frame callback before
sending the next input. Pan travels 140 CSS pixels horizontally and 30
vertically, then returns. Zoom goes in ten steps and reverses ten steps.

The probe uses the event timestamp, the time at the capture listener, the
first observed world-transform change, and the next animation-frame callback.
Listener-to-update includes scheduling and the DOM patch. Event-to-frame
includes browser delivery and frame scheduling. These serial, headless
measurements are useful for comparison on the same machine. Continuous input,
display presentation, and paint latency require separate measurements.
[DOM mutation observers](https://dom.spec.whatwg.org/#mutation-observers) ·
[HTML animation frames](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#animation-frames)

## Local results

Headless Chromium 151.0.7922.34 on Apple M4 Pro, macOS 26.6.2, without CPU
throttling. Ranges show the two runs of the driver in forward and reverse case
order. Each case and interaction contributes 60 samples per order.

| Workflow          | Canvas elements | Pan listener to update p95 | Zoom listener to update p95 | Pan event to next frame p95 | Zoom event to next frame p95 |
| ----------------- | --------------: | -------------------------: | --------------------------: | --------------------------: | ---------------------------: |
| Release · default |              47 |                 1.3–1.5 ms |                  1.3–1.4 ms |                32.7–33.5 ms |                 50.9–51.2 ms |
| Large · default   |           5,657 |               29.0–34.5 ms |                28.3–29.1 ms |                42.4–49.5 ms |                 52.0–62.6 ms |
| Large · minimal   |           5,334 |               24.5–25.0 ms |                23.9–24.0 ms |                33.5–33.7 ms |                 50.8–50.9 ms |

Minimal mode reduced the full-page element count from 7,193 to 5,484 and
improved the large workflow's p95 in both orders. The large Minimal workflow
still took 23.9–25.0 ms at p95 from listener entry to the camera DOM update,
compared with 1.3–1.5 ms for the release workflow. The broader next-frame
metric varied with run order and includes browser scheduling.

A viewport-culling prototype is worth comparing against this baseline.
Use the same inputs and compare DOM size and listener-to-update p95. Keep
the graph, Fit view, minimap, and Connections list based on the full visible
workflow. This run measures the cost of the current path. Profiling or an
A/B run is needed to attribute savings to culling.
