# Zloz naming and compatibility

**Foldkit Zloz** is the graph and system modelling toolkit. Its package family is:

- `@opsydyn/foldkit-zloz` — core, plus optional `/foldkit` views.
- `@opsydyn/foldkit-zloz-elk` — ELK layout.
- `@opsydyn/foldkit-zloz-force` — force layout and `/eligibility` checks.
- `@opsydyn/foldkit-zloz-mermaid` — portable Mermaid projections.

These remain unpublished workspace candidates. The old `0.2.0` release proposal
was closed; it is not a registry release. No package will be released using a
Flow name. Publication remains a separate, explicitly authorized step.

Update imports to the Zloz package names. Prefer `ZlozGraph`, `ZlozNode`,
`ZlozError`, `ZlozViewOptions`, `zlozView` and `createZlozNodeBodyCache`.
Previous symbol names are deprecated aliases inside the new packages, sharing
constructors and implementation identity. Generic APIs such as `createEditor`,
`updateEditor`, `createElkLayout` and `exportMermaid` keep their domain names.

The [API reference](/fold-kit-experiments/zloz/api/) is titled **Foldkit Zloz API**
and covers all four packages. The previous API entry URL remains reachable.
The workbench workspace is `apps/zloz-demo`, started with `bun run dev:zloz-demo`.
The reference example is `/zloz`; `/flow` redirects there.

Existing version-one graph JSON, Mermaid bundles and local drafts remain
readable. Retained protocol strings, identity `flowId` fields, local-storage
keys, `data-flow-*` attributes and `--flow-*` theme variables deliberately keep
their old spelling. They preserve user data and custom integrations. The root
view has both `foldkit-zloz` and legacy `foldkit-flow` CSS classes.

Archived qualifications, screenshots and parser-spike records retain the names
they actually measured. They are historical evidence, not current installation
instructions. New checks qualify the renamed tarballs independently.
