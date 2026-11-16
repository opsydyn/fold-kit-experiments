# Native v3 completion evidence

Local automated evidence for the approved provisional browser matrix. `qualification.json`
contains host/software, exact source fingerprint, result cases, 24 flat/nested
100/1,000-node observations and 18 axe scans. `browser-versions.json` records the
launched Chromium/Firefox/WebKit versions. The run completed with **56 passed,
4 skipped, 0 failed**. The four skips are synthetic multitouch outside Chromium.
All 24 page-owner scenarios retained the captured node through hydration.

The recorded HEAD is the pre-commit base when this source tree was qualified;
`sourceSha256` identifies the complete measured source. Local runs are not hosted
CI, registry, physical-device or screen-reader acceptance. The source fingerprint
covers core, Astro integration, demo sources and the browser harness. Formatting
and delivery-only records do not change measured behavior.

| Total nodes | Samples across six projects and flat/nested fixtures | Median keyboard-to-two-frame | Maximum |
| ----------- | ---------------------------------------------------- | ---------------------------- | ------- |
| 100         | 60                                                   | 66.5 ms                      | 89 ms   |
| 1000        | 60                                                   | 351.5 ms                     | 457 ms  |

These timings include Playwright scheduling and two animation frames, with every
node mounted. Builds from this task had finished before the run. No numeric
latency budget was agreed; these are observations, not a frame-rate or parity
claim. The 1,000-node workload remains a profiling target before promising smooth
continuous interaction at that size.

Axe reported zero violations in the tested light/dark/protected-minimal states.
Its incomplete color-contrast and label-content/name checks still require human
review, as recorded per project/state in the JSON. No rule was disabled to obtain
the result. The earlier mobile header target-size failure is retained separately
in `mobile-targets-before.json`; the header targets and wrapping were corrected.

Selected PNGs show the desktop/mobile protected minimal canvas, recovery and
explicit C4/DDD mapping review. Raw reports, screenshots and traces remain local
in the ignored `browser-artifacts/` and `playwright-results.json`; CI uploads them
as job artifacts. No real user data or credentials were used.

See the [candidate and human acceptance checklist](../../../../docs/releases/zloz-0.6.0-candidate.md).
