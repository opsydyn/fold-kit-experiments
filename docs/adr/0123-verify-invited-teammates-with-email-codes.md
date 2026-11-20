# Verify invited teammates with email codes

## Status

Accepted for the Teams staging pilot.

## Context

The Moonwell playtest needs separate Teams identities for one DM and three
players. Gmail plus addresses reach one QA inbox and need to stay distinct as
Teams identities. The existing Google provider continues to support the
staging owner's login and bootstrap flow.

## Decision

Use Better Auth's email OTP plugin for passwordless sign-in and the existing
D1 auth store for verification and sessions. Expose only the sign-in code
request and verification endpoints. Before either operation, require a pending,
unexpired invitation for the exact normalized address in the configured team,
or a verified account with membership in that team. Normalization preserves
plus tags. Accepting the invitation still creates the membership and assigns
its role through the existing Teams flow.

Send through a private Cloudflare Email Sending binding with an allowed sender
address. Enable the binding and sign-in method together for one staging team.
Local tests exercise the same path using Alchemy's simulated outbox.

## Consequences

The pilot needs a verified sending domain and a mailbox delivery check before
staging play. Turning off the service settings removes the email option.
Provisioned identities and memberships are retained. The rollout requires no
additional auth database migration.
