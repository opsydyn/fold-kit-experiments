---
name: Algebraic data types
category: techniques
ring: adopt
summary: Build domain values from alternatives and products rather than unrelated flags.
source: https://www.haskell.org/onlinereport/haskell2010/haskellch4.html
tags: [functional, types]
history:
  - edition: '2025-10-14'
    ring: adopt
  - edition: '2026-02-14'
    ring: adopt
  - edition: '2026-06-14'
    ring: adopt
---

A value that can be in one of several states should say so in its type. Sums name the alternatives, products group what always travels together, and the compiler checks that every case is handled. A pair of booleans that can't both be true, or an optional field that only matters in one state, is the kind of bug this removes.

It has been in Adopt since the first edition because it costs nothing to start: TypeScript's discriminated unions, Effect's `Data.TaggedEnum` and Schema's tagged structs give the same shape. Model the states first, then write the functions over them.
