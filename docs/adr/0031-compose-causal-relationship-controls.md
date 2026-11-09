# ADR 0031: Compose causal relationship controls

## Status

Accepted for the approved package chooser/inference/workbench slice, 2026-11-09.
Boundary review: **safe with noted risk**. Hosts must supply current inspector
identity, convention configuration and editing policy when resolving requests.

## Decision

Core derives a chooser, explicit inference action, status and availability /
compatibility reasons from EditorState and a target edge ID. It owns no draft,
selection, timer or persistence field. Compatibility diagnostics remain separate
from enforcement: rendering controls does not enable a convention policy. Hosts
supply the same live policy to context, request resolution and updateEditor.
Read-only, active gestures and host restrictions protect edits; blank vetoes
become nonempty reasons.

Requests carry edge identity plus a semantic key or an explicit inference intent.
The fresh resolver checks the current inspector target, current catalogue,
lifecycle and policy before returning an EdgeArchitectureChanged event, unchanged,
ignored or blocked. Unknown keys never clear meaning; unfamiliar stored values
remain visible as current-only unavailable options. Named custom keys remain
distinct. Empty/ambiguous inference never selects an arbitrary rule. Selecting
the existing key is a no-op and inference cannot overwrite descriptions when the
edge already has explicit meaning of that kind. Actual events pass through the
existing updateEditor transaction and policy checks for ordinary Undo/Redo.

The optional Foldkit entry provides a native select, explicit inference button,
polite status, visible reasons and a composition with nullable renderer slots and
layout hooks. Labels, attributes and presentation remain host-owned. The select
uses both controlled value and explicit option selection for server rendering;
unavailable stored options remain faithfully selected. Helpers emit requests,
never captured descriptors or permission decisions, and generate no DOM IDs.
Custom shells can retain native semantics by calling individual helpers.

The workbench replaces private semantic chooser logic with these helpers. Its
adapter validates model identity, projection epoch and the current inspector edge
before re-resolving current rules and operation policy. It demonstrates custom
native wrappers, inference content and a semantic status badge. Existing fixture
actions, convention switches and whole-diagram report remain host examples.

## Alternatives and consequences

Dispatching saved descriptors would let catalogue changes bypass interpretation.
Treating unknown keys as null could erase authored meaning. Coupling diagnostic
compatibility to disablement would silently enforce conventions on workshop drafts.
A second local draft would duplicate graph truth and complicate Undo. Reuse the
existing core conventions/policy/event instead; share catalogue validation
internally without introducing another public rule contract.

No dependency, serialization, publication or deployment changes. Rollback is a
code revert. Architecture, delivery and test-quality review are self-review.
