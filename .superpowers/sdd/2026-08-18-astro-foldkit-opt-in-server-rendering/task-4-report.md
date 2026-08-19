# Task 4 Report: server document resolver

## Status

Implemented the server-only public document resolver for `@opsydyn/astro-foldkit/server` and added focused unit coverage for the resolver contract.

## RED evidence

Command:

```sh
bun test packages/astro-foldkit/test/unit/server-public.test.ts
```

Result before implementation:

- Exit code: `1`
- `0 pass`, `5 fail`
- Failure cause: `resolvePageDocument` still threw the stub error from `packages/astro-foldkit/src/server-public.ts`

## GREEN evidence

Focused unit verification:

```sh
bun test packages/astro-foldkit/test/unit/server-public.test.ts packages/astro-foldkit/test/unit/server.test.ts packages/astro-foldkit/test/unit/client-helpers.test.ts
```

- Exit code: `0`
- `20 pass`, `0 fail`

Packed public-entry verification:

```sh
bun test packages/astro-foldkit/test/integration/package-import-smoke.test.ts
```

- Exit code: `0`
- `2 pass`, `0 fail`
- Confirms `@opsydyn/astro-foldkit/server` resolves to `dist/server-public.mjs` and has no default export

Package typecheck:

```sh
bun run --filter @opsydyn/astro-foldkit typecheck
```

- Exit code: `0`

Package lint/format check:

```sh
bun run --filter @opsydyn/astro-foldkit check
```

- Exit code: `0`
- Existing repo/package warnings remain, but this slice now formats cleanly and does not add new failing checks

## Changed files

- `packages/astro-foldkit/src/server-document.ts`
  - Added the shared document metadata mapper and the server-only `resolvePageDocument(page, context)` implementation
- `packages/astro-foldkit/src/server-public.ts`
  - Re-exported the server document resolver/type from the new internal module
- `packages/astro-foldkit/test/unit/server-document.test.ts`
  - Added TDD coverage for:
    - request/url/params/props -> Flags passthrough
    - public resolver shape excluding build-ID internals
    - optional metadata absence preservation
    - `dir` lowercasing to `ltr`/`rtl`/`auto`
    - `noMeta` not suppressing resolver metadata
    - missing build ID failure

## Implementation notes

- Public API stays at two arguments: `resolvePageDocument(page, { request, url, params, props })`
- Resolver uses the same page factory, synchronous flag derivation, internal build-ID reader, and `renderFoldkitServerApplication` pipeline as the Astro renderer
- Metadata mapping preserves `title`, optional `lang`, `dir`, `canonical`, and `ogUrl`, while leaving omitted optional fields absent rather than fabricating empty values

## Concerns

- `bun run --filter @opsydyn/astro-foldkit check` still reports pre-existing package warnings outside this task slice (`src/server-render.ts`, existing client tests, existing integration smoke test). They do not block the command or this implementation, but they remain part of the baseline.

## Fix Round 1

Aligned the resolver tests with the Task 4 brief and the review:

- moved the resolver coverage to `packages/astro-foldkit/test/unit/server-document.test.ts`
- removed the misleading build-ID-sensitive `ogUrl` assertion
- replaced it with a real public-surface assertion that resolver results do not expose `buildId`
- kept missing-build-ID failure coverage in the resolver tests
- kept exact build-ID propagation evidence in `packages/astro-foldkit/test/unit/server.test.ts`
- made the `noMeta` resolver case explicitly show `shouldSkipMetadata(...) === true` while the resolver still returns page metadata

### Fix RED

Command:

```sh
bun test packages/astro-foldkit/test/unit/server-document.test.ts
```

Exact output:

```text
bun test v1.3.11 (af24e281)
The following filters did not match any test files:
 packages/astro-foldkit/test/unit/server-document.test.ts
996 files were searched [16.00ms]

note: Tests need ".test", "_test_", ".spec" or "_spec_" in the filename (ex: "MyApp.test.ts")
note: To treat the "packages/astro-foldkit/test/unit/server-document.test.ts" filter as a path, run "bun test ./packages/astro-foldkit/test/unit/server-document.test.ts"

Learn more about bun test: https://bun.com/docs/cli/test
```

### Fix GREEN

Command:

```sh
bun test packages/astro-foldkit/test/unit/server-document.test.ts packages/astro-foldkit/test/unit/server.test.ts packages/astro-foldkit/test/unit/client-helpers.test.ts
```

