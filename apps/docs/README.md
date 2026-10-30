# @opsydyn/docs

The repository's `docs/` folder as a [Starlight](https://starlight.astro.build/) site:
decisions, spikes, releases, assessments and working notes, with search and navigation.
Published at <https://opsydyn.github.io/fold-kit-experiments/docs/> by the Pages workflow.

```sh
bun run dev:docs                                  # → localhost:4327
bun run --filter @opsydyn/docs build              # → apps/docs/dist
bun run --filter @opsydyn/docs test
```

## How it reads docs/

Nothing is copied: `src/repoDocs.ts` is the docs collection's loader, and reads every
markdown file under `docs/` in place, leaving out hidden folders.

- **Page ids:** a file's path without `.md`, lowercased; a folder's README is the folder's
  page, and `docs/README.md` is the home page.
- **Titles:** the file's first `#` heading, removed from the body because Starlight shows
  the title.
- **Links:** `src/repoLinks.ts` rewrites relative links. One to another doc goes to its
  page; one to anything else in the repository, such as source or an image, goes to it on
  GitHub (`main`).
- **Sidebar:** grouped by folder in `astro.config.ts`; a new folder needs an entry there.

In development the loader watches `docs/` and reloads on a change.
