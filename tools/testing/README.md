# Monorepo test index

Run these commands from the repository root. On a fresh checkout, use the Bun version pinned in `package.json`, Node 24 and uv, then run `bun install --frozen-lockfile`. The Teams runtime suite also needs Playwright Chromium. CI installs it from `apps/zloz-team` with `bunx --no-install playwright install --with-deps --only-shell chromium`.

| To run                                             | Command                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Full workspace test suite                          | `bun run test`                                                                               |
| P0 tests for release-blocking user impact          | `bun run test:p0`                                                                            |
| All Vitest projects                                | `bun run test:vitest run`                                                                    |
| Astro Effect UI renderer tests                     | `bun run test:vitest run --project astro-effect-ui`                                          |
| Cartesian scale tests                              | `bun run test:vitest run --project foldkit-viz`                                              |
| Watch a workbench test                             | `bun run test:vitest watch --project zloz-demo history.test.ts`                              |
| One workspace and its build prerequisites          | `bun moon run web:test`, `bun moon run zloz-demo:test` or `bun moon run foldkit-viz-py:test` |
| One package integration suite                      | `bun moon run astro-foldkit:integration`                                                     |
| Zloz Playwright journeys                           | `bun run ci:foldkit-zloz`                                                                    |
| Effect Three and Dash browser and packaging checks | `bun run ci:effect-three`                                                                    |
| Web mutation advisory for a committed diff         | Follow the [Mutant Cafe local replay instructions](../../docs/spikes/mutant-cafe.md#verdict) |

`bun run test` runs the root tool tests and each workspace's Moon `test` task, including Bun, Vitest and pytest suites. Moon builds declared prerequisites first, including the widget bundle and schema that pytest imports. After this phase succeeds, Moon runs the package `integration` tasks. They share a mutex because they rebuild or pack files that other tests read.

Moon reuses cached results on later runs. Use `bun run ci:clean -- test` to exercise the committed entry point in a fresh checkout with an empty task cache. Browser and mutation commands above have their own setup in the [CI workflow](../../.github/workflows/ci.yml) and [mutation workflow](../../.github/workflows/web-mutation-advisory.yml).

The [Dataset Explorer cache advisory](../../.github/workflows/dataset-cache-advisory.yml) runs the web cache tests against two generated constant keys and one custom station-only key. The artifact includes the control and per-specimen Vitest reports. The [field guide](https://opsydyn-web.opsydyn.workers.dev/mutant-field-guide#inventory-title) archives the verdicts under the package that owns the cache.

The [Dash CSV advisory](../../.github/workflows/dash-csv-advisory.yml) tests seven replacements for `typed`, the function that turns CSV cells into values. Run the control with `bun run test:vitest run --project foldkit-dash`. To replay the mutants locally, install the [pinned tool](../../tools/mutant-cafe/package.json) with `npm ci --prefix tools/mutant-cafe`, then run `bash tools/mutant-cafe/dash-csv.sh "$(mktemp -d)"` from the repo root. The [field guide notes](../../docs/spikes/mutant-cafe.md#field-guide-history) explain how to read the verdicts.

## P0 tests

Use the shared Vitest tag `{ tags: ['p0'] }` on a test when its failure would justify holding a release. Name the user impact in the test. The first two [Zloz history tests tagged P0](../../apps/zloz-demo/test/history.test.ts) protect the working document and undo history when someone reviews an older edition and returns to the present.

Run `bun run test:p0` locally. CI runs the same check alongside the full suite, so a draft-preservation regression has its own PR result. The check fails if the filter runs zero P0 tests. The full suite also runs tagged tests.

## Testing Effect UI workspaces

The root Vitest command asks Moon to build the tagged apps’ workspace dependencies, then forwards the arguments to Vitest 5. Use `bun run test:vitest list --filesOnly` to see which files each project discovers. The root config loads each app’s existing Vitest config, which chooses its test files and environment. The web app uses happy-dom and its CSS transform. The Zloz demo and the Cartesian scale tests in foldkit-viz run in Node. The [axis mutation advisory](../../.github/workflows/viz-axis-advisory.yml) runs the Cartesian suite against three label replacements in an isolated copy of the package source and archives those outcomes in the field guide. The [Astro client mutation advisory](../../.github/workflows/astro-effect-ui-advisory.yml) exercises the standalone renderer. The Viz package’s other unit tests run under Bun in the workspace test job.

The private `@opsydyn/testing/tags` entry supplies the shared Vitest tags. `foldkit-vitest` is the existing Moon tag for preparing the Vitest workspaces.

- Use plain assertions for pure functions and individual update decisions.
- Use property-based tests when a rule should hold across generated inputs. The [viewport tests](../../packages/foldkit-viz/test/interaction-properties.test.ts) use `fast-check` to generate domains, spans and zoom factors, then check that the resulting viewport stays within bounds. Run them with `bun moon run foldkit-viz:test` as part of the package suite.
- Send a sequence of messages through the real update function to check model or command outcomes. See the resize and return-to-present test in [history.test.ts](../../apps/zloz-demo/test/history.test.ts).
- Use `HtmlScene` and `HtmlLocator` from `@effect/ui/html/testing` to drive a rendered control by accessible role. Resolve commands explicitly at this boundary. Exercise the actual command with `it.effect` when its result matters. [bootstrap.test.ts](../../apps/zloz-demo/test/bootstrap.test.ts) covers both the allocation command and the retry UI.
- Use a browser or runtime integration test for real ports, layout, canvas output or cross-client behavior.
