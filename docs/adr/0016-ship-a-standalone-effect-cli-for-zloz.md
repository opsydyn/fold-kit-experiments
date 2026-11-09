# ADR 0016: Ship a standalone Effect CLI for Zloz

## Status

Accepted for the approved standalone CLI slice, 2026-11-08. Extends ADR 0015.

## Decision and scope

Create the unpublished `@opsydyn/foldkit-zloz-cli` package and `zloz` executable.
Use the installed Effect 4 `effect/cli` commands/flags, Effect Schema for JSON
syntax, the canonical core codec for graph semantics, typed errors and Node
platform services. Run the runtime only at the executable entry point. Keep
Mermaid export pure and leave the historical parser spike unchanged.

Provide `zloz validate` and `zloz mermaid export`, each with `--input`/`-i` for a
file or `-` for stdin. The default is stdin, bounded to 1 MiB of UTF-8 bytes.
Reject invalid UTF-8 and stop consuming over-limit streams. File reads use
scoped streams; no file is rewritten and there are no network operations.

Command results use a versioned `foldkit-zloz-cli/v1` JSON envelope on stdout.
Keep the existing Mermaid bundle protocol and identity fields inside the data.
Losses reject by default; `--loss-policy report` consents to reported losses,
never to conversion errors. Typed direction choices match the qualified exporter.
Exit 0 means valid/converted/help/version, 1 means rejected conversion, 2 means
invalid invocation/input/I/O. SIGINT retains the platform runner's exit 130.
Invocation errors go to stderr as JSON, keeping stdout clean. Effect CLI owns
help/version/completion parsing and output; do not hand-parse argv.

Do not add Mermaid import, parser dependencies, layout execution, file overwrite
flags, a remote agent/MCP server or automatic package publication to this slice.
The CLI is a separate distribution with Effect/platform dependencies; those do
not enter core or the Mermaid library. Release integration remains publication
readiness work; no old-name package, npm publish or release tag is authorized.

## Alternatives and boundaries

Boundary review: **safe with noted risk**. Commands own platform I/O, input limits,
diagnostic framing and exit codes. Core owns canonical validation, and Mermaid
owns conversion and loss/identity semantics. The host can inject platform services
and run the command tree without starting a process. Do not duplicate graph
validation rules in the CLI schema.

Embedding the CLI in core would impose an Effect/platform runtime on headless
consumers. Promoting the imperative parser spike would ship an unqualified import
engine and historical dependency lock. A new custom argv/Promise framework would
duplicate Effect CLI. Keep the executable as a small adapter over the existing
contracts.

## Acceptance and recovery

Start with failing command behavior tests. Qualify valid/invalid documents,
strict/report losses, unsupported conversion even with report, UTF-8 split across
chunks, byte limits, no reads after rejection, input resource finalization on
interruption, clean stdout/stderr, help/version/options and actual process exit
codes. Install qualified tarballs into an isolated npm consumer and run the
installed binary under Node and the qualified Bun version. Run repository checks,
types/tests/builds. Architecture, delivery and test reviews are self-reviews.

No persistent data migration is needed. Recovery is a source revert and rebuild;
no user file or registry artifact is changed by local qualification. Record
package publication and external deployment separately.
