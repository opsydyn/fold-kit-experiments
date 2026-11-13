# Retained layout SVG contract — local evidence

- result: complete
- claim: core captures and plans detached retained routes/label envelopes with source/key freshness and explicit fidelity findings; the writer rejects unsupported retained geometry.
- evidence: focused regression tests, installed tarball consumers, root check/typecheck/full tests; details below.
- remaining uncertainty: retained SVG writing, custom adapter geometry context, emitted-file/browser fidelity, PNG adoption and large-model performance are not qualified by this contract slice.
- next: implement retained SVG writing and explicit workbench opt-in, then qualify emitted files before PNG adoption.

## Contract and scope

[ADR 0075](../adr/0075-plan-retained-layout-svg-fidelity.md) records the public
capture/options API, native authored-geometry precedence, source/key checks and
boundaries. Core owns only pure typed geometry; hosts own renderer identity,
measurement provenance and invalidation. No source/Undo/CLI/IO/dependency changes.
The main checkout's unrelated work was preserved; implementation remained in
`/private/tmp/foldkit-zloz-context-map-20261111`.

## Verification

Host command evidence (local, not independent review or hosted qualification):

- Baseline `bun typecheck` and `bun run check` exited 0.
- Red regression: new capture import failed before implementation, recorded in
  `/private/tmp/zloz-svg-layout-red.log`.
- Focused SVG planner/writer tests: 19 pass, 158 assertions. Covers independently
  specified route/label union bounds, detachment, exact-source and renderer-key
  staleness, duplicate/unknown/incomplete/non-finite/overflowed geometry, positive
  label dimensions, authored bends/styles, fixed crops, custom/omitted bounds,
  editing rejection and explicit writer blocking even with loss acceptance.
- Installed tarball test exercises exported capture/options types, route bounds
  and writer rejection in actual Node/Bun runtime and strict type consumers.
- Initial full tests stopped at the existing workspace packing fixture because
  the sandbox denied writing Bun's user cache (`EPERM`); rerun with local cache
  access. No production code change was needed for that environment failure.
- Final `bun run check`, `bun typecheck` and `bun run test` exited 0. Check retains
  existing lint advisories; this is not a warning-free claim.
- `git diff --check` passed.

Baseline logs: `/private/tmp/zloz-svg-layout-baseline-{types,check}.log`.
Final logs: `/private/tmp/zloz-svg-layout-final-{check,types,tests}.log`.
No screenshots were added because this slice has no UI or new emitted artifact.

## Self-review

Architecture/boundary: safe with noted host-key risk. Source/key checks detect
mismatches but cannot verify that a host recomputed a route before recapture.
No browser dependency enters core. Snapshots are transient typed values, not
untrusted wire records, and are copied again when planning.

Delivery: existing export remains the default; opt-in layout cannot silently
fall through the canonical writer. The blocking finding remains unsupported even
when losses are accepted. Existing review and PNG flows do not opt in.

Test quality: expected bounds use independent fixture coordinates. Removing
stale checks, ignoring route boxes, ignoring precedence, shallow-copying geometry
or allowing canonical fallback would each violate explicit assertions. Font
ink, custom visual equivalence, browser-rendered files and performance remain
outside these tests. No independent reviewer or agent was used.

Recommendation: **needs follow-up** for retained-route writer support; this
headless planning slice is ready for local commit. No publishing or deployment.
