# ADR 0061: Decode versioned modelling-patch text strictly

## Status and scope

Accepted for the approved P2 decoder slice, 2026-11-13. Extends
[ADR 0060](0060-preview-bounded-modelling-patches-before-apply.md).
Architecture/boundary, delivery and test-quality review are self-review:
**safe with noted risk**. Core remains dependency-free. No CLI command, Apply,
UI, dependency, publication, PNG or Alchemy is introduced.

## Decision

Expose `parseModellingPatch(text, options?)` and typed parse options/result in
core. Decode exactly one raw `foldkit-zloz-patch` version 1 proposal. Do not unwrap
CLI protocol envelopes, model documents, review packets or conversion receipts.
Return `parsed` with an owned deeply frozen proposal, or `rejected` with `code`,
`reason` and JSON Pointer `path` (empty for root). Rejection codes are
`invalid-json`, `limit-exceeded`, `unsupported-format`, `unsupported-version` and
`invalid-patch`. Invalid limit configuration throws the existing `ZlozError`.

Run a bounded JSON lexical/grammar preflight before the complete native JSON.parse.
Reject duplicate decoded property names at every object depth, including escaped
spellings and fields inside opaque metadata. Do not normalize distinct Unicode
keys. Validate strings/escapes, JSON-only whitespace, delimiters, number grammar,
finite number values and the single-document frame. Reject comments, BOM, trailing
commas, trailing documents and non-JSON whitespace. Malformed input is data, not a
native SyntaxError escaping into a host. Do not use revivers or evaluate content.

Defaults and maximums are the existing proposal caps: 2,000,000 UTF-16 code units,
value depth 64 (root depth zero) and 100,000 JSON values (including containers,
excluding property names). Hosts may tighten `maxCharacters`, `maxDepth` or
`maxValues`, positive safe integers bounded by those caps; they cannot relax the
v1 object contract. Character count includes whitespace/escapes. Shared internal
limits keep the decoder and object capture aligned; the 1,000-operation cap also
reports `limit-exceeded` at `/operations`. Bound traversal before full JSON
allocation and domain reconstruction. These are not input-byte, peak-memory or
wall-clock guarantees. File/stdin hosts must additionally enforce UTF-8 bytes,
fatal decoding, framing and cancellation in their IO boundary.

After preflight, require the format/version and delegate exact envelope, source
graph, payload, provenance and data-only validation to `captureModellingPatch`.
Retain its path for schema failures; existing graph invariant errors may be rooted.
No second operation/semantic validator is introduced. Decoding validates a proposal,
not its ability to change the current model: target conflicts, candidate graph,
source freshness, review policies and losses still belong to `dryRunModellingPatch`.
A syntactically valid removal that leaves dangling edges can decode and then be
rejected by dry run. Neither result establishes authentication, consent or Apply
permission. Existing graph/model/review codecs and patch wire v1 stay unchanged.

## Alternatives and consequences

JSON.parse alone loses duplicate keys. A reviver sees only their last value and
runs after unrestricted nesting allocation. Importing the optional Mermaid
adapter into core would reverse dependency ownership; changing its established
review-packet decoder is unnecessary for this bounded slice. Keep this patch
preflight local, with native JSON.parse still constructing the value and the
existing object validator owning proposal semantics. It is a small bounded grammar
scanner, not a general-purpose public JSON parser. A future shared internal scanner
requires preserving both decoders' independently qualified error/limit contracts.

Costs are a second bounded pass, decoded property-name sets and strict object/text
compatibility. Unicode/number/framing and limit-boundary tests must qualify the
scanner; no parser-performance claim follows from these limits. Rollback before
publication is a local revert without changing existing stored models.

## Implementation and verification

Add one core decoder module and root types/functions. Share internal patch limits
and expose only the existing validation error path internally; do not relax the
object validator. Start with failing literal, version, duplicate/escaped/nested key,
syntax/framing, finite number, precise path and budget tests. Prove the depth/value
limits against otherwise valid data and keep decoding separate from live dry run.
Use the literal v1 fixture, frozen ownership and no editor mutation assertions.
Exercise actual installed tarballs under Node/Bun and Bundler/NodeNext, including
wide arrays and duplicate metadata. Capture deterministic parsed/rejected examples,
update guides/API/roadmap without claiming CLI or Apply. Run root lint/format,
typecheck, all workspace tests and TypeDoc sequentially where dist builders overlap.
Next: Effect CLI dry run using bounded fatal UTF-8 IO and this decoder.
