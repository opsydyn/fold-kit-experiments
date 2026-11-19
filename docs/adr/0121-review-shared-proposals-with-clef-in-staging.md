# ADR 0121 — Review shared proposals with Clef in staging

Accepted 2026-11-19. The user approved live shadow review of shared OPY
relationship proposals on Teams staging, with acceptance by editors.

## Context

The recorded three-case demo proved inference and the response format on
synthetic inputs. The shared OPY aggregate already owns proposal identity,
relationship evidence and acceptance. A live model response needs a boundary
that cannot accept an OPY decision or publish it to another client.

## Decision

An owner or editor explicitly requests a private, temporary advisory from the
existing OPY proposal card. The request names an exact persisted proposal
revision and relationship fingerprint. The backend uses the existing signed
session, same-origin boundary and current diagram membership. It reads the
canonical aggregate, confirms the proposal is open and its relationship still
matches the reviewed context, then sends only its saved content to Workers AI.
The card tells the editor which content will be sent.

The only question is whether a reviewer needs more evidence. Keep the model's
probability and return it to the requesting session. Recheck authority and
proposal context after inference. A late result for a changed or closed
proposal is discarded. The model sees no application credentials and has
no command surface. Human acceptance continues through the existing OPY
decision command and history.

Enable the private Worker binding only at the Teams staging origin with OPY
authoring enabled. Limit each signed-in requester to an approximate threshold
of five requests per minute per Cloudflare location. The inference times out
locally after 20 seconds and has no automatic retries. This is a staging
throttle. Its distributed counts are unsuitable for a hard account-wide budget.

Apply the initial AI and rate-limit bindings with the reviewed Alchemy staging
plan under a single lease. The quick path from ADR 0120 continues to reject
binding changes. A reviewed deploy with `ZLOZ_CLEF_SHADOW=false` disables the
capability and removes the bindings.

## Alternatives and trade-offs

Automatic evaluation would transmit evidence on every proposal without a
per-request user action. Persisting shared advisories would attach model output
to decision history and require a separate consistency and retention contract.
An explicit temporary advisory makes it possible to qualify live inference
before deciding whether feedback should be shared or retained.

## Verification

Use two editors on a synthetic proposal. Verify it stays open after the
reviewer receives an advisory, accept explicitly, and reload both clients.
Verify viewers, mismatched references and expired permission cannot obtain
an advisory. Compare the confirmed graph export across the journey. Check the
two new bindings and the deployed build on Teams staging.
