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
- `packages/astro-foldkit/test/unit/server-public.test.ts`
  - Added TDD coverage for:
    - request/url/params/props -> Flags passthrough
    - build ID usage through the internal reader
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
