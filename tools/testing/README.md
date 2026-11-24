# Monorepo test index

Run these commands from the repository root. On a fresh checkout, use the Bun version pinned in `package.json`, Node 24 and uv, then run `bun install --frozen-lockfile`. The Teams runtime suite also needs Playwright Chromium. CI installs it from `apps/zloz-team` with `bunx --no-install playwright install --with-deps --only-shell chromium`.

| To run                                                     | Command                                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Full workspace test suite                                  | `bun run test`                                                                               |
| P0 tests for release-blocking user impact                  | `bun run test:p0`                                                                            |
| Both Vitest apps                                           | `bun run test:vitest run`                                                                    |
| One Vitest app                                             | `bun run test:vitest run --project web` or `bun run test:vitest run --project zloz-demo`     |
| Watch a FoldKit Story or Scene                             | `bun run test:vitest watch --project zloz-demo history.test.ts`                              |
| One workspace and its build prerequisites                  | `bun moon run web:test`, `bun moon run zloz-demo:test` or `bun moon run foldkit-viz-py:test` |
| One package integration suite                              | `bun moon run astro-foldkit:integration`                                                     |
| Zloz Playwright journeys                                   | `bun run ci:foldkit-zloz`                                                                    |
| Effect Three and FoldKit Dash browser and packaging checks | `bun run ci:effect-three`                                                                    |
| Web mutation advisory for a committed diff                 | Follow the [Mutant Cafe local replay instructions](../../docs/spikes/mutant-cafe.md#verdict) |

`bun run test` runs the root tool tests and each workspace's Moon `test` task, including Bun, Vitest and pytest suites. Moon builds declared prerequisites first, including the widget bundle and schema that pytest imports. After this phase succeeds, Moon runs the package `integration` tasks. They share a mutex because they rebuild or pack files that other tests read.

Moon reuses cached results on later runs. Use `bun run ci:clean -- test` to exercise the committed entry point in a fresh checkout with an empty task cache. Browser and mutation commands above have their own setup in the [CI workflow](../../.github/workflows/ci.yml) and [mutation workflow](../../.github/workflows/web-mutation-advisory.yml).

## P0 tests

Use the shared Vitest tag `{ tags: ['p0'] }` on a test when its failure would justify holding a release. Name the user impact in the test. The first two [Zloz history tests tagged P0](../../apps/zloz-demo/test/history.test.ts) protect the working document and undo history when someone reviews an older edition and returns to the present.

Run `bun run test:p0` locally. CI runs the same check alongside the full suite, so a draft-preservation regression has its own PR result. The check fails if the filter runs zero P0 tests. The full suite also runs tagged tests.

## Testing Effect and FoldKit workspaces

The root Vitest command asks Moon to build the tagged apps’ workspace dependencies, then forwards the arguments to Vitest 5. Use `bun run test:vitest list --filesOnly` to see which files each project discovers. The root config loads each app’s existing Vitest config, which chooses its test files and environment. The web app uses happy-dom and its CSS transform. The Zloz demo runs in Node.

Each workspace's Vitest setup file imports `@opsydyn/testing/foldkit`. This registers FoldKit's Scene matchers and makes their types available to the workspace test compiler. Consumers declare the private package as a workspace dev dependency and use the `foldkit-vitest` Moon tag so changes here invalidate their cached checks.

- Use plain assertions for pure functions and individual update decisions.
- Use property-based tests when a rule should hold across generated inputs. The [viewport tests](../../packages/foldkit-viz/test/interaction-properties.test.ts) use `fast-check` to generate domains, spans and zoom factors, then check that the resulting viewport stays within bounds. Run them with `bun moon run foldkit-viz:test` as part of the package suite.
- Use `Story.story` to send a sequence of messages through the real update function and check model or command outcomes. See the resize and return-to-present test in [history.test.ts](../../apps/zloz-demo/test/history.test.ts).
- Use `Scene.scene` to drive a rendered control by its accessible role and check what the user sees. Resolve commands explicitly at this boundary. Exercise the actual command with `it.effect` when its result matters. [bootstrap.test.ts](../../apps/zloz-demo/test/bootstrap.test.ts) covers both the allocation command and the retry UI.
- Use a browser or runtime integration test for real ports, layout, canvas output or cross-client behavior.
