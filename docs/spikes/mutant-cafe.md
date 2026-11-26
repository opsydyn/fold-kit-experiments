# Mutation testing with mutant.cafe

A trial of [mutant.cafe](https://github.com/joelhooks/mutant-cafe) `0.1.4` (2026-11-03) on
`apps/web`'s Stateflow Observatory and request diagnostics. mutant.cafe reads a function's
return type, replaces the body with a plausible value of that type (for an `Effect`, a
success, each declared failure, a defect or `Effect.never`), runs the Vitest tests related
to the file, and lists the replacements no test notices.

## How it was run

Locally, from `apps/web`, without adding it as a dependency: it bundles its own Effect
`4.1.2`, which `check-single-effect.ts` would reject beside the workspace's `4.1.0`. It needs
Node 24 or newer (CI runs 22) and a Vitest suite, so of this repository's workspaces only
`apps/web` qualifies; the `bun test` workspaces would report every result as unreliable.

```sh
cd apps/web
npx -y mutant-cafe@0.1.4 --jobs 6 --output /tmp/mutants.out \
  --file 'src/apps/stateflow/**/*.ts' --file 'src/apps/request-diagnostics/**/*.ts' \
  --exclude '**/*.test.ts' --exclude '**/*.css.ts'
```

339 mutants ran in about five minutes. In a fresh worktree, run `astro check` first:
without Astro's generated types every `view.ts` mutant fails to compile and is reported
as unviable, not tested.

## What it found

|                     | Caught | Missed | Untested |
| ------------------- | ------ | ------ | -------- |
| Before              | 180    | 158    | 1        |
| After the new tests | 261    | 77     | 1        |

The misses that were real gaps, now tested:

- **The histogram brush never reached the machine in a test.** Every replacement of
  `selectionMessage` passed, and so did `filterPoints` keeping no points or every point,
  and `applyChartsForState` leaving the scatter alone (`brush.test.ts`).
- **Label settling and rank ordering in the layered layout were untested.** The new test
  found a bug: in the top-to-bottom layout, labels side by side under a state overlapped,
  because the 16px nudges couldn't separate two 18px labels within a 150px rank gap. The
  nudges are now 20px.
- **Node roles, `currentRecord`, Reset keeping the session, the layout choice, and an
  edge with no coverage path** (`graph.test.ts`, `update.test.ts`).
- **No Command was ever run.** `CopyTest`, `CopySessionLink`, `ReportToObservatory` and
  the checkout's `ChargeCard` could fail, hang or answer anything (`command.test.ts`).

## What is left, and why

- **Equivalent mutants.** Some replacements build the value the code already returns,
  such as `CompletedCopy({ what: 'test', copied: false })` for itself. No test can catch them.
- **Drawing details.** Curve points, lane offsets, label widths and empty fallback text in
  the views. They are checked by looking, not worth a test each.
- **Browser subscriptions and the live channel's listener** (`subscription.ts`,
  `live.ts`), which need a running page; the Scene tests stop short of them.

## Verdict

It earns a place as a local check on Effect code with Vitest tests: it found real gaps
and one real bug, cheaply. It is a day old and pre-1.0 (mutant ids may change between
versions), so it stays out of CI and out of the dependencies for now. A wider use waits on
the test runner: moving the `bun test` workspaces to Vitest would bring it to effect-three,
foldkit-viz and the tech radar.

The [apps/web PR trial](../adr/0127-trial-mutation-testing-on-web-pull-requests.md)
revisits this decision with Mutant Cafe 0.1.7 and Node 24 in CI.

To run the same advisory locally on a committed branch, use Node 24 and a
fresh report directory. Choose the base ref for the changes you want to assess.

```sh
bun install --frozen-lockfile
npm ci --prefix tools/mutant-cafe
bun run --filter @opsydyn/web typecheck
report_dir=$(mktemp -d)
bash tools/web-mutation-advisory.sh origin/main "$report_dir"
echo "$report_dir/web-mutants/outcomes.json"
```

On `6581a4b0`, replaying the web changes since the parent of `23b5cc19`
selected seven mutants in Explore's `mount.ts`. All seven survived the related
`update.test.ts` suite, including replacing `PaintScatter.execute` with
`Effect.never`. A second run scoped to request diagnostics' `machine.ts`
selected 33 candidates, ran 20, caught four and missed 16. The 13 beyond the
budget have no outcome.

## Field guide history

After a successful web advisory, the field guide archive workflow imports its report from
the completed run. It executes the importer from the default branch. The compact records
live in `archive.json` on the `field-guide-data` branch. Each record carries the source
commit, run ID, attempt, start time and SHA-256 of the original report. Reprocessing the
same artifact is idempotent. A later attempt adds another observation for the same mutant.

The web guide reads the public archive on request. Updates become visible after GitHub's
raw-content cache refreshes. When that archive is unavailable, the guide labels its bundled
Explore and first portrait records. The archive workflow activates when it reaches the
default branch. A failed archive job can be retried from its Actions run.

The field guide inventories the workspace manifests declared by the root Bun workspace.
The overview shows the latest archived attempt for each workspace and the outcomes recorded
in that attempt. Specimen counts include historical observations. Reports written before
workspace identity was introduced belong to `apps/web` and keep their original specimen URLs.

The Zloz history advisory runs up to two mutants in `apps/zloz-demo/src/editor/history.ts`
on history-related PRs. Its separate report is archived under `apps/zloz-demo`; its specimen
links include the workspace path and mutant ID. The archive workflow backfills both qualifying
advisories when the installing PR reaches main.
