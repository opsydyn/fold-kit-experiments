---
name: Clojure
category: languages-frameworks
ring: trial
summary: A Lisp with immutable collections and a functional programming focus.
source: https://clojure.org/
tags: [functional]
history:
  - edition: '2025-10-14'
    ring: adopt
  - edition: '2026-02-14'
    ring: trial
  - edition: '2026-06-14'
    ring: trial
---

Clojure brings immutable collections and a data-first style to the JVM and, through ClojureScript, to the browser. A REPL connected to a running program makes exploration fast, and its data structures still shape how other languages think about state.

It moved from Adopt to Trial in the second edition. Nothing went wrong with it: our new work moved to statically typed TypeScript with Effect, and Clojure is now a good choice where a team already knows it, not our default.
