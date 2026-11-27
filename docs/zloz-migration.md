# ZLOZ naming and compatibility

**ZLOZ** is the graph and system modelling toolkit. Its package family is:

- `@opsydyn/foldkit-zloz` for the core and optional `/effect-ui` views.
- `@opsydyn/foldkit-zloz-elk` — ELK layout.
- `@opsydyn/foldkit-zloz-force` — force layout and `/eligibility` checks.
- `@opsydyn/foldkit-zloz-mermaid` — portable Mermaid projections.
- `@opsydyn/foldkit-zloz-cli` — standalone Effect CLI adapter for validation and export.

The four public packages have registry releases. The CLI is a private workspace.
The [Effect UI migration guide](assessments/2026-11-26-effect-ui-1.0-migration.md)
records the local 1.0 rehearsal. Use the documentation for your installed version.
The old Flow `0.2.0` proposal was closed before publication.

Update imports to the ZLOZ package names. Prefer `ZlozGraph`, `ZlozNode`,
and `ZlozError`. Use `graphSurface` and `/effect-ui.css` for the current canvas.
The `createEditor`, `updateEditor`, `createElkLayout` and `exportMermaid` APIs
keep their names.

The [API reference](/fold-kit-experiments/zloz/api/) is titled **ZLOZ API**
and covers all four packages. The previous API entry URL remains reachable.
The workbench workspace is `apps/zloz-demo`, started with `bun run dev:zloz-demo`.
The reference example is `/zloz`; `/flow` redirects there.

Existing version-one graph JSON, Mermaid bundles and local drafts remain
readable. Retained protocol strings, identity `flowId` fields, local-storage
keys, `data-flow-*` attributes and `--flow-*` theme variables deliberately keep
their old spelling. They preserve user data and custom integrations. Check the [ZLOZ API notes](zloz-api.md) for host conventions.

Archived qualifications, screenshots and parser-spike records retain the names
they actually measured. They are historical evidence, not current installation
instructions. New checks qualify the renamed tarballs independently.
