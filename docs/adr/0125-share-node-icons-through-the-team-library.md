# ADR 0125 — Share node icons through the team library

Accepted for local implementation on 2026-11-22. Revisit SVG uploads after the
first team pilot demonstrates a need for vector source files.

## Context

C4 Board lets a user upload an icon from the node picker and reuse it from a
local library. Zloz Teams needs editor-to-editor reuse, access control and an
offline export. Icon choices describe appearance independently of C4 type.

## Decision

The team library indexes named immutable PNG and WebP assets in D1. A private
Alchemy-managed R2 bucket stores bytes. The Teams Worker authenticates every
request and checks current membership. Owners and editors upload. Owners
archive entries, leaving referenced assets readable to current team members.
The first release caps images at 64 KiB and 512 × 512 and keeps at most 64
entries per team, including archived entries.

The diagram aggregate owns an optional icon reference and its change clock.
The same shared command, replay and Undo path applies the choice. Legacy
snapshots without icon fields still load. Deliver the Teams client and server
with matching operation codecs. Export SVG with embedded raster images when
available and report missing assets through the existing review controls.
LikeC4 export reports icon omission. Whole-library asset bundles are deferred.

## Why this boundary

Embedding images in graph snapshots would multiply bytes across feed updates,
checkpoints and exports. Keeping assignments in a second database would split
Undo and shared delivery from the graph. Stable references keep the library
reusable while preserving the graph as the authority for node appearance.

## Verification

Use two local authenticated accounts to upload, apply, reuse and reconnect.
Reject malformed files, viewer writes and cross-team reads or references.
Verify archiving preserves existing rendered nodes and the SVG opens offline.
Use the reviewed Alchemy staging path for the initial migration and binding.
