# ADR 0113: Export native v3 Mermaid with exact loss review

## Status and scope

Accepted, 2026-11-16. The user approved native v3 Mermaid export, explicit group-port
fidelity findings and loss review, composable workbench demo, tests, visual evidence,
roadmap and a local commit in the isolated worktree. No npm publishing, deployment,
CLI writer expansion, production import or other adapter adoption. Architecture,
boundary, delivery and test-quality reviews are self-review. Extends ADRs 0008,
0009 and the full-document v3 boundary of ADR 0106.

## Decision

Keep projection/review in the existing optional Mermaid package; core owns native
validation and does not depend on Mermaid. `exportGroupMermaidV3` captures the
complete native document before sharing the private emitter. Legacy graph/v2
entries keep their validators and protocols. Do not strip group ports to invoke a
legacy writer, invent synthetic nodes, or store a hidden full graph in metadata.

Use a distinct `foldkit-zloz-mermaid/v3` bundle. It retains world convention,
connection mode, group-port capability and native identity records with nodeId /
edgeId, scoped port IDs/kinds, hierarchy and exact original endpoints. V1/v2
metadata and old readers are unchanged. Canonical JSON remains authoritative;
the bundle is a static, lossy projection, not a model/history codec or import API.

[Mermaid documents links to/from subgraphs](https://mermaid.js.org/syntax/flowchart.html).
We project group endpoint owners to those boundary aliases and explicitly treat
missing socket artwork, labels/ordering/anchors and exact attachment as losses.
Mode/capability semantics, camera, authored geometry and opaque semantic/data fields
also have explicit findings. No visual equality or editable round trip is inferred
from syntax acceptance. Empty groups remain errors, including nested empty groups;
no placeholder domain nodes are invented. Errors cannot be accepted as losses.

Share literal encoding, named safe aliases, ordered nested traversal and the
32768 UTF-16 source limit. Native options are owned scalar descriptor records;
accessors and unsupported fields reject without evaluation. Freeze native bundle
and identity outputs. Default policy rejects losses; report mode produces only a
review candidate and never authorizes IO.

`createGroupMermaidReviewV3` / `resolveGroupMermaidReviewV3` /
`updateGroupMermaidReviewV3` bind consent to scope, revision, full document including
camera/mode/capability, direction, file name and exact result bytes/findings. Current
export policy is evaluated again for requests. Settings reset consent and generation;
read-only editions have independent scopes. Download payloads contain exact reviewed
bundle/text, with pending run guards and failure/retry; stale settlements do not
publish payloads or replace newer feedback. A dispatched browser download is not
retroactively revocable. Neither projection nor download edits source or Undo.

The optional Foldkit entry supplies native consent/download primitives and a
composable review with nullable part/finding/layout slots. Required findings and
availability remain visible in minimal mode; optional status can hide. Generated
literal source gets safe keyword/string accents through HtmlBuilder text nodes,
without a product Mermaid runtime. Export the core's existing `zlozThemeStyle`
from its optional Foldkit entry so adapters share the same token mapping rather
than duplicating CSS vocabulary. Host Model/messages/Commands own policy and IO.

## Alternatives and consequences

A bare graph call would discard capability validation; silently dropping group
sockets would hide lost modeling semantics. Synthetic port nodes would invent
topology and require another identity contract. A full graph embedded in a bundle
would obscure projection loss. Duplicating the emitter/review pattern would fork
escaping and request guards. Production Mermaid rendering/import would add runtime
and trust obligations outside the approved slice.

Boundary verdict: **safe with noted risk**. Core validates documents; the adapter
owns projection/consent; host Commands own bytes/IO. Identity keys are transient
content identities, not credentials or DOM attributes. Full source comparisons add
bounded work; broad performance is unqualified. Different Mermaid versions/layouts
may render differently even when syntax succeeds. The existing pinned 12.3.0
qualification installation is used only by the local browser oracle, never shipped
as an app/core dependency. No persistence/schema/dependency version changes.

## Verification and recovery

Test exact native source/metadata, strict/report policy, group socket/attachment
findings, loose mode, empty groups, invalid options/labels and source limits. Test
full-source/setting/protection/consent/run guards, retry, scope independence,
immutable payloads and unchanged history; retain legacy regressions. Verify
installed Node/Bun and Bundler/NodeNext contracts plus optional SSR slots, safe
highlighted text and required minimal-mode findings. Qualify generated source with
actual public Mermaid parse/render in Chromium independently of the product UI.
Capture light/dark/protected workbench, exact downloaded bundle bytes, authored
before/after invariance and current Undo. Run root checks, workspace typechecks /
tests, demo/API builds and staged Moon checks before commit.

Recovery is a local revert; no canonical model or persisted document is migrated.
