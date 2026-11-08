# Standalone Zloz Effect CLI — local qualification

- **result:** complete
- **claim:** The unpublished standalone CLI implements canonical model validation and loss-aware Mermaid export through Effect CLI, Schema, scoped platform I/O and typed errors. Core and Mermaid remain pure and unchanged.
- **evidence:** Repository lint/format, workspace typecheck/tests/build, focused final CLI types/build, TypeDoc and browser checks passed. Nine CLI tests passed with 81 assertions, including an isolated npm-installed binary under Node/Bun, Bundler/NodeNext types and real 0/1/2/130 exits. [Command transcript](../../packages/foldkit-zloz-cli/evidence/cli-transcript.json), [API browser receipt](../../packages/foldkit-zloz-cli/evidence/docs-browser.json), [API screenshot](../../packages/foldkit-zloz-cli/evidence/cli-api.png).
- **remaining uncertainty:** This is local qualification on the recorded Node/Bun versions. Protected CI/Linux and hosted API acceptance are separate evidence. The CLI is not enabled for registry publication or linked release automation. General Mermaid import remains unqualified for production.
- **next:** Review core parity and differentiation, including DDD/EventStorming primitives, before choosing the next implementation slice. Publish no npm package or release tag without separate authorization.

## Boundaries and self-review

Architecture: one separate CLI distribution owns Effect/platform dependencies;
the canonical codec owns graph and snapshot semantics and the existing exporter
owns conversion/identity/loss policy. The sole runtime entry point is `bin.ts`.
Importing the command API starts no process. The API reference now includes CLI.

Delivery: package build, publint, Are The Types Wrong and a clean npm consumer
passed. Input files retain their bytes. Flow-named publication remains forbidden;
no npm workflow, release PR merge or tag creation was performed.

Test quality: literal version-one documents cover success and malformed/version
rejection; strict losses and report errors produce distinct process outcomes;
UTF-8 chunking, invalid bytes, exact byte limit, overflow stop/finalization,
blocked-read interruption, invalid snapshot viewport and unavailable stdout are
covered. Native Node/Bun fixtures exercise real installed binaries and clean
stdout/stderr, including SIGINT after stdin reading has begun.

The lint exception for named Effect-returning functions is scoped to CLI adapter
operations in `index.ts`/`io.ts`; branching/sequencing rules remain active. A
separate fixture-only exception permits injecting fixed platform service Effects.
These are scoped adapter/test boundaries, not changes to domain update policy.

Recommendation: **needs review** for the committed CLI slice. Registry publication
and a Mermaid parser/import feature are outside this qualification.
