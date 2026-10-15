# ADR-004: Toolchain: Bun, TS 7, effect/Arbitrary, Playwright under Bun

- Status: Accepted (2026-10-14)
- Evidence: [spike results](../spike-results.md)

## Decision

| Concern                                        | Choice                                                                                                       | Notes                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Runtime, package manager, bundler, test runner | Bun 1.4.x (workspace `packageManager: bun@1.4.3`)                                                            | The demo is built from an HTML entrypoint with `Bun.build`.                              |
| Types                                          | TypeScript 7.0.2 (`tsc -b`)                                                                                  | Declarations come from `tsc` (`emitDeclarationOnly`). `bun build` emits JavaScript only. |
| Lint                                           | oxlint 1.88.0 + `@opsydyn/oxlint-effect@2.0.1` `allRules` + type-aware via `oxlint-tsgolint`                 | Runs under `bunx --bun`, so Node isn't needed.                                           |
| Format                                         | oxfmt 0.73.0, `printWidth: 100`                                                                              | The source brief is excluded so it stays verbatim.                                       |
| Property tests                                 | `effect/Arbitrary` (`schema`, `checkEffect`, seeds, replay tokens) behind `test/property.ts`                 | The module is unstable, so `effect` is pinned exactly.                                   |
| Effect tests                                   | Small in-repo `itEffect` harness for `bun:test` with `TestClock`                                             | `@effect/vitest` requires vitest.                                                        |
| Browser and visual tests                       | Playwright 1.64.1 **library** under `bun test`, headless shell + SwiftShader, compared with `pixelmatch`     | Two renders were pixel-identical in the spike.                                           |
| Benchmarks                                     | `mitata`                                                                                                     | Budgets are in PLAN §8, Phase 5.                                                         |
| API report                                     | API Extractor (bundles TS 5.9, reads emitted `.d.ts`)                                                        |                                                                                          |
| API reference site                             | TypeDoc in an isolated docs workspace pinned to `typescript@6`                                               | TypeDoc doesn't support TS 7 yet.                                                        |
| Pins                                           | `effect@4.0.0`, `@effect/platform-browser@4.0.0`, `foldkit@0.168.0`, `three@0.186.1`, `@types/three@0.186.0` | Exact versions. `check:single-effect` guards against duplicate copies.                   |

## Node policy

The effect-three packages need nothing but Bun. Node 22+ is allowed only for a tool that can't run under Bun, and as of this ADR there is none.

The surrounding fold-kit-experiments workspace still requires Node ≥ 22.12 for Astro, Vite and its integration tests. That doesn't affect these packages.

TypeScript 7 and oxlint 1.88 are package-local devDependencies. The rest of the workspace stays on TypeScript 6 and oxlint 1.79.
