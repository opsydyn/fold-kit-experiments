# Changelog

## Unreleased

- Add bounded v2 validation, compatibility inspection and explicit v2 Mermaid selection; distinguish valid-but-incompatible v1 adapters (exit 1) from invalid input (exit 2).

- Add read-only C4 receipt inspection with full provenance, before/after changes, recorded losses and explicit incompatible/invalid exits.

- Add DDD edition comparison through Effect CLI with exact structured deltas, regression exits and explicit validation/selector failures.

- Add Effect CLI DDD audit with deterministic JSON reports, data-only custom conventions and explicit compatible/incompatible/input exit semantics.

- Add Effect CLI patch dry run with separate current source, strict decoding and explicit exit semantics.

## 0.1.0 — unpublished candidate

- Add standalone Effect CLI commands for canonical model validation and Mermaid export.
- Add versioned JSON responses, strict/report loss policies, scoped byte-limited input and typed exit codes.
- Qualify clean package consumers and Node/Bun executables without adding an Effect dependency to core.
