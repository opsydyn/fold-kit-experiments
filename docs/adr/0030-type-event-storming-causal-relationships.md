# ADR 0030: Type event-storming causal relationships

## Status

Accepted for the approved causal vocabulary, validation and workbench slice,
2026-11-09. Boundary review: **safe with noted risk**. Typed syntax and modelling
compatibility have distinct ownership; hosts must opt into current conventions.

## Decision

Reserve optional edge `architecture` for typed event-storming meaning, separate
from labels and host-owned `data`. Built-in roles are issues (actor→command),
handles (command→aggregate), emits (aggregate→event), produces (command→event),
activates (event→policy) and triggers (policy→command). These are Zloz process
conventions, not an executable process or universal workshop grammar. DDD
aggregate/aggregate-root and domain-event nodes participate alongside workshop
notes. Named custom relationships are a distinct union branch; they never need a
cast or payload workaround. Custom catalogues completely replace defaults and
can override node-role interpretation. Duplicate keys or malformed rule
configuration reject; ambiguous inferred matches require explicit author intent.

The pure resolver returns allowed with typed/inferred meaning, unrelated for
ordinary untyped graphs, or a blocked code/reason. Opt-in policy composition
retains host veto precedence and existing port, duplicate, permission and gesture
checks. Creation and reconnection use canConnect. A dedicated edge architecture
veto protects metadata edits, and incident relationships are checked on node-role
changes. Import and Undo/Redo preserve authored snapshots even if a subsequently
chosen convention finds them incompatible. Validation off never erases meaning.

EdgeArchitectureChanged is an ordinary immutable edit with one Undo entry,
no-op equality independent of property order, lifecycle guards, and retained
layout routes. Descriptor syntax is strictly validated by graph readers/writers;
compatibility remains opt-in. Existing graph/snapshot/model envelopes remain v1.
Legacy edges remain untyped and can be interpreted without mutation. Applying
inferred meaning is explicit. Older readers are not promised enforcement of new
edge semantics; mixed-version writers must preserve unfamiliar fields.

The compact five-note starter retains its structure and gains typed links. An
exported factory optionally includes a DDD aggregate root in a readable two-row
process. The workbench uses that variant and demonstrates explicit validation,
custom Delegates rules, role editing, inferred meaning and visible protection
reasons through package APIs. It stores no duplicate semantic model.

History comparison includes edge architecture in authored meaning. Mermaid's
existing semantic-loss diagnostics disclose omitted edge architecture; strict
exports reject loss, and report mode never claims descriptor roundtrip fidelity.
No silent Mermaid grammar extension or new storage envelope is introduced.

## Alternatives, consequences and sources

Labels are editable prose and cannot safely carry relation identity. Hiding
meaning in host data weakens typed contracts. Hard-wiring graph validation to a
single grammar would reject legitimate workshop drafts; replacing editor checks
would bypass established policies. The selected additive contract separates
syntax, conventions, policies and rendering without dependencies or execution.
Rollback is a code revert; retain exported typed documents for compatible readers.
No publishing or deployment. Architecture/delivery/test-quality reviews are
self-review.

[EventStorming's patterns](https://www.eventstorming.com/patterns/) explicitly
present guidance adaptable to context. Its [incremental notation guidance](https://www.eventstorming.com/patterns/incremental-notation/)
supports adding notation as needed. The causal role names above are our bounded
toolkit choices; these sources do not prescribe this exact catalogue.
