# Trustworthy signal quality — M2 qualification

Date: 2026-10-05. Implementation baseline: `a9a3029`. Existing managed promo worktree, native execution. This records engineering evidence for an illustrative static source, not publication, representative-user comprehension or critical-system suitability.

## Delivered contracts

Pure `contiguousRuns` and `intervalBandGeometry` exports preserve caller records and supplied bounds; all X coordinates are finite and strictly increasing, excluded records break runs, and the caller owns quality/time adjacency. Bands use the existing linear area primitive with separately retained endpoint geometry, including singleton/equal intervals. Root and exact subpath consumers are exercised under Bun, Node and strict TypeScript without optional framework peers.

The Signal desk owns metric-specific Observed/Estimated/Missing/Invalid readings, caller-labelled intervals/support, source revision/asOf/updatedAt/cutoff and reference styles. Schema and semantic validation reject malformed metadata, unusable times, duplicate identities/times, invalid values/bounds/support and invalid references. Freshness is explicit source state; controls select supplied snapshots without reading the wall clock. Dataset replacement reinitialises selection/inspection/gestures.

The 115-record fixture preserves the original 120-record regression fixture separately. Missing latency records10–14, invalid errors22, estimated30–39, support0 at35, observed0 at40 and omitted70–74 are distinct. Full-data Y domains include centres, intervals and references. Full runs retain viewport neighbours and are clipped without fabricating records or bridging quality/time gaps. Missing/Invalid/gap lanes lie outside measured Y space. Solid/dashed/hollow/text cues accompany colour. Complete reference meanings appear in keyed adjacent lists. Exact inspector/table/current-state source and ten actual application source disclosures preserve supplied quality/bounds/support and source metadata.

## Automated and native evidence

- Root `bun run check`: zero lint errors/warnings and format check passed.
- Root `bun typecheck`: zero errors/warnings.
- Root `bun run test`: 488 pass, one environment-gated skip, zero failures. Breakdown: Astro integration74, Viz203, promo93, web118.
- Pages-base `PROMO_BASE_PATH=/fold-kit-experiments/ bun run --filter @opsydyn/promo build`: ten routes. Explicit `PROMO_BASE_PATH=/fold-kit-experiments/ bun test apps/promo/test/pages-build.test.ts`: one pass,290 assertions.
- Render tests exercise quality reasons, interval endpoints/support0/null, source freshness,115 raw rows, clipped cursor/marks, all-invalid/zero/singleton and shared-location/long reference labels. A RED regression caught the undefined theme variable in hollow estimated marks; the actual `--surface` variable now passes.

Native M2 checks are pending: the first reload timed out during the server restart; subsequent CUA discovery reported the Mac locked and no browser surfaces. No M2 light/dark,390/1280, mouse gesture or screenshot acceptance is claimed. The server was restarted successfully at `http://127.0.0.1:4321` (pid85147). Previous M1 browser evidence is not substituted for changed M2 behaviour.

## Limits

This closes only partial P1, interval-band P2 and unit/domain/reference portions of P3/F5. Error bars, pinned comparison baselines, generic crossing-aware segmentation and the remaining visx families remain outside M2. Representative-user comprehension, hardware touch acceptance, live transports, alarms, publication and broad critical-system suitability are unperformed.

## Execution rulings

- Extend the existing pure-render lint scope to named quality/schema/fixture/view helpers: these synchronously validate and render data, rather than run Effect state handlers. Cost if wrong: broader lint exceptions only in those named files.
- Use tolerance for mathematical 180ms plus10% display headroom: IEEE arithmetic produces198.00000000000003. Cost: sub-ULP display-domain variation; raw readings are never rounded.
