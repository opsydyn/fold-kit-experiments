---
name: DuckDB
category: platforms
ring: trial
summary: An analytical SQL database that can run inside a process.
source: https://duckdb.org/
tags: [data]
history:
  - edition: '2025-10-14'
    ring: assess
  - edition: '2026-02-14'
    ring: trial
  - edition: '2026-06-14'
    ring: trial
---

DuckDB is an analytical database that runs inside your process, with no server. It reads Parquet, CSV and JSON in place and runs fast columnar queries over them, from Python, the command line or the browser through WebAssembly.

It moved to Trial in the second edition. Reach for it for exploration, reports and pipelines over files that would otherwise need a warehouse. For many small transactional writes, SQLite is the better fit.
