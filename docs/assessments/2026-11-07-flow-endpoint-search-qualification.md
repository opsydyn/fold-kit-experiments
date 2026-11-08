# Searchable grouped endpoint qualification

- **result:** complete
- **claim:** shared package-level search/grouping and native controls work for
  creation and reconnection, with Model-owned workbench queries.
- **evidence:** workspace gates, 226 Flow tests, strict packed consumer, TypeDoc,
  production sample build, five browser probes and inspected screenshots.
- **remaining uncertainty:** large-graph latency, native popup arrow navigation,
  screen-reader/device, CI and hosted/registry qualification are not established.
- **next:** benchmark projection/policy cost and browser typing latency on larger
  workflows before selecting an optimization.

## Package behavior

`resolveEndpointChoices` is a pure presentation projection shared by creation
and reconnection. It matches literal case-insensitive tokens across labels and
endpoint IDs, preserves entry/event references and input order, and retains
current selections even when they do not match. Node groups use node identity,
so equal labels do not merge unrelated nodes. Optional node-label metadata has an
ID fallback for older/custom entries.

Native field/select/reasons options accept `query`, `groupByNode` and custom
`groupLabel`; flat unfiltered behavior remains the default. No-results feedback
explicitly explains retained selections. Matching protected choices remain
disabled and operation-wide reasons remain visible. Empty creation results keep
their placeholder instead of implicitly selecting another endpoint.

The FoldKit entry provides controlled search input, Clear and feedback
primitives. Escape in a search clears only that query; creation-select Escape
still cancels a pending source. Clear remains focusable after its action. Query
changes do not edit the graph or history. The workbench stores four query strings
in its Model and composes package primitives for creation and reconnection;
matching/grouping is not duplicated in Astro. Queries remain view preferences
across Undo and selection changes, with explicit Clear controls.

## Evidence

- `bun typecheck`: exit 0 across the workspace; the affected package typecheck
  also passed after the final feedback-copy refinement.
- `bun run check`: exit 0, including formatting and catalog validation.
- `bun run test`: final workspace rerun exited 0; Flow reported 226 passed,
  zero failed, including the strict packed-consumer test.
- Six new tests cover token/ID/literal matching, protected current selection
  retention, stable grouping/order, equal node labels, legacy metadata fallback,
  stale authorization rejection, native groups/custom labels, no-result
  placeholders, controlled search input and associated feedback.
- The strict external packed consumer compiles the new pure resolver, grouped
  native controls and query primitives against installed local npm tarballs.
  The initial full run caught an inline fixture message whose tag widened to
  `string`. The fixture now uses FoldKit's `defineMessageUnion`; its isolated
  packed-consumer rerun passed before the full suite was restarted.
- `bun run --filter @opsydyn/foldkit-flow docs`: exit 0 with TypeDoc warnings
  treated as errors. README, changelog and ADR 0004 document the new contract.
- `bun run --filter @opsydyn/flow-sample build`: exit 0.
- From `apps/web`, `bun - < ../flow-sample/evidence/endpoint-search-browser.mjs`:
  exit 0. It verifies native grouping, literal search, pinned current selections,
  protected choices, query-only Escape/Clear, focus, keyboard creation and
  reconnection, Undo/Redo and minimal mode, with no captured page errors.
- Existing creation, keyboard-reconnection, reconnection-permission and
  port-permission browser probes: exit 0 against the final sample build. The
  creation probe now traverses the newly composed search controls in natural Tab
  order. Historical screenshots remain preserved; this slice adds new evidence.

The keyboard evidence uses native select type-ahead. Native popup arrow
navigation, screen-reader and physical-device acceptance are not established by
this slice. No CI, hosted deployment or npm publication was performed.

## Visual evidence

- [Creation search with a retained source and protected target](../../apps/flow-sample/evidence/endpoint-search-creation.png)
- [Reconnection search with a retained protected selection](../../apps/flow-sample/evidence/endpoint-search-reconnection.png)

Both final screenshots were inspected. Group structure is asserted against native
`optgroup` elements; the closed-select screenshots primarily show query, retained
selection and protection feedback.

## Self-review

Boundary verdict: **safe with noted risk**. The pure projection imports only a
core type; FoldKit/Effect remain in the optional adapter. Existing operation
contexts/events and commit-time policies are preserved. There is no package-owned
query store, document-schema change, dependency, direct DOM mutation or custom
combobox state machine. Native control identity and current option identity remain
stable while filters change. Tests cover both permitted and denied commits, not
only rendered option counts.

Filtering reduces the displayed choices; it does not virtualize the list or
reduce candidate policy evaluation. No response-time or large-graph performance
claim is made. Recommend a bounded benchmark of projection cost and browser typing
latency on larger workflows before choosing an optimization.

Recommendation: **needs follow-up** for that measured performance slice. No PR or
publication is requested.
