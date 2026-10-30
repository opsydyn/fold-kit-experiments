---
name: Claude Code
category: tools
ring: trial
summary: A coding agent that works with source, commands and project context.
source: https://code.claude.com/docs/en/overview
tags: [ai, agents]
history:
  - edition: '2026-02-14'
    ring: assess
  - edition: '2026-06-14'
    ring: trial
related:
  - to: codex
    type: alternative-to
    note: Both are terminal coding agents that work on a repository.
  - to: pi
    type: alternative-to
    note: "Pi's coding CLI covers similar agent workflows."
---

Claude Code works in a terminal on a real repository: it reads code, runs commands and tests, and proposes changes for a person to review. Its value grows with the project's own guidance, such as a `CLAUDE.md` and skills, and with fast local checks it can run.

It moved to Trial in the third edition. Use it on real work with the repository's checks as the gate, and keep a person in the loop for anything that leaves the machine: pushes, deploys and messages. See _Unbounded agent authority_ and _Unreviewed generated changes_.