Exact output:

```text
bun test v1.3.11 (af24e281)

packages/astro-foldkit/test/unit/server-document.test.ts:
(pass) resolvePageDocument > derives Flags from request/url/params/props and returns rendered document metadata [6.25ms]
(pass) resolvePageDocument > returns only the public document metadata fields when a build identity is configured [1.08ms]
(pass) resolvePageDocument > preserves absent optional metadata fields instead of filling them in [2.03ms]
(pass) resolvePageDocument > returns page document metadata even when client noMeta logic would suppress island metadata writes [1.12ms]
(pass) resolvePageDocument > fails closed when the build identity is missing [0.15ms]

packages/astro-foldkit/test/unit/server.test.ts:
(pass) astro-foldkit server renderer > renders a deterministic FoldKit mount shell [0.09ms]
(pass) astro-foldkit server renderer > recognizes only FoldKit components [0.05ms]
(pass) astro-foldkit server renderer > renders a definePage component through the FoldKit server path [0.72ms]
(pass) astro-foldkit server renderer > rejects a second page owner for the same Astro result [0.43ms]
(pass) astro-foldkit server renderer > fails closed for page rendering when the build identity is missing [0.02ms]

packages/astro-foldkit/test/unit/client-helpers.test.ts:
(pass) shouldSkipMetadata > returns true for noMeta: true (JSX boolean prop) [0.02ms]
(pass) shouldSkipMetadata > returns true for noMeta: "" (HTML boolean attribute shorthand)
(pass) shouldSkipMetadata > returns false when noMeta is absent
(pass) shouldSkipMetadata > returns false for noMeta: false
(pass) shouldSkipMetadata > returns false for unrelated props [0.02ms]
(pass) makeNoMetaView > forwards the render-frame builder and preserves document attributes [0.04ms]
(pass) makeNoMetaView > returns a view that replaces title with the captured initial title [0.03ms]
(pass) makeNoMetaView > preserves all other Document fields from the original view [0.02ms]
(pass) makeNoMetaView > passes the model through to the original view [0.01ms]
(pass) makeNoMetaView > uses the captured title on every call, not the latest document.title [0.02ms]

 20 pass
 0 fail
 37 expect() calls
Ran 20 tests across 3 files. [102.00ms]
```

Command:

```sh
bun run --filter @opsydyn/astro-foldkit check
```

Exact output:

