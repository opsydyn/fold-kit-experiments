---
name: Bun
category: tools
ring: adopt
summary: A JavaScript runtime with package, test and build tooling in one toolkit.
source: https://bun.sh/
tags: [typescript, tooling]
history:
  - edition: '2025-10-14'
    ring: trial
  - edition: '2026-02-14'
    ring: trial
  - edition: '2026-06-14'
    ring: adopt
---

Bun runs TypeScript directly and puts the package manager, test runner and bundler in one fast binary. This repository uses it for installs, workspaces, catalogs and most test suites, and the speed changes how often people run things.

It moved to Adopt in the third edition, once workspaces, isolated installs and Node compatibility had held up across a large monorepo. Where a tool still assumes Node, run that one tool on Node; there is no need to switch the whole project back.
