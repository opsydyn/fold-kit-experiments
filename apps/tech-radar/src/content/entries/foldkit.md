---
name: FoldKit
category: languages-frameworks
ring: adopt
summary: Model, Message and update-driven interfaces built on TypeScript and Effect.
source: https://foldkit.dev/
tags: [typescript, functional, web]
history:
  - edition: '2025-10-14'
    ring: assess
  - edition: '2026-02-14'
    ring: trial
  - edition: '2026-06-14'
    ring: trial
related:
  - to: elm
    type: inspired-by
    note: "FoldKit's Model, Message and update loop follow the Elm Architecture."
  - to: effect
    type: builds-on
    note: FoldKit runs its commands, subscriptions and resources on Effect.
---

FoldKit brings the Elm Architecture to TypeScript on Effect: a Model, Messages, a pure update, and Commands and Subscriptions for everything that touches the world. Views stay pure, side effects are values you can test, and Effect handles resources and errors.

It moved from Trial to Adopt in the fourth edition. Every interactive app in this repository, this radar included, is built on it, and the Astro integration hydrates FoldKit apps on otherwise static pages. Pin it with its Effect version: FoldKit releases follow Effect minor releases.
