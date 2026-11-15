# Private workspace adapter qualification

- **result:** complete
- **claim:** the approved private workspace extraction separates trusted Domain
  inspection from SDK-free portable decoding/projection. Source provenance and
  losses remain visible; compatibility gates are preserved. No release or runtime
  provider adoption is claimed.
- **evidence:** host-executed root lint/format/catalog checks, typecheck and workspace
  tests; package build/publint/pack; eight adapter tests including disposable packed
  consumers. Node/Bun and strict NodeNext/Bundler consumers exercise both entries;
  two expected negative upstream compiler probes remain failing. Architecture,
  boundary, implementation and test-quality reviews are **self-review**.
- **remaining uncertainty:** version/state claims are unauthenticated; the portable
  decoder accepts data objects, not raw text or hostile executable objects. Actual
  native core source/artifact is qualified, not published core 0.3.0. Other SDK
  versions, omitted-read/stateless strict typing, full Domain semantics, runtime,
  provider, browser/manual/AT and user-value evidence remain open.
- **next:** read-only workbench review through the portable entry, with bounded host
  text decoding, source provenance and loss findings. Recommendation: **needs review**.

## Checks and observed boundaries

```sh
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/foldkit-zloz-alchemy typecheck
bun run --filter @opsydyn/foldkit-zloz-alchemy pack:check
```

All commands above exited 0. Repository checks retain advisory warnings; this is
not a zero-warning claim. The eight new tests assert literal descriptor round trips,
mutation isolation, canonical ordering, malformed fields/identities/endpoints/limits,
accessor rejection without invocation, stateless non-coercion, SDK poison counters
at zero, aliases, chained feeds and meaningful edition deltas. The fixture preserves
23 facts (8 declarations + 15 relations), one native read-model and one native feed;
one stream role and seven relationship meanings remain explicit losses.

The packed-consumer test first installs only the local core and adapter archives
outside the repository using npm with lifecycle scripts disabled. Both runtime and
reachable declaration graphs are checked: no SDK/Alchemy/Effect/Foldkit/React is
installed on the portable path. It then explicitly installs Domain/Alchemy
2.0.0-beta.85 and Effect 4.1.0, and tests `/domain` independently under Node/Bun and
both strict TypeScript profiles. Foldkit/React remain absent. TypeScript is 6.0.3.

The omitted-read and stateless-view negative fixtures compile separately, expecting
exit 2 and the respective `definition.read`/`property 'state'` strict-optional
errors. Positive fixtures use deliberately authored read definitions and state
schemas; changing production read semantics is not a supported compiler workaround.
Data-only stateless claims remain representable with visible loss findings.

During test development, the export scanner initially resolved declaration import
suffixes as runtime files; this test bug was corrected. The negative compiler
assertion initially expected a quoted field instead of TypeScript's full
`definition.read` path and nested `property 'state'` wording; assertions now check
the actual diagnostics. These were
qualification-test failures, not suppressed upstream failures.

## Scope and compatibility review

Core and other packages do not depend on this adapter. Only the `/domain` entry
imports the optional SDK/Effect. Root catalog adds the exact Domain pin. Generated
lockfile changes also reconcile pre-existing workspace metadata (Viz 0.15 to 0.16,
Zloz family 0.1 to 0.3) with already-existing manifests; no external versions were
upgraded and no package manifest versions were bumped. Historical experiment
receipts remain intact. Release selection and publishing workflows are unchanged;
`private: true` prevents accidental npm publication.

The decoder owns strict object validation, not JSON-text framing/duplicate keys,
authentication, editor permission or JavaScript isolation. Projection recomputes
graph/findings and never accepts imported results. Host-supplied version claims are
checked before SDK inspection; they do not authenticate the installed package.
Only native core contracts introduced at `aaa1186` and the actual local packed
artifact were qualified, despite unchanged core version metadata. Streams,
schemas, rejection semantics, handlers, routing, sagas and APIs remain outside the
mapping. No arbitrary TypeScript loading, Apply, deployment or provider calls.
