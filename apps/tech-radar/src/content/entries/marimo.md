---
name: marimo
category: tools
ring: assess
summary: A reactive Python notebook where data dependencies connect cells.
source: https://marimo.io/
tags: [data]
history:
  - edition: '2026-06-14'
    ring: assess
related:
  - to: duckdb
    type: complements
    note: marimo notebooks run their SQL cells through DuckDB.
---

marimo is a Python notebook where cells form a dependency graph: change one and the cells that depend on it re-run. It stores notebooks as plain Python files, so they can be reviewed, versioned and run as scripts or apps.

It joined in Assess in the third edition. It removes the hidden-state problems of traditional notebooks; worth assessing wherever notebooks are part of a team's analysis or reporting.
