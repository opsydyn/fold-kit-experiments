---
name: Elm
category: languages-frameworks
ring: trial
summary: A functional language for browser interfaces with explicit application state.
source: https://guide.elm-lang.org/
tags: [functional, web, types]
history:
  - edition: '2025-10-14'
    ring: adopt
  - edition: '2026-02-14'
    ring: adopt
  - edition: '2026-06-14'
    ring: trial
---

Elm showed that a browser interface could be a pure function of its state, with every change arriving as a message and no runtime exceptions. Its architecture of Model, update and view has been copied far beyond Elm itself.

It moved from Adopt to Trial in the third edition. The ideas remain essential, but our new interfaces get them through FoldKit on TypeScript and Effect, which fits the rest of our stack. Elm is still a fine choice for a self-contained app.
