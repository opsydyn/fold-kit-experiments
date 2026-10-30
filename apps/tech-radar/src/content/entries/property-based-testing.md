---
name: Property-based testing
category: techniques
ring: adopt
summary: Explore many generated inputs against an invariant, then shrink the counterexample.
source: https://fast-check.dev/
tags: [verification]
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

Instead of a handful of examples, state a property that should always hold, and let the library generate hundreds of inputs and shrink any failure to a minimal counterexample. It finds edge cases nobody thought to write.

It has been in Adopt since the first edition. fast-check works with Vitest and Effect Schema can generate arbitrary values from a schema. It is especially useful for checking generated code against the behaviour it is meant to keep.
