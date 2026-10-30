---
name: SQLite
category: platforms
ring: adopt
summary: An embedded SQL database engine that travels with the application.
source: https://www.sqlite.org/
tags: [data, local]
history:
  - edition: '2025-10-14'
    ring: adopt
  - edition: '2026-02-14'
    ring: adopt
  - edition: '2026-06-14'
    ring: adopt
related:
  - to: duckdb
    type: complements
    note: 'SQLite suits transactional rows and DuckDB analytical scans; both embed in a process.'
---

SQLite is a full SQL database in a single file, inside your process. It is reliable, fast for most workloads and available almost everywhere, from phones and browsers to edge platforms such as D1.

It has been in Adopt since the first edition. It is the right default for application data until you need many writers on many machines. Pair it with DuckDB for analytical queries.
