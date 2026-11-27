# ADR-021 — Effect UI owns the scene mount

- Status: Accepted for the coordinated Effect UI migration
- Supersedes [ADR-002](002-foldkit-adapter-seam.md)

## Context

Effect Three's browser host owns rendering, asset requests, WebXR, and DOM
observers. The former adapter handed scene updates to it through a DOM
property intercepted for the lifetime of a FoldKit mount. Effect UI provides
an element-scoped mount and delivers subsequent arguments to it.

## Decision

`@opsydyn/effect-three-foldkit` keeps its package identity for the coordinated
major release and uses Effect UI for its public view and mount. The scene
description is a typed mount argument. The optional `live` argument governs
scene input. A shared environment can be passed directly or obtained by the
mount from a scoped Effect. The scene element decodes custom events using
the browser host's existing schemas.

The renderer, asset store, scene reconciliation, and GPU resource ownership
stay in Effect Three. Samples consume the public adapter for their mounts,
overlays, and inspector.

## Options considered

The DOM property bridge would preserve imperative property assignment while
keeping two ways to deliver scene updates. A separately named adapter could
ship alongside the old package and would require an additional release and
consumer package change. The major upgrade uses the existing package identity
and a single argument stream.

## Effects on consumers

The current package requires Effect UI. Applications that use the fluent
element API pass the description to the mount instead of assigning a property.
Applications that use the `view` helper keep the scene and callback structure
and supply Effect UI's HTML builder. Earlier FoldKit consumers can continue
using the published 0.x adapter.
