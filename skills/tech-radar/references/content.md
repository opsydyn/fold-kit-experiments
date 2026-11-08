# Tech radar content reference

`src/radar/content.ts` decodes the markdown at build time and the radar's own dataset
decoder checks the result. Either stops the build with a message naming the file.

## An entry: `src/content/entries/<id>.md`

| Field      | Required | Rule                                                                                           |
| ---------- | -------- | ---------------------------------------------------------------------------------------------- |
| `name`     | yes      | Shown on the radar and the page                                                                |
| `category` | yes      | `techniques`, `tools`, `platforms` or `languages-frameworks`                                   |
| `ring`     | yes      | `adopt`, `trial`, `assess` or `caution`: its ring in the current edition                       |
| `summary`  | yes      | One line: the card on the radar and the list pages                                             |
| `source`   | yes      | An `https://` address for the thing itself                                                     |
| `tags`     | test     | Lowercase words joined by hyphens, each a `/tag/<tag>/` page. The tests want at least one      |
| `history`  | no       | `- edition: '<date>'` and `ring:` for each earlier edition it was on, each edition once        |
| `related`  | no       | `- to: <id>`, `type:` and `note:`: a relationship this entry starts, to another existing entry |
| `author`   | no       | Who wrote the write-up                                                                         |
| `decision` | no       | An address for the decision record behind its ring                                             |

Each category holds at most eight entries (`src/radar/three/data.ts`, for the layout), and
ids are lowercase words joined by hyphens, unique across the radar.

Relationship types: `builds-on`, `complements`, `inspired-by`, `guards-against`,
`alternative-to`. Write a relationship once, on the entry it starts from; the other entry's
page shows it too.

The body after the frontmatter is the full-page write-up, and the tests want one: what it
is, why it is in its ring, and, when it moved, why. Quote dates in YAML (`'2026-10-14'`),
or YAML reads them as dates rather than strings.

## An edition: `src/content/editions/<date>.md`

```markdown
---
date: '2026-10-14'
label: Fourth edition
---
```

`date` must equal the file name. The newest date is the current edition; the radar needs
at least one. An entry's `history` may only name editions older than the current one.

## The radar: `src/content/radar.md`

`title`, `rings` (a sentence for each of the four) and `categories` (a sentence for each),
then the introduction as the body.

## The fixture: `src/test/fixture.ts`

`demoRadar` is the same radar as the markdown, as the radar's dataset:

- `authoredOn`: the current edition's date.
- `entries`: `id`, `name`, `category`, `ring`, `description` (the `summary`) and
  `sourceUrl` (the `source`), in any order.
- `relationships`: `from`, `to`, `type`, `note`, one per `related` item.
- `editions`: one per earlier edition, oldest first, with `authoredOn`, `label`, `rings`
  (only the entries whose ring then differs from their ring now) and `absent` (the ids
  with no `history` line for it).

`test/content.test.ts` assembles the markdown and compares it with this, entries,
relationships and absences as sets. When it fails after a content change, the difference
it prints is what the fixture is missing.

## Where content shows

| Address                          | What                                                               |
| -------------------------------- | ------------------------------------------------------------------ |
| `/?entry=<id>`                   | The 3D radar, flown to the entry; `&edition=<date>` for a past one |
| `/blip/<id>/`                    | The entry's page in the current edition                            |
| `/edition/<date>/blip/<id>/`     | The entry's page as it stood in an earlier edition                 |
| `/edition/<date>/`               | An edition's notes, changes and entries                            |
| `/category/<id>/`, `/tag/<tag>/` | Lists by ring                                                      |

Link previews (`/preview/<path>.png`) are rendered by `bun run --filter
@opsydyn/tech-radar previews`, which `dev` and the deploy run first.
