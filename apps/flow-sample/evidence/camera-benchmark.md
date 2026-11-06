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

## Viewport culling comparison

Run the two-mode comparison from `apps/web` after building the workbench.

```sh
FLOW_BENCHMARK_COMPARE_CULLING=1 bun - < ../flow-sample/evidence/camera-benchmark.mjs
FLOW_BENCHMARK_COMPARE_CULLING=1 FLOW_BENCHMARK_REVERSE=1 bun - < ../flow-sample/evidence/camera-benchmark.mjs
```

This comparison uses default diagnostics in both modes and searches for the
zoom anchor near the middle of the workflow. Use these paired measurements
for the culling comparison. Each range covers the forward and reverse runs
on the same headless Chromium and host described above.

| Mode    | Mounted nodes / edges near 100% | Canvas elements | Pan listener to update p95 | Zoom listener to update p95 |
| ------- | ------------------------------: | --------------: | -------------------------: | --------------------------: |
| Default |                       320 / 452 |           5,657 |               26.7–26.9 ms |                26.8–27.3 ms |
| Culling |                         30 / 53 |             871 |               10.2–10.4 ms |                11.0–11.1 ms |

Culling removed about 85% of canvas elements and reduced listener-to-update
p95 by about 60%. Event-to-next-frame p95 changed by under 2 ms for pan
(31.8–32.5 ms default, 33.3–33.7 ms culled) and zoom
(49.7–50.3 ms default, 49.9–50.0 ms culled). Continuous input and
presentation timing remain separate measurements.

The driver confirmed that the minimap still showed all 320 nodes, the
Connections list exposed all 452 edges, and Fit view remounted the full
workflow. [Zoomed canvas and full minimap](viewport-culling.png)

## Sustained input profile

Run the burst profile from `apps/web` after building the workbench.

```sh
FLOW_BENCHMARK_BURST=1 bun - < ../flow-sample/evidence/camera-benchmark.mjs
FLOW_BENCHMARK_BURST=1 FLOW_BENCHMARK_REVERSE=1 bun - < ../flow-sample/evidence/camera-benchmark.mjs
```

The driver offers 180 Chromium input packets at 120 Hz in each burst. It
starts near 100% zoom and drives three bursts per operation and culling
mode. Pan holds the pointer down and advances it by 180 CSS pixels. Wheel
zoom sends 180 one-pixel steps around a fixed anchor. The driver verifies
that the camera reaches the expected endpoint and counts trusted events
delivered to the surface separately from packets offered. [Chromium input protocol](https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-dispatchMouseEvent)

A mutation observer counts distinct camera transforms, including intermediate
changes delivered in one observer callback. The animation-frame probe
records callback gaps and the number of commits between callbacks. It starts
just before input and stops after the final camera update. The observation
window includes the tail of work after the last offered packet. These are
headless callback timings and DOM commits. Presented frames and reducer work
before a DOM commit require separate measurement. [DOM mutation observers](https://dom.spec.whatwg.org/#mutation-observers) · [HTML animation frames](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#animation-frames)

The paired runs used the same headless Chromium 151 build and Apple M4 Pro
as the serial benchmark, with default diagnostics. The driver offered each
burst in 1.491–1.494 seconds. Counts and observation windows are ranges
across six bursts per row. Frame-gap p95 is the range of the two case
orders, each calculated from its three bursts.

| Operation  | Culling | Events delivered / burst | DOM commits / burst | Frame gap p95 | Observation window |
| ---------- | ------- | -----------------------: | ------------------: | ------------: | -----------------: |
| Drag pan   | Off     |                    45–52 |               44–51 |  34.7–50.0 ms |      1.565–1.583 s |
| Drag pan   | On      |                  145–179 |                  91 |  17.8–18.4 ms |      1.531–1.534 s |
| Wheel zoom | Off     |                       92 |               87–89 |  49.0–50.1 ms |      3.017–3.417 s |
| Wheel zoom | On      |                  166–180 |               89–90 |  17.9–18.5 ms |      1.617–1.635 s |

Culling kept every observed callback gap below 25 ms. With culling off,
763 of 870 intervals exceeded 25 ms. The wheel observation window extended
well beyond packet dispatch with culling off, even though the final scale
matched the expected scale.

All 2,008 observed intervals contained at most one camera DOM commit.
Explicit frame batching has no duplicate DOM commits to eliminate in
these runs. To decide whether it can save work earlier, profile reducer
and view execution during the wheel burst with culling off and identify where the
extra time goes before testing a scheduler change.

![p95 callback gaps with culling on and off](camera-burst-profile.png)
