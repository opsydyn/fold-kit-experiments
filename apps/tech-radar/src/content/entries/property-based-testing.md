---
name: Property-based testing
category: techniques
ring: adopt
summary: Explore many generated inputs against an invariant, then shrink the counterexample.
source: https://fast-check.dev/
history:
  - edition: '2025-10-14'
    ring: adopt
  - edition: '2026-02-14'
    ring: adopt
  - edition: '2026-06-14'
    ring: adopt
related:
  - to: unreviewed-generated-changes
    type: guards-against
    note: Generated cases probe a patch far beyond the examples its author thought of.
---
