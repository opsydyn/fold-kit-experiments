---
name: Unreviewed generated changes
category: techniques
ring: caution
summary: Treat generated patches as proposals to inspect and test, not accepted work.
source: https://docs.github.com/en/copilot/concepts/agents/code-review
tags: [ai, verification]
history:
  - edition: '2025-10-14'
    ring: caution
  - edition: '2026-02-14'
    ring: caution
  - edition: '2026-06-14'
    ring: caution
---

Generated code arrives fast and looks right. Treat each change as a proposal: read it, run the tests, and check it against the behaviour it is meant to keep. Volume is not a reason to lower the bar.

It has been in Caution since the first edition. Property-based tests, type checks, golden tests and machine-checked proofs all help a reviewer, but someone still owns what lands.
