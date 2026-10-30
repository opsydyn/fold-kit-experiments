---
name: Unbounded agent authority
category: techniques
ring: caution
summary: Do not confuse useful automation with permission to act across every boundary.
source: https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices
tags: [ai, agents]
history:
  - edition: '2025-10-14'
    ring: caution
  - edition: '2026-02-14'
    ring: caution
  - edition: '2026-06-14'
    ring: caution
---

An agent that can read your mail, run shell commands and push to production is very capable, and one injected instruction away from doing harm. Convenience is not permission: tools should be scoped to the task and to the person's intent.

It has been in Caution since the first edition. Grant the least authority that works, keep a person's approval for actions that are outward-facing or hard to reverse, and treat content an agent reads as data, not instructions.
