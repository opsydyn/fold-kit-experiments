# ADR-003: Kernel/runtime layering under "all oxlint-effect rules, no exceptions"

- Status: Accepted (2026-10-14)
- Evidence: [d2-lint-layering spike](../../../packages/effect-three/spikes/d2-lint-layering), [spike results](../spike-results.md#d2-numbers-1000-keyed-nodes-mitata-apple-silicon)

## Context

The project enables every rule in `@opsydyn/oxlint-effect@2.0.1` for Effect 4 (`allRules`, 141 rules), plus type-aware TypeScript rules, with no disables.

Several rules are import-gated: they apply only to files that import `effect`. They forbid `if`, `switch`, ternaries and `return` in callbacks. Written that way, a keyed diff over 1,000 nodes is 11–21× slower (0.51 ms no-op against a 0.2 ms budget).

## Decision

Two sanctioned layers in `packages/effect-three/src`:

- **`kernel/`**: plain TypeScript that **must not import `effect`**. It holds the diff, the applier, behaviours, the per-frame tick and raycasting. Ordinary control flow is allowed. Every rule that is not import-gated still applies, as do strict TypeScript, `no-explicit-any` and the type-aware rules. Allocation-conscious, with exhaustive property tests.
- **`runtime/`**: Effect code (services, scopes, Layers, errors, streams). Every rule applies.

Rules of the road:

1. Effect owns **lifetimes**, not frames. The per-frame callback is a plain function registered inside `acquireRelease`.
2. `boundaryPaths` for runtime-execution rules is configuration, not an exception (`packages/effect-three/oxlint.strict.ts`).
3. No `// oxlint-disable` comments anywhere.
4. Each package's `spikes/` folder is outside the lint path. It is throwaway evidence and is deleted after Phase 1.

## Enforcement

- `packages/effect-three/scripts/check-boundaries.ts`: `src/kernel/**` can't import `effect` or `@effect/*`, and `src/**` can't import `foldkit`, `react` or `@effect/platform-browser`.
- `packages/effect-three/tsconfig.json` has `lib: ["ES2023"]` with no DOM, so any DOM global in core fails compilation.
- The workspace root `bun run check` runs these packages' strict lint, boundary and single-`effect` checks after the root lint. Root `bun typecheck` and `bun run test` include both packages.

## Placement in fold-kit-experiments

Both packages live in this monorepo. The root `oxlint.config.ts` (oxlint-effect 0.4.0, `recommended`) ignores them, and they run `oxlint.strict.ts` with a package-local `@opsydyn/oxlint-effect@2.0.1`. That works because the workspace uses Bun's isolated linker. The strict config is deliberately **not** named `oxlint.config.ts`: the root `oxlint .` would auto-discover it as a nested config and reject its type-aware option.

## Consequences

- The hot path keeps the 0.2 ms reconcile and zero-allocation frame budgets in reach.
- Reviewers must keep `kernel/` small and pure-ish. Anything with a lifetime belongs in `runtime/`.
- Rules that fight explicit public types (`no-manual-effect-channels`, `no-effect-type-alias`) are satisfied by inferred types. Public API documentation comes from emitted `.d.ts` files and TSDoc, and `isolatedDeclarations` stays off.
