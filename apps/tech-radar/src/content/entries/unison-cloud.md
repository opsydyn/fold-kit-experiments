---
name: Unison Cloud
category: platforms
ring: assess
summary: A deployment platform built around Unison functions and distributed computation.
source: https://www.unison.cloud/
tags: [functional, distributed]
history:
  - edition: '2026-02-14'
    ring: assess
  - edition: '2026-06-14'
    ring: assess
related:
  - to: unison
    type: builds-on
    note: Unison Cloud deploys Unison code by its content-addressed definitions.
---

Unison Cloud runs Unison programs across machines. Because Unison identifies code by its content, the platform can ship a function and its dependencies to where they need to run, without containers or build pipelines.

It stays in Assess. The model is a genuinely different way to build distributed systems, and worth studying; adopting it means adopting Unison and a young platform with it.
