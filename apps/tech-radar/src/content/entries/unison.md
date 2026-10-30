---
name: Unison
category: languages-frameworks
ring: assess
summary: A functional language whose code definitions have content-addressed identities.
source: https://www.unison-lang.org/
tags: [functional, distributed]
history:
  - edition: '2025-10-14'
    ring: assess
  - edition: '2026-02-14'
    ring: assess
  - edition: '2026-06-14'
    ring: assess
---

In Unison every definition is identified by a hash of its content, not by its name or file. Renaming is free, builds are cached forever, and code can be sent between machines exactly.

It stays in Assess. The ideas are important even if you never ship Unison, but its codebase-in-a-database workflow and smaller ecosystem need a team ready to work differently.
