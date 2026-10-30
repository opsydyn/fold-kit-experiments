# Spike: radar proposals on `@alchemy.run/domain`

Proposals and votes for the tech radar, modelled with Alchemy's domain library and
specified as Stories, to learn whether the library is ready. Run on 2026-10-30 against
`@alchemy.run/domain` `2.0.0-beta.84`, Effect `4.1.0`, `@effect/vitest` `4.1.0` and Vitest
`5.0.5`.

The code is on the branch `spike/radar-proposals` (`spikes/radar-proposals/`), kept apart
from `main`: it adds a workspace that is not meant to ship. There,

```sh
bun run --filter @opsydyn/radar-proposals-spike test        # 5 stories
bun run --filter @opsydyn/radar-proposals-spike typecheck
```

The decision it informs is in the tech radar plan
([`2026-10-28-tech-radar-app.md`](../superpowers/plans/2026-10-28-tech-radar-app.md)),
under "Final infra stage: reviewing `@alchemy.run/domain`".

## What it models

`spikes/radar-proposals/src/proposal.ts`:

- **`Proposal` aggregate:** `ProposeMove` (an entry from one ring to another, with a reason),
  `CastVote` (once per voter, replying with the tally) and `CloseVote` (accepted with three
  in favour and more for than against, rejected otherwise). Rejections: `AlreadyProposed`,
  `SameRing`, `NotOpen`, `AlreadyVoted`.
- **`ProposalTally` view:** one proposal's entry, target ring, votes and status, which the
  radar would watch over a WebSocket beside the entry's card.
- **`Radar` model:** both.

`spikes/radar-proposals/test/proposal.test.ts` covers each command's happy path, every rejection and the view.

## What it found

- **Effect only appears to line up.** With FoldKit 0.170 the library resolves the
  repository's Effect 4.1.0 and the Stories pass, but they never load Alchemy's own runtime.
  Alchemy `2.0.0-beta.84` imports `effect/Crypto`, which 4.1 removed: the same day, its CLI
  failed every tech radar deploy on 4.1 until infra went back to Effect 4.0.7. Hosting the
  model needs Alchemy itself, so condition 1 of the review is not met.
- **Vitest 5 works.** `@effect/vitest` 4.1 runs the Stories on Vitest 5.0.5, and apps/web's
  408 tests pass on it, once its on-disk module cache is off (vanilla-extract's `.css.ts` files skip their compiler when cached).
- **The published Story API is the documented one.** `given`/`when`/`then`/`rejected`/
  `replied`/`view` all behave as the package's own skill describes; `expectCall`/`resolve`
  are what this release ships for external calls.
- **Modelling is quick.** Five stories passed on the second run. The one failure was mine:
  spreading the command into an event copies the command's `_tag`, which the event's
  schema rejects. Build events field by field.
- **It is light.** About 1.3 MB installed, and `alchemy` comes along as a required peer.
- **Lint.** The repository's rules raise one error, on the library's documented
  `import * as Schema from 'effect/Schema'` (no namespace imports from Effect packages);
  named imports fix it.

## Not tried

- Hosting: the model in its own Worker with Durable Objects beside `Website.Astro`
  (`Website.Foldkit` is the documented pairing).
- Sign-in: every write needs it (`cloudflare-domain-better-auth`).
- The FoldKit client: commands as FoldKit Commands with `Succeeded*`/`Failed*` Messages,
  the tally as a Subscription.
- The `ExternalSystem` that opens a markdown pull request for an accepted proposal.

## Verdict

Condition 1 (one Effect) is not met: Alchemy has to run on Effect 4.1 first. The Vitest
cost is paid. Condition 2 (a few
stable releases) still stands: beta.84 is still the only release. Condition 3 (a write
feature) is now approved in principle. The next step, when the library has moved on, is a
hosting spike: the `Radar` model in a Worker beside the site, behind sign-in.
