# Endpoint chooser validation indexing

- **result:** complete
- **claim:** internal per-resolution indexes reduce large synthetic chooser
  resolution cost while preserving fresh policy evaluation and commit validation.
- **evidence:** 230 passing Flow tests, workspace check/typecheck/tests, six benchmark
  passes, unchanged policy counts/checksums, raw samples and measured-source hashes.
- **remaining uncertainty:** browser gains vary; full-view creation response is
  broadly unchanged, and no cross-device or physical-paint claim is made.
- **next:** qualify opt-in node retention during pending creation, preserving
  source/port feedback and the existing eligibility restrictions.

## Implementation and scope

The pure package builds a first-match node/port lookup, a collision-safe set of
four-component connection identities, and the replacement-free policy graph once
per resolver invocation. Creation builds an occupied-ID set and allocates one
proposal identity for the entire candidate pass. These facts remain local to the
call; neither permissions nor decisions are cached across calls.

Single-event validation and chooser validation share reason precedence: port
compatibility, changed-port policy, duplicate rejection, then global policy.
Creation checks both ports; reconnection checks only the changed port. Port
policies receive the original graph; global policies receive the graph excluding
the replaced edge. Single-event validation and previews retain direct lookups and
short ID scans. Commit-time validation, events, history and metadata stay intact.

Simplicity check: persistent graph indexes and cross-view permission caches were
considered and omitted. Standard-library maps/sets within the existing private
validation module supply the needed speedup opportunity without new invalidation
state, dependencies or public configuration. No API, schema, package boundary or
architecture invariant changes; no new ADR is required.

## Behavioral verification

Before implementation, characterization tests passed on the prior scan path for
callback order, duplicate short-circuiting, ID gaps, replacement exclusion, graph
inputs and delimiter-containing endpoint identities. An additional stale-graph
case checks first-match node/port semantics. Existing chooser tests exercise
commit-time permission changes, visibility, no-op history, metadata and Undo/Redo.

## Measurement provenance

The baseline is the [prior benchmark](endpoint-chooser-benchmark.md), which keeps
its original raw evidence. The follow-up uses those committed harnesses without
measurement changes, the same fixtures, warmups, samples and two case orders.
Browser production builds contain the indexed package. Timings remain local
serial headless response measurements, not INP, physical paint or device proof.

The raw follow-up artifacts record the parent Git HEAD because production edits
were measured before their commit. A separate source manifest identifies the
measured production files by SHA-256. Working-tree changes are part of this slice;
the recorded parent hash alone does not identify the optimized implementation.

## Results

All values below are p95 milliseconds; ranges span forward/reverse case orders,
not confidence intervals. Baseline and follow-up are separate local sessions on
the same host and runtime; operating-system activity was not controlled. No
machine-dependent CI timing budget was added.

| Nodes / targets | Prior creation | Indexed creation | Prior reconnection | Indexed reconnection |
| --------------- | -------------: | ---------------: | -----------------: | -------------------: |
| 32 / 64         |    0.083–0.172 |      0.034–0.061 |        0.042–0.082 |          0.032–0.037 |
| 320 / 640       |      5.03–5.53 |      0.282–0.316 |          3.24–3.29 |          0.275–0.280 |
| 1,000 / 2,000   |    39.95–49.57 |      1.236–1.381 |        27.50–27.66 |          1.194–1.267 |

For each case order, the old and new checksums, fixture counts, target-candidate
counts and untimed policy callback counts are identical. At 1,000 nodes, creation
still evaluates 6,001 port-policy callbacks and 1,899 global-policy callbacks.
Expensive consumer policies can therefore remain a bottleneck. Projection and
field construction are unchanged and recorded in the raw results, but no change
to those operations is claimed.

Package samples: [forward](endpoint-chooser-indexed-core-forward.json) ·
[reverse](endpoint-chooser-indexed-core-reverse.json).

