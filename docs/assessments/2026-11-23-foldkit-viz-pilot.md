# FoldKit Viz adoption pilot

Recruit three developers who build with Effect or FoldKit and have not worked on Viz. Allow five working days for preparation and sessions, then follow up within a fortnight. The pre-PR pilot uses the branch tarball with its bundled README. Record its digest and the installed Viz, Effect and FoldKit versions for each session.

## Participant guide

Choose a small dataset you can share or use `latency.json` from the packet. Start in a fresh npm project and install the tarball from the packet. Effect and FoldKit are needed for the typed authoring and linked-view tasks.

```sh
npm init -y
npm pkg set type=module
npm install ./opsydyn-foldkit-viz-0.19.1.tgz foldkit@0.171.0 effect@4.1.0 @effect/platform-browser@4.1.0
```

Read `node_modules/@opsydyn/foldkit-viz/README.md`, starting with **Your first chart**. The optional `effect/plot` entry point exposes checked JSON and typed mark helpers. The `plot` entry point exposes `plotTargets` for a selected facet and mark. Use that information to work through these tasks.

1. Render a labelled chart from the data and explain what each axis measures.
2. Add a reference threshold and locate a value above it using the chart or its data alternative.
3. Recover a chart with a misspelled field. Record which message or documentation led to the correction.
4. Link a second view and confirm the same observation or interval is available from the keyboard and pointer. Filter until the view is empty and recover it.

The packet includes `service-health.ts` as a reference for sharing scales across plots and adding a supplied interval and a threshold. The charts and their tables use the same formatting descriptors.

## Session record

For each task, record independent completion, completion with help, or inability to complete. Capture the exact issue and any integration code the participant wrote. Ask whether they use Viz on another chart within the following fortnight and record what they actually built. The proposed success signal is two of three completing independently and one using Viz again. If installation, diagnostics or the example blocks progress, fix that step before broadening the grammar.

## VoiceOver reading task

Use Safari with VoiceOver on the linked chart example at `/charts#linked-views`. Ask a reader to find the scatter and its salary axis, inspect the first point, identify the matching histogram bin and its count, then set minimum experience to 25 and recover by lowering it to 10. Record the announced text, focus when an empty state is reached, and whether the reader can recover without instructions. Record browser and OS versions. Automated keyboard and accessible-role assertions provide separate evidence.

## Candidate qualification

Use the branch tarball built at `c0797d1b` for the pilot. Its SHA-256 is `ee9cbb42f30f0b72bb95f3c26adb66a971920ac8ffea325a0da051bced49f573`. It passed a clean npm install with FoldKit 0.171.0 and Effect 4.1.0. The clean consumer typechecked and rendered the FoldKit example, retained the previous chart when a field was missing, mapped a keyed point to its bin, and reported regression failures at the exact transform path. The installed service-health recipe rendered three accessible layer tables, shared the time domain and colour mapping across two charts, and preserved separate y scales. It passed in both UTC and America/New_York.

The candidates from `c88a28e3` and `67853990` were superseded before human sessions started. Their SHA-256 digests were `ad7643364c9d4e53b1884be46665fafc5e1c9eec287f78af2ff00d1d2c60250b` and `9ae32b7776eaab5661fc2b2225b358e4f15647a014f5d8cc4681af48f14fd1cb` respectively.

Published Viz 0.19.1 also passed clean installation and rendering in both a peer-free Node consumer and a FoldKit 0.171.0 consumer. The published package and the branch tarball share a version number. The branch tarball supplies `effect/plot` and `plotTargets` for the pilot.

Developer sessions, the human VoiceOver reading task, and repeat use remain pending.
