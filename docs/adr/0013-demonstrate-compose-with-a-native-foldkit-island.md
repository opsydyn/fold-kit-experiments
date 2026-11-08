# ADR 0013: Demonstrate Compose with a native Foldkit island

## Status

Accepted for the approved interactive Compose promo example, 2026-11-08.
Extends ADR 0012's static shell with one explicit interactive boundary.

## Decision

Use the existing Astro Foldkit integration and `lazyApp` / `client:load` for a
small native island on the promo home page. Use `noMeta` so Astro retains the
page title and metadata. Keep the static C4 preview and downloads intact.

The island Model holds the complete package-owned EditorState. Only the public
`createEditor` / `updateEditor` functions construct or change that state. The
Foldkit schema treats that opaque field as Unknown with a precise TypeScript
override, matching the existing workbench pattern; it is not a decoder for user
documents. No editor state arrives through props or storage. Typed package events
are wrapped as past-tense messages and cast only at the update bridge.

Use public `flowView`, native connection-creation primitives and reducer events
for selection, connecting ports, Fit, Undo and Redo. No app-owned graph editing
algorithm, history stack or copied gesture protocol. Fit once after the initial
surface measurement; later camera changes stay under user control. Inherit the
family CSS variables so changing page theme does not reset the island Model.
Keep wheel navigation off to preserve normal page scrolling over the example.

## Alternatives and consequences

A second workbench implementation or browser DOM controller would bypass the
package contracts and Model ownership. Embedding the full workbench would add
unnecessary panels. A native island is the bounded integration already used by
Viz and Three. The example now requires JavaScript for editing; an explicit
noscript message retains access to the workbench and static model examples.

Boundary review: **safe**. Existing Astro integration, Foldkit and Effect catalog
dependencies are added to this private app; core/adapter public contracts and
saved formats do not change. The package owns input mounts and cleanup. Verify
selection without history, one connection per commit, duplicate rejection,
cancel, Undo/Redo, keyboard and pointer paths, live theme retention, narrow fit,
Astro metadata ownership, highlighted source and nested deployment paths.
Hosting, registry publication and collaborative persistence remain separate.
