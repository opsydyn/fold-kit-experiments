# Monorepo test index

Run these commands from the repository root. On a fresh checkout, use the Bun version pinned in `package.json`, Node 24 and uv, then run `bun install --frozen-lockfile`. The Teams runtime suite also needs Playwright Chromium. CI installs it from `apps/zloz-team` with `bunx --no-install playwright install --with-deps --only-shell chromium`.

| To run                                                     | Command                                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Full workspace test suite                                  | `bun run test`                                                                               |
| One workspace and its build prerequisites                  | `bun moon run web:test`, `bun moon run zloz-demo:test` or `bun moon run foldkit-viz-py:test` |
| One package integration suite                              | `bun moon run astro-foldkit:integration`                                                     |
| Zloz Playwright journeys                                   | `bun run ci:foldkit-zloz`                                                                    |
| Effect Three and FoldKit Dash browser and packaging checks | `bun run ci:effect-three`                                                                    |
| Web mutation advisory for a committed diff                 | Follow the [Mutant Cafe local replay instructions](../../docs/spikes/mutant-cafe.md#verdict) |

`bun run test` runs the root tool tests and each workspace's Moon `test` task, including Bun, Vitest and pytest suites. Moon builds declared prerequisites first, including the widget bundle and schema that pytest imports. After this phase succeeds, Moon runs the package `integration` tasks. They share a mutex because they rebuild or pack files that other tests read.

Moon reuses cached results on later runs. Use `bun run ci:clean -- test` to exercise the committed entry point in a fresh checkout with an empty task cache. Browser and mutation commands above have their own setup in the [CI workflow](../../.github/workflows/ci.yml) and [mutation workflow](../../.github/workflows/web-mutation-advisory.yml).

## Testing Effect and FoldKit workspaces

The web and Zloz demo workspaces use Vitest 5. Each workspace config chooses its test files and environment. The web app uses happy-dom and its CSS transform. The Zloz demo runs in Node.

Each workspace's Vitest setup file imports `@opsydyn/testing/foldkit`. This registers FoldKit's Scene matchers and makes their types available to the workspace test compiler. Consumers declare the private package as a workspace dev dependency and use the `foldkit-vitest` Moon tag so changes here invalidate their cached checks.

- Use plain assertions for pure functions and individual update decisions.
- Use `Story.story` to send a sequence of messages through the real update function and check model or command outcomes. See the resize and return-to-present test in [history.test.ts](../../apps/zloz-demo/test/history.test.ts).
- Use `Scene.scene` to drive a rendered control by its accessible role and check what the user sees. Resolve commands explicitly at this boundary. Exercise the actual command with `it.effect` when its result matters. [bootstrap.test.ts](../../apps/zloz-demo/test/bootstrap.test.ts) covers both the allocation command and the retry UI.
- Use a browser or runtime integration test for real ports, layout, canvas output or cross-client behavior.
