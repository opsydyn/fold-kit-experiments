---
name: WebAssembly
category: platforms
ring: assess
summary: A portable binary instruction format for sandboxed execution.
source: https://webassembly.org/
tags: [web]
history:
  - edition: '2025-10-14'
    ring: assess
  - edition: '2026-02-14'
    ring: assess
  - edition: '2026-06-14'
    ring: assess
---

WebAssembly is a compact, sandboxed instruction format that runs at near-native speed in browsers and, through WASI, outside them. It lets code in Rust, C, Go and other languages run in the browser or at the edge.

It stays in Assess for us. It is mature in browsers, and DuckDB and SQLite already run on it here; the component model and WASI are still settling. Reach for it when a specific library or performance need calls for it.