| Workbench case                          | Prior listener → options DOM | Indexed listener → options DOM | Prior input → next rAF | Indexed input → next rAF |
| --------------------------------------- | ---------------------------: | -----------------------------: | ---------------------: | -----------------------: |
| Release creation, broad                 |                    18.3–18.3 |                      19.4–19.4 |              32.8–32.8 |                32.8–32.8 |
| Large creation, broad                   |                    45.1–46.1 |                      44.9–45.9 |              53.3–53.6 |                52.3–53.4 |
| Large creation, selective               |                    44.5–44.7 |                      44.9–46.9 |              51.3–51.5 |                51.0–53.7 |
| Release reconnection, broad             |                    18.4–18.6 |                      19.0–20.3 |              32.7–33.4 |                32.9–34.4 |
| Large reconnection, broad               |                    57.0–64.2 |                      50.2–60.6 |              60.7–67.8 |                54.6–64.5 |
| Large reconnection, selective           |                    58.5–58.7 |                      45.0–45.1 |              65.3–65.8 |                51.4–51.6 |
| Large reconnection, broad, retained     |                    31.1–31.6 |                      32.1–32.7 |              35.4–36.3 |                36.1–37.0 |
| Large reconnection, selective, retained |                    28.8–36.8 |                      28.1–28.9 |              35.7–44.1 |                34.1–35.1 |

The package improvement is clear in the synthetic resolver measurements. The
full-workbench effect varies: creation rows remain broadly unchanged, while
selective reconnection improves in these runs and broad reconnection ranges
overlap. Broad retained reconnection is slightly slower, while the selective
retained range is tighter/lower; those results also do not establish a universal
retention-path improvement. No across-the-board browser speedup is claimed. The
release example has small listener-time increases without a corresponding broad creation frame-time
change; these runs do not establish their cause. Candidate resolution and whole
view work remain distinct costs.

Browser samples: [forward](endpoint-chooser-indexed-browser-forward.json) ·
[reverse](endpoint-chooser-indexed-browser-reverse.json) ·
[retained forward](endpoint-chooser-indexed-browser-retained-forward.json) ·
[retained reverse](endpoint-chooser-indexed-browser-retained-reverse.json).

## Next bounded slice

Extend opt-in node retention to eligible pending-creation states, with the pending
source included in the retention key and tests for source/port feedback,
cancellation, changing permissions and Undo. Retain current custom-renderer and
policy eligibility restrictions unless separately qualified. The existing
`!state.connection` eligibility guard excludes this state today. Re-run the same
creation browser cases and retain a fallback when eligibility is lost. This is a
recommendation, not an implementation or a measured speedup claim.

## Qualification

- Baseline workspace typecheck and lint/format check: exit 0.
- Focused chooser/validation tests: 17 passed, exit 0.
- Full `bun run test`: exit 0, including 230 Flow tests and the packed consumer check.
- Benchmark TypeScript check (`tsc --noEmit -p packages/foldkit-flow/tsconfig.bench.json`): exit 0.
- Production sample build with benchmark source maps: exit 0.
- All six benchmark passes (two package, two default browser, two retained browser): exit 0.
- Post-run comparisons: unchanged fixture/candidate/policy counts, package checksums,
  browser option/sample counts, retained-layer states and measured-source hashes.
- Final workspace `bun typecheck` after the last source edit: exit 0.
- Final workspace `bun run check`: exit 0, including lint, formatting and catalog checks.

No new CPU profile, hosted/CI/registry qualification or publication was performed.
The raw timing ranges are observations from this host, not performance guarantees.

Self-review: the shared validation path retains precedence and port-policy graph
inputs. Lookup construction preserves the previous first-match behavior for
stale duplicate IDs. Connection identity encoding covers all four components to
avoid delimiter collisions. History/event code and public barrels are untouched.
The tests do not qualify impure host policies that mutate readonly graphs, browser
burst input, screen-reader behavior or physical paint; no such claim is made.

## Reproduce

Use the [original harness commands and method](endpoint-chooser-benchmark.md#reproduce)
with `indexed` output filenames to retain the baseline. Both harness files are
unchanged; measure passes sequentially after tests/builds finish. The production
sample is built with `FLOW_BENCHMARK_SOURCEMAPS=1`. The indexed runs use the same
release and large-workflow fixtures, default diagnostics, query alternation and
retained/non-retained configurations as the prior matrix.

[Measured source manifest](endpoint-chooser-indexed-sources.json) records hashes
of all three changed production files and both unchanged harness files.

Recommendation: **needs follow-up** for eligible pending-creation retention.
