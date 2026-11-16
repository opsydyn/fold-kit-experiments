# Zloz 0.6.0 release candidate

Status: **reviewable engineering candidate; human acceptance pending; no npm publication**. This record
covers the approved remaining v3 core batch. It supersedes earlier “recommended
next” entries for native v3 authoring/gesture adoption, not their historical evidence.

## Candidate identity and package scope

The currently published baseline is 0.5.0. The proposed next linked minor is
**0.6.0**, subject to release-please regeneration after the feature PR merges.
Source package manifests retain their published baseline on the feature branch;
these are not falsely versioned/published 0.6.0 tarballs.

| Package                         | Proposed candidate | Release disposition                                       |
| ------------------------------- | ------------------ | --------------------------------------------------------- |
| `@opsydyn/foldkit-zloz`         | 0.6.0              | Public core and optional FoldKit/browser entries          |
| `@opsydyn/foldkit-zloz-elk`     | 0.6.0              | Linked version and core peer; native v3 layout            |
| `@opsydyn/foldkit-zloz-force`   | 0.6.0              | Linked version and core peer; existing eligibility limits |
| `@opsydyn/foldkit-zloz-mermaid` | 0.6.0              | Native export and portable review packets                 |
| `@opsydyn/foldkit-zloz-cli`     | Private            | Effect CLI; no npm artifact                               |
| `@opsydyn/foldkit-zloz-alchemy` | Private            | Existing explicit compatibility/projection gates          |

No package named Flow is a release candidate. Existing historical protocol fields
and legacy import contracts are not renamed inside portable documents. Core remains
peer-free for headless consumers; FoldKit/Effect and browser IO remain optional.

## Draft release notes

- Complete native v3 authoring: strict modelling-patch source/intent decoding,
  dry-run findings, exact proposal/loss review, live-policy atomic Apply and one
  full-document Undo. Strict receipts recompute the recorded target.
- Native C4/DDD mapping, explicit choices, ambiguities, provenance and loss consent
  preserve authored group sockets, all checkpoint modes/capabilities and archives.
  Downloaded conversion receipts reopen as read-only evidence.
- Native full-document DDD/EventStorming audits and edition comparisons expose
  introduced/resolved findings. Optional Mermaid review packets retain chosen
  native checkpoints and explicitly report projection losses.
- Native pointer resize, port-anchor drag/nudge, reconnection dragging, box
  selection and opt-in pinch share the scoped input resource and live planners.
  Controls are composable/optional and required protection reasons remain visible
  in minimal mode. Native pointer geometry survives canvas reflow.
- Effect CLI selects strict native v3 document, audit, patch dry-run, packet and
  receipt-inspection adapters. Existing v1/v2 codecs stay version-fixed. The CLI
  remains read-only and private.
- Workbench demonstrations cover exact review/Apply, atomic receipt retention,
  validated downloads, bounded UTF-8 file reopening, stale completion rejection,
  independent before/after review, themes and protected/minimal controls.
- Mobile shell navigation now has usable touch targets and a header that grows
  when links wrap. Qualification found this issue; the rule was not suppressed.

## Automated qualification

The user approved the provisional matrix: Chromium, Firefox and WebKit, desktop
1440×1000 and touch-capable 390×844 viewports, with 100/1,000-node flat/nested
scenarios. Browser emulation is not physical-device evidence.

