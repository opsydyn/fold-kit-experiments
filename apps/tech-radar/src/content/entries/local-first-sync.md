---
name: Local-first sync
category: platforms
ring: assess
summary: Keep local data usable while coordinating changes across replicas.
source: https://www.inkandswitch.com/essay/local-first/
tags: [data, local]
history:
  - edition: '2025-10-14'
    ring: assess
  - edition: '2026-02-14'
    ring: assess
  - edition: '2026-06-14'
    ring: assess
related:
  - to: sqlite
    type: complements
    note: "Local-first apps often keep each replica's data in SQLite."
---

Local-first software keeps your data on your device, works offline, and syncs changes between replicas without a single server deciding everything. CRDTs and similar techniques let concurrent edits merge.

It stays in Assess. The user experience is excellent when it works, but conflicts, schema changes and access control are still hard problems. Try it in an app where offline use really matters, and plan for migrations from the start.
