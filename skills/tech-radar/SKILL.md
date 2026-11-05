---
name: tech-radar
description: Use when adding, moving or retiring an entry on the tech radar (apps/tech-radar), writing its markdown, starting a new edition, previewing a change locally or on a pull request, or deploying it to techradar.opsydyn.xyz. Also when changing the radar app itself or explaining how its content, editions and deploys work.
---

# Tech radar

The tech radar is an Astro app in `apps/tech-radar`, served at
`https://techradar.opsydyn.xyz`. Its content is markdown: one file per entry, one per
edition. The build turns the files into a 3D radar (effect-three in a FoldKit island) and
a page per entry, edition, category and tag. Most changes are content changes, and need
no code.

## Know the content

| File                             | What it holds                                                    |
| -------------------------------- | ---------------------------------------------------------------- |
| `src/content/radar.md`           | The title, what each ring and category means, and the intro      |
| `src/content/editions/<date>.md` | An edition: `date` (its file name) and `label`. Newest = current |
| `src/content/entries/<id>.md`    | An entry: frontmatter, then its full-page write-up               |
| `src/test/fixture.ts`            | The same radar as test data, which the tests compare against     |

Rings are `adopt`, `trial`, `assess` and `caution`; categories are `techniques`,
`tools`, `platforms` and `languages-frameworks`. **A category holds at most eight
entries, and all four are full** (32 entries): a new entry means removing one from its
category, or raising the limit in `src/radar/three/data.ts` and the layout, which is a
code change. An entry's `ring` is its ring in the current edition, and its `history`
lists its ring in each earlier edition it was on. Start a new entry from [the
template](assets/entry.md); [the content reference](references/content.md) has every
field and rule.

## Make a content change

1. **Edit the markdown.** The file name is the id: lowercase, joined by hyphens, and
   used in links (`/blip/<id>/`, `?entry=<id>`), so don't rename one that is published.
2. **Mirror it in `src/test/fixture.ts`.** `test/content.test.ts` proves the markdown and
   the fixture are the same radar, so every entry, ring, relationship or edition change
   goes in both. In the fixture, `summary` is `description` and `source` is `sourceUrl`.
   Earlier editions list only the rings that differ from now, so moving an entry's ring
   can change them too: the failing test prints what differs.
   `test/three/radar-data.test.ts` pins the original 32-entry roster; update its
   expectations when the roster or a placement changes.
3. **Check it.** `bun run --filter @opsydyn/tech-radar test` and `typecheck`. A bad file
   stops the build and names itself (`entries/foo.md: …`).
4. **Look at it.** `bun dev:tech-radar`, then `localhost:4326/?entry=<id>` and
   `/blip/<id>/`. On a pull request, the `preview` label deploys a preview and comments
   its address; Actions minutes are limited, so label only when someone needs to see it.
5. **Ship it.** Merging to `main` deploys production. The workflow runs only when the
   site, its stack or a package it uses changes.

## Start a new edition

Add `editions/<date>.md` with a `label`. The edition that was current becomes an earlier
one, and an earlier edition's rings come only from `history`: **give every entry that was
on it a `history` line for it** (`edition: '<its date>'`, `ring: <its ring then>`), or the
radar shows it as absent from that edition. Then set each entry's `ring` for the new
edition, add the new entries, and mirror all of it in the fixture's `editions` list. The
edition page and "Compare with…" show what moved.

## Remove an entry

There is no retired state: every entry is on the current edition. Deleting the file
removes it everywhere, earlier editions included. To keep its past, move it to `caution`
with a write-up that says why, rather than deleting it.

## Deploy

`.github/workflows/deploy-tech-radar.yml` runs the Alchemy stack in `infra/tech-radar`:
production on `main`, `pr-<number>` previews for labelled pull requests, destroyed when
the label or the PR goes. Local deploys need an Alchemy profile with Cloudflare (see the
infra README). The state store is v8: never deploy from a branch made before
`docs/releases/alchemy-beta-85.md`.

## Change the app

The radar under `src/radar/three` is a copy of `packages/effect-three-samples/src/radar`
and leaves the original unchanged: port a radar fix by hand if both need it. Page logic is
in `src/radar/pages.ts`, link previews in `scripts/previews.ts`. For the 3D scene read the
`effect-three` skill; for the Astro island, `astro-foldkit`. Tests run on `bun test`.
Verify a UI change in the browser at phone width as well as desktop.
