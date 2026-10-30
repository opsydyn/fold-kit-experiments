---
name: Gleam
category: languages-frameworks
ring: trial
summary: A typed functional language with Erlang and JavaScript targets.
source: https://gleam.run/
tags: [functional, types, concurrency]
history:
  - edition: '2025-10-14'
    ring: assess
  - edition: '2026-02-14'
    ring: trial
  - edition: '2026-06-14'
    ring: trial
related:
  - to: beam
    type: builds-on
    note: Gleam compiles to Erlang and runs on the BEAM.
---

Gleam is a small, friendly, statically typed functional language that compiles to Erlang or JavaScript. On the BEAM it gets supervisors and lightweight processes; in the browser it can share types with the server.

It moved to Trial in the second edition. Its tooling, error messages and growing package ecosystem make it a good first typed language on the BEAM. Check that the libraries you need exist before choosing it for a large system.
