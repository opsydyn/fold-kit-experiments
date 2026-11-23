# FoldKit Viz adoption pilot

Recruit three developers who build with Effect or FoldKit and have not worked on Viz. Use the released npm package and its public guide. Ask participants to bring a small dataset they can share or use the latency example from the guide. Record the installed Viz, Effect and FoldKit versions. Allow five working days for preparation and sessions, then follow up within a fortnight.

Give each participant these tasks without a walkthrough.

1. Render a labelled chart from the data and explain what each axis measures.
2. Add a reference threshold and locate a value above it using the chart or its data alternative.
3. Recover a chart with a misspelled field. Record which message or documentation led to the correction.
4. Link a second view and confirm the same observation or interval is available from the keyboard and pointer. Filter until the view is empty and recover it.

For each task, record independent completion, completion with help, or inability to complete, along with the exact issue and any glue the participant wrote. Ask whether the participant uses Viz on another chart within the following fortnight and record what they actually built. The proposed success signal is two of three completing independently and one using Viz again. If installation, diagnostics or the example blocks progress, fix that step before broadening the grammar.

## VoiceOver reading task

Use Safari with VoiceOver on the linked chart example at `/charts#linked-views`. Ask a reader to find the scatter and its salary axis, inspect the first point, identify the matching histogram bin and its count, then set minimum experience to 25 and recover by lowering it to 10. Record the announced text, focus when an empty state is reached, and whether the reader can recover without instructions. Record browser and OS versions. Automated keyboard and accessible-role assertions provide separate evidence.

## Status

The guide, workbench and session tasks are ready for participant verification. The study requires the release to appear on npm and three independent participants. VoiceOver results and repeat adoption are pending.
