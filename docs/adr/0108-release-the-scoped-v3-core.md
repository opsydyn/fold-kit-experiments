# ADR 0108: Release the scoped v3 core with explicit adapter limits

## Status and authority

Accepted, 2026-11-15. The user's latest scope selection is **Finish v3 core and
release with explicit remaining limits**. This supersedes the earlier full-roadmap
batch interpretation and its proposed requirement to finish every advanced tool
and human acceptance gate before publication. It does not claim those items done.
Architecture, boundary, delivery and test-quality reviews are self-review.

## Decision

Complete the distinct v3 core on the existing isolated branch: source-bound
connection creation/reconnection (including atomic explicit connection sets),
complete group operations, canonical models/editions/history, native/custom
Foldkit controls and a bounded workbench demo. Use the existing transaction kernel
and granular live protections; do not manufacture a legacy EditorState or infer
capability by extracting a bare graph. Full-document history retains checkpoint
mode, group-port capability and camera. Preserve world coordinates, explicit group
parents, rectangular group envelopes and fixed v1/v2 readers.

Expose an exact v3 compatibility inventory and a read-only Effect CLI inspector.
Clipboard, layout, SVG/PNG, Mermaid, modelling patches, conversion receipts,
review packets and relationship audits remain version-fixed until their v3
adapters are separately qualified. Downgrade never removes group ports or rewrites
endpoints implicitly; a ported checkpoint blocks an entire model downgrade.
Native v3 controls are a documented subset, not a claim that the whole legacy
control catalogue accepts v3.

Rotation, whiteboard tools, dedicated multi-connect UI, production Mermaid import,
server rasterization, broader performance and human device/screen-reader
acceptance remain explicit limits. Preserve unfinished advanced work separately
from the release source. No complete React Flow parity or superiority claim.
Keep CLI and Alchemy workspaces private.

## Delivery

Run required repository checks, cold installed consumers, TypeDoc and browser
interaction/evidence. Commit before a fresh empty-cache CI rehearsal. Push via a
PR, satisfy required checks and merge. Use release-please for the next linked
four-package version; existing 0.4.0 tags identify earlier source and must not be
repointed. Publish only the four public Zloz packages from the qualified release
ref through the existing npm provenance workflow, then verify registry contents
and a registry-installed consumer. Credential failures remain external blockers.

## Consequences

Users can adopt group-port authoring without an unbounded rewrite or a promise
that every adapter already understands it. The cost is explicit API version
selection and refusal at unsupported boundaries. The next v3 adoption work should
start with layout and vector/raster projection because these make ported models
useful outside the editor; advanced tools remain their own qualification work.
