---
name: BEAM
category: platforms
ring: adopt
summary: The Erlang runtime ecosystem for concurrent, communicating processes.
source: https://www.erlang.org/
tags: [functional, concurrency]
history:
  - edition: '2025-10-14'
    ring: adopt
  - edition: '2026-02-14'
    ring: adopt
  - edition: '2026-06-14'
    ring: adopt
---

The BEAM runs millions of small, isolated processes that share nothing and talk by message. A process that fails is restarted by its supervisor, so failure is handled by structure rather than by defensive code everywhere.

It stays in Adopt for systems whose shape is many concurrent conversations: chat, presence, queues, device fleets. Erlang and Elixir have decades of production use behind them, and Gleam now brings static types to the same runtime.
