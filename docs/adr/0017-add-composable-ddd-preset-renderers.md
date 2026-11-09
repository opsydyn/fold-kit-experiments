# ADR 0017: Add composable DDD preset renderers

## Status

Accepted for the approved DDD renderer slice, 2026-11-08. Extends ADR 0005.

## Decision

Add `zlozDddNode`, `zlozDddGroup`, `ZlozDddContentContext`,
`ZlozDddContentRenderer` and `ZlozDddNodeOptions` to the optional `/foldkit`
entry. The eight existing DDD roles remain the complete semantic vocabulary in
this slice. No serialized fields, graph reducer operations or dependencies change.

Use core geometry and existing node/group frames, drag handles, sockets and live
controls. Aggregate/context boundaries remain portless. Normal bounded-context
nodes remain connectable. Return undefined for other families so hosts can
compose renderer fallbacks. Do not transform a DDD node into a C4 node for reuse.

Expose inert badge, type, name, subdomain, description and body slots with the
existing undefined/default, null/omit convention. Controls are separately
composable and remain outside the drag button and body cache. Cache static
artwork by node identity and explicit view inputs, never authorization or source
feedback. Theme tokens own paint; role text conveys meaning without a prescribed
color notation. Custom attributes cannot replace Model-owned dimensions.

Astro composes an Order aggregate example and a catalogue-derived legend using
public package exports. The custom consistency-owner badge is view configuration,
not persisted metadata or proof of executable consistency rules.

## Alternatives and consequences

App-only cards would make consumers reimplement functionality. C4 masquerading
would lose semantic honesty and complicate caching. A new notation package adds
no useful dependency boundary here. A generalized preset factory would refactor
the existing C4 renderer alongside this slice; keep the established view pattern
and defer that abstraction until shared requirements justify its public/private
contract. Some presentation plumbing is consequently duplicated between presets.

Long text needs appropriate authored dimensions or a custom body. Boundary
headers show role, name and optional subdomain; descriptions remain available in
the descriptor and custom slots but are omitted from compact default headers.
The views express modelling intent, not DDD design validation or typed relations.

## Acceptance and recovery

Qualify all eight roles, node/group fallback, canonical curved outlines, accessible
selection names, portless boundaries, theme/minimal mode, replaceable content and
live protected ports outside cached artwork. Exercise installed npm tarballs and
TypeScript consumers, document round trips, Undo, and a real browser workbench
in light/dark. Comprehensive assistive-technology qualification remains separate.
Existing C4 tests guard accidental changes to its API. Reverting this additive
view slice requires no saved-document migration.