```text
@opsydyn/astro-foldkit check: test/integration/package-import-smoke.test.ts:65:26: warning linteffect(no-naked-object-state-update): Rule: avoid naked JS state patching/rebuild and raw JSON shortcuts in Effect transitions. Why: spread/Object.assign/fromEntries and inline JSON parse/stringify hide state intent and bypass explicit model contracts. Fix: use `effect/Record` combinators (`Record.set` / `Record.modify` / `Record.remove`) inside `Struct.evolve`, rebuild with schema constructors (`Schema.make` or field `.make`), and keep serialization at boundaries with schema encode/decode flows. Use `linting.md` guidance when available.
@opsydyn/astro-foldkit check: test/integration/package-import-smoke.test.ts:72:5: warning linteffect(no-naked-object-state-update): Rule: avoid naked JS state patching/rebuild and raw JSON shortcuts in Effect transitions. Why: spread/Object.assign/fromEntries and inline JSON parse/stringify hide state intent and bypass explicit model contracts. Fix: use `effect/Record` combinators (`Record.set` / `Record.modify` / `Record.remove`) inside `Struct.evolve`, rebuild with schema constructors (`Schema.make` or field `.make`), and keep serialization at boundaries with schema encode/decode flows. Use `linting.md` guidance when available.
@opsydyn/astro-foldkit check: test/integration/package-import-smoke.test.ts:112:28: warning linteffect(prevent-dynamic-imports): Rule: avoid dynamic imports. Why: runtime module loading obscures dependency boundaries. Fix: use static imports.
@opsydyn/astro-foldkit check: test/integration/package-import-smoke.test.ts:115:32: warning linteffect(prevent-dynamic-imports): Rule: avoid dynamic imports. Why: runtime module loading obscures dependency boundaries. Fix: use static imports.
@opsydyn/astro-foldkit check: test/integration/package-import-smoke.test.ts:118:33: warning linteffect(prevent-dynamic-imports): Rule: avoid dynamic imports. Why: runtime module loading obscures dependency boundaries. Fix: use static imports.
@opsydyn/astro-foldkit check: test/integration/package-import-smoke.test.ts:121:29: warning linteffect(prevent-dynamic-imports): Rule: avoid dynamic imports. Why: runtime module loading obscures dependency boundaries. Fix: use static imports.
@opsydyn/astro-foldkit check: test/integration/package-import-smoke.test.ts:125:29: warning linteffect(no-naked-object-state-update): Rule: avoid naked JS state patching/rebuild and raw JSON shortcuts in Effect transitions. Why: spread/Object.assign/fromEntries and inline JSON parse/stringify hide state intent and bypass explicit model contracts. Fix: use `effect/Record` combinators (`Record.set` / `Record.modify` / `Record.remove`) inside `Struct.evolve`, rebuild with schema constructors (`Schema.make` or field `.make`), and keep serialization at boundaries with schema encode/decode flows. Use `linting.md` guidance when available.
@opsydyn/astro-foldkit check: test/integration/package-import-smoke.test.ts:225:23: warning linteffect(no-naked-object-state-update): Rule: avoid naked JS state patching/rebuild and raw JSON shortcuts in Effect transitions. Why: spread/Object.assign/fromEntries and inline JSON parse/stringify hide state intent and bypass explicit model contracts. Fix: use `effect/Record` combinators (`Record.set` / `Record.modify` / `Record.remove`) inside `Struct.evolve`, rebuild with schema constructors (`Schema.make` or field `.make`), and keep serialization at boundaries with schema encode/decode flows. Use `linting.md` guidance when available.
@opsydyn/astro-foldkit check: test/integration/package-import-smoke.test.ts:240:23: warning linteffect(no-naked-object-state-update): Rule: avoid naked JS state patching/rebuild and raw JSON shortcuts in Effect transitions. Why: spread/Object.assign/fromEntries and inline JSON parse/stringify hide state intent and bypass explicit model contracts. Fix: use `effect/Record` combinators (`Record.set` / `Record.modify` / `Record.remove`) inside `Struct.evolve`, rebuild with schema constructors (`Schema.make` or field `.make`), and keep serialization at boundaries with schema encode/decode flows. Use `linting.md` guidance when available.
@opsydyn/astro-foldkit check: test/integration/package-import-smoke.test.ts:259:23: warning linteffect(no-naked-object-state-update): Rule: avoid naked JS state patching/rebuild and raw JSON shortcuts in Effect transitions. Why: spread/Object.assign/fromEntries and inline JSON parse/stringify hide state intent and bypass explicit model contracts. Fix: use `effect/Record` combinators (`Record.set` / `Record.modify` / `Record.remove`) inside `Struct.evolve`, rebuild with schema constructors (`Schema.make` or field `.make`), and keep serialization at boundaries with schema encode/decode flows. Use `linting.md` guidance when available.
@opsydyn/astro-foldkit check: test/integration/package-import-smoke.test.ts:270:23: warning linteffect(no-naked-object-state-update): Rule: avoid naked JS state patching/rebuild and raw JSON shortcuts in Effect transitions. Why: spread/Object.assign/fromEntries and inline JSON parse/stringify hide state intent and bypass explicit model contracts. Fix: use `effect/Record` combinators (`Record.set` / `Record.modify` / `Record.remove`) inside `Struct.evolve`, rebuild with schema constructors (`Schema.make` or field `.make`), and keep serialization at boundaries with schema encode/decode flows. Use `linting.md` guidance when available.
@opsydyn/astro-foldkit check: test/unit/client.test.ts:9:40: warning linteffect(prevent-dynamic-imports): Rule: avoid dynamic imports. Why: runtime module loading obscures dependency boundaries. Fix: use static imports.
@opsydyn/astro-foldkit check: test/unit/client.test.ts:97:9: warning linteffect(no-return-in-arrow): Rule: avoid block-bodied arrow callbacks with returns. Why: they hide local control flow. Fix: use expression-only callbacks and move the logic into a single pipeline (pipe/Match/Option/A.map).
@opsydyn/astro-foldkit check: test/unit/client.test.ts:101:9: warning linteffect(no-return-in-arrow): Rule: avoid block-bodied arrow callbacks with returns. Why: they hide local control flow. Fix: use expression-only callbacks and move the logic into a single pipeline (pipe/Match/Option/A.map).
@opsydyn/astro-foldkit check: test/unit/client.test.ts:109:9: warning linteffect(no-return-in-arrow): Rule: avoid block-bodied arrow callbacks with returns. Why: they hide local control flow. Fix: use expression-only callbacks and move the logic into a single pipeline (pipe/Match/Option/A.map).
@opsydyn/astro-foldkit check: test/unit/client.test.ts:97:9: warning linteffect(no-return-in-arrow): Rule: avoid block-bodied arrow callbacks with returns. Why: they hide local control flow. Fix: use expression-only callbacks and move the logic into a single pipeline (pipe/Match/Option/A.map).
@opsydyn/astro-foldkit check: test/unit/client.test.ts:101:9: warning linteffect(no-return-in-arrow): Rule: avoid block-bodied arrow callbacks with returns. Why: they hide local control flow. Fix: use expression-only callbacks and move the logic into a single pipeline (pipe/Match/Option/A.map).
@opsydyn/astro-foldkit check: test/unit/client.test.ts:109:9: warning linteffect(no-return-in-arrow): Rule: avoid block-bodied arrow callbacks with returns. Why: they hide local control flow. Fix: use expression-only callbacks and move the logic into a single pipeline (pipe/Match/Option/A.map).
@opsydyn/astro-foldkit check: test/unit/client-helpers.test.ts:38:7: warning linteffect(no-return-in-arrow): Rule: avoid block-bodied arrow callbacks with returns. Why: they hide local control flow. Fix: use expression-only callbacks and move the logic into a single pipeline (pipe/Match/Option/A.map).
@opsydyn/astro-foldkit check: test/unit/client-helpers.test.ts:83:7: warning linteffect(no-return-in-arrow): Rule: avoid block-bodied arrow callbacks with returns. Why: they hide local control flow. Fix: use expression-only callbacks and move the logic into a single pipeline (pipe/Match/Option/A.map).
@opsydyn/astro-foldkit check: test/unit/client-helpers.test.ts:38:7: warning linteffect(no-return-in-arrow): Rule: avoid block-bodied arrow callbacks with returns. Why: they hide local control flow. Fix: use expression-only callbacks and move the logic into a single pipeline (pipe/Match/Option/A.map).
@opsydyn/astro-foldkit check: test/unit/client-helpers.test.ts:83:7: warning linteffect(no-return-in-arrow): Rule: avoid block-bodied arrow callbacks with returns. Why: they hide local control flow. Fix: use expression-only callbacks and move the logic into a single pipeline (pipe/Match/Option/A.map).
@opsydyn/astro-foldkit check: src/server-render.ts:17:16: warning linteffect(no-run-effect-outside-boundary): Rule: avoid running Effects outside runtime boundaries. Why: direct Effect.run* calls scatter execution ownership. Fix: return Effects from domain logic and run them at the app, CLI, worker, route, or test boundary.
@opsydyn/astro-foldkit check: src/client.ts:221:25: warning linteffect(no-return-in-arrow): Rule: avoid block-bodied arrow callbacks with returns. Why: they hide local control flow. Fix: use expression-only callbacks and move the logic into a single pipeline (pipe/Match/Option/A.map).
@opsydyn/astro-foldkit check: Checking formatting...
@opsydyn/astro-foldkit check: 
@opsydyn/astro-foldkit check: All matched files use the correct format.
@opsydyn/astro-foldkit check: Finished in 144ms on 30 files using 12 threads.
@opsydyn/astro-foldkit check: Exited with code 0
```

Command:

```sh
bun run --filter @opsydyn/astro-foldkit typecheck
```

Exact output:

```text
@opsydyn/astro-foldkit typecheck: Exited with code 0
```

Command:

```sh
bun test packages/astro-foldkit/test/integration/package-import-smoke.test.ts
```

Exact output:

```text
bun test v1.3.11 (af24e281)

packages/astro-foldkit/test/integration/package-import-smoke.test.ts:
(pass) packed import smoke > dist exports resolve correctly (Bun import) [2500.18ms]
(pass) packed import smoke > imports correctly under Bun and Node via consumer script [543.21ms]

 2 pass
 0 fail
 34 expect() calls
Ran 2 tests across 1 file. [3.07s]
```
