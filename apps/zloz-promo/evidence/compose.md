# Native Compose example — 2026-11-08

- **Result:** complete
- **Claim:** The promo home now includes a native Foldkit island demonstrating node and connection selection, policy-aware connection choosers, keyboard/pointer port connections, cancellation, Undo/Redo and Fit. Public package primitives and `createEditor` / `updateEditor` own behavior and history. The example inherits the Viz/Three family theme, keeps diagnostics minimal and shows its actual Model/update source with syntax highlighting. Astro retains the page metadata through `noMeta`.
- **Evidence:** [Light](compose-light.png), [dark](compose-dark.png), [390px](compose-mobile.png), [interaction results](compose-browser.json). Browser checks cover transient selection, keyboard connection selection, all three creation paths, cancellation, duplicate rejection, one-step Undo, Redo identity, mounted-editor retention across theme changes, metadata ownership, highlighted source and mobile chooser/Undo with all nodes in view. [Refreshed promo checks](promo-browser.json) cover existing static content, downloads and theme behavior. [Nested-path checks](basepath-browser.json) include island hydration, connection creation and Undo under `/preview/zloz/`. All screenshots were visually inspected. Host-run production build, isolated prefixed build, `bun typecheck`, `bun run check` and `bun run test` passed; the promo has 5 passing tests and the web suite 420. Unit checks include initial auto-fit without graph history and no forced refit on later measurements.
- **Remaining uncertainty:** Local Chromium/build evidence; no hosted, CI, hardware touch or screen-reader acceptance claimed. The example intentionally resets on reload and has no persistence or graph export controls yet. Canonical JSON/Mermaid downloads still describe the separate static C4 fixture. Core/adapter APIs and graph formats are unchanged. Opaque EditorState is not accepted from untrusted props; only the package constructs it.
- **Next:** Recommendation: needs follow-up. Clarify the workbench's mini map control: rename **Overview** to **Mini map** and place its toggle in **Navigation**, preserving the existing diagnostic flag and global Minimal mode behavior. A subsequent promo slice can export the edited Compose graph with a visible Mermaid loss review.

Reproduce with the workspace build and preview at port 4329, then
`node apps/zloz-promo/evidence/compose-browser.mjs`. Format the resulting JSON with
oxfmt. [ADR 0013](../../../docs/adr/0013-demonstrate-compose-with-a-native-foldkit-island.md)
records ownership, history, lifecycle and theme decisions.

Verification note: the first direct prefixed build and a concurrent promo refresh
failed to resolve a temporarily absent generated core export. The app build script
prebuilds its dependencies; that prefixed retry passed. The promo refresh passed
when run after workspace tests finished. No resolver/package-source workaround
was introduced. Build/typecheck/test operations that rebuild shared package output
were kept sequential for final qualification.