The checked-in [suite](../../apps/web/e2e/zloz-native-release.spec.ts) covers real
SSR page-owner hydration and DOM reuse, keyboard/focus, native pointer gestures,
live protection, Undo, review download/reopening and corruption recovery. Chromium
CDP supplies a separate synthetic multitouch check. Other real-device pinch is
unqualified until human acceptance. Axe-core runs the WCAG 2/2.1/2.2 A/AA tags on
light, dark and protected/minimal forms; its `incomplete` findings remain manual
review work. See [axe's API and scope](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md).

Performance observations record host, source fingerprint, sample count, mounting
and five keyboard-to-two-frame timings per scenario. Scheduling, headless browsers,
background workload and rendering complexity affect those measurements. **No numeric
latency budget or cross-library superiority threshold has been agreed.** No blanket
React Flow parity or accessibility conformance is claimed.

Local result counts, exact source fingerprint and selected screenshots are recorded
in [the evidence directory](../../apps/zloz-demo/evidence/v3-completion/).
Root checks, tarball consumer results, clean CI rehearsal and PR checks are recorded
in the delivery section once observed. A successful pack is not registry evidence.

Reproduce against a built preview (no production credentials required):

```sh
bun install --frozen-lockfile
bun run --filter @opsydyn/zloz-demo build
# In apps/zloz-demo: run the built preview on 127.0.0.1:4387.
bunx --no-install astro preview --host 127.0.0.1 --port 4387
# In apps/web; install the browsers first if this host has no Playwright cache.
ZLOZ_QUALIFICATION_URL=http://127.0.0.1:4387 bun run test:zloz:release
# At the workspace root:
bun tools/summarize-zloz-qualification.ts
```

The `ci:foldkit-zloz` Moon job also builds the native demo and runs this matrix
in a managed preview on port 4388, alongside the existing editing journey.

Use an otherwise idle host for timing observations. The full matrix and timing-only
run are separate evidence when root builds were running during functional checks.
Do not compare those timings as equivalent workload conditions.

## Human release acceptance — pending

Record tester, OS/browser/device/assistive-technology versions, candidate SHA,
result and evidence for each row. A keyboard or axe run cannot fill these rows.
Use the candidate preview `/groups/`, then `/qualification/100-nested/`.

| Check                       | Procedure                                                                                                                                                                                                                          | Current result |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| VoiceOver + Safari on macOS | Navigate landmarks and node/edge/port/resize controls. Verify names, focus order, live protection/status announcements, exact loss acknowledgement, read-only review and recovery from a corrupt receipt.                          | Not observed   |
| Screen-reader graph editing | Select and nudge a node/anchor; use inspector reconnection; Apply a reviewed patch; Undo once; reopen its receipt and switch Before/After without entering editable state.                                                         | Not observed   |
| Physical touch              | On an actual iPhone/iPad Safari and Android Chrome, check target access, drag/cancel, two-finger pinch, panning, port connections, file download/reopening and sidebar/canvas visibility. Record unavailable platforms explicitly. | Not observed   |
| Zoom/reflow/contrast review | Check 200%/400% zoom, large text, visible focus, forced colors and the manual/incomplete axe contrast findings. Essential reasons must remain available in minimal mode.                                                           | Not observed   |
| Motion preference           | With the OS reduced-motion setting, verify history playback and native canvas controls remain usable without obligatory animation.                                                                                                 | Not observed   |

These are qualification gates before calling the candidate fully release-qualified.
Engineering and a reviewable release proposal can be complete while these remain
pending; they must be disclosed in any release decision.

## Explicit remaining product limits

World coordinates, explicit group parents and rectangular group envelopes are
intentional conventions. Rotation, lasso/freehand/eraser, dedicated multi-connect
UI, production Mermaid import, server PNG, collaboration/provider activation and
arbitrary custom-renderer fidelity are outside this core release. Atomic explicit
connection sets already exist headlessly. Mermaid/static images do not preserve all
editable model semantics; keep canonical model JSON. Alchemy remains private with
its compatibility gates. These are future catalogue items, not hidden 0.6.0 promises.

## Delivery and release procedure

1. Finish root lint/format/typecheck/tests, installed Node/Bun and Bundler/NodeNext
   consumers, API docs and demo build. Commit with Moon pre-commit checks.
2. Run `bun run ci:clean` on committed HEAD, then push the feature branch and open
   its PR. Check hosted CI independently of local results.
3. After feature merge, let release-please regenerate its linked package release
   PR. Confirm all four versions/core peers are 0.6.0, lockfile and changelogs agree,
   private packages remain private and pack/identity/CI checks pass on that SHA.
4. Record human acceptance (or an explicit release decision with its remaining
   limits) before declaring full qualification. Review the concrete release PR.
5. **Do not merge a publishing release, tag/publish npm artifacts or dispatch the
   manual Zloz publishing workflow in this task.** No hosted deployment or registry
   acceptance is inferred from local tests. Publishing requires its own authority.

Recommended next after this batch: complete the human acceptance rows, then review
the regenerated 0.6.0 release PR and exact linked package artifacts. No additional
optional core feature is needed before that decision.

### Local engineering results (2026-11-16)

- `bun run check` and root `bun typecheck`: passed. The existing Viz skill-version
  advisory is unchanged; it does not fail the check.
- Root `bun run test`: passed, including installed core/optional adapters and the
  private CLI under Node and Bun with Bundler/NodeNext contracts. The final native
  relation-choice correction additionally passes all 205 workbench tests.
- Zloz API docs and the eight-page built demo: passed.
- Managed-preview browser matrix: **56 passed, 4 intentionally skipped, 0 failed**.
  All six browser/viewport combinations pass C4/DDD explicit relation review,
  atomic receipt download and independent read-only reopening.
- 24 flat/nested node-count observations and 18 axe scans are retained. Axe reports
  zero violations, with incomplete contrast/name checks left for human review.
  Browser versions: Chromium 151.0.7922.34, Firefox 153.0, WebKit 26.5.
- Selected visual evidence and timing/source/artifact fingerprints are in the
  [evidence record](../../apps/zloz-demo/evidence/v3-completion/README.md).

Committed clean CI rehearsal and hosted PR checks passed on `bd776638`;
subsequent delivery commits must pass on their own final head. Human device/screen-reader acceptance remains pending. No npm publication.

### Delivery checkpoint

Feature PR: [#151](https://github.com/opsydyn/fold-kit-experiments/pull/151).
Engineering commit `cb84f992`; generated-output CI correction `557179b5` and
browser-harness routing correction `bd776638`.
The committed clean rehearsal on `557179b5` passed 84 check/build tasks and
14 integration tasks (236 seconds). The clean rehearsal also passed on `bd776638`
(237 seconds); its hosted general check, Astro compatibility, Three and Zloz
browser jobs all passed. Hosted checks must remain green on the final PR head
before merge. A force consumer timeout on the preceding head did not reproduce
in the successful hosted run (13.6 seconds); bounded subprocesses and stage labels
make any recurrence actionable without changing the simulation or weakening checks. The default web-app browser harness
excludes the native Zloz suite, which has its own built-app configuration.

A read-only registry check on 2026-11-16 confirmed all four public packages at
0.5.0. No npm upload, release tag, release-please merge or deployment was performed.
The linked 0.6.0 release PR remains the next release-please step after feature merge
and the human acceptance decision.
