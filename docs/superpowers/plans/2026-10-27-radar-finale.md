# Radar finale — themes, then the features that make it stick

Five PRs, in order. The first, themes, is planned in detail; the rest are sketched so the
order and shape are agreed, and each gets its own short plan before it is built.

1. **Themes**: Night, Blueprint, Paper, High contrast (this plan)
2. **Deep links**: the URL opens on the exact view
3. **Flight recorder**: record a session as Messages and replay it as a guided tour
4. **Bring your own radar**: drop in a file and see your own stack
5. **Finishing touches**: the opening shot, and a poster export

---

## 1. Themes

### What the reader gets

| Theme             | Look                                                                                                        | Chosen automatically when                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Night**         | Today's radar: night sky, stars, translucent shells, glow                                                   | `prefers-color-scheme: dark` (and the fallback) |
| **Blueprint**     | Cyanotype: deep blue paper, white linework, a faint drafting grid on the equatorial plane instead of stars  | Never; picked by hand                           |
| **Paper**         | Ink on warm white: no stars, no glow, shells as hairline rings, labels in dark ink                          | `prefers-color-scheme: light`                   |
| **High contrast** | No translucency, solid shell outlines, bolder labels and edges, the line styles kept as the second encoding | `prefers-contrast: more` or `forced-colors`     |

- A **Theme** picker sits in the sidebar's View section: a radio group reading Auto, Night,
  Blueprint, Paper, High contrast.
- Auto follows the reader's settings and changes live when they do.
- A manual choice is remembered in this browser (key `radar-theme`). Auto clears it.

### Design

- **`src/radar/themes.ts`, pure.**
  - `Theme = 'night' | 'blueprint' | 'paper' | 'contrast'` and `ThemeChoice = 'auto' | Theme`.
  - A `themes` record, checked with `satisfies Record<Theme, Tokens>`. Its `Tokens` are:
    - the surface and ink
    - muted text, the guide line, the label outline
    - the shell tint and opacity, and how shells draw (`'translucent' | 'outline'`)
    - the sky (`'stars' | 'grid' | 'none'`)
    - the halo (`'glow' | 'ring'`) and an edge-strength factor
    - the category and relationship colours
    - the CSS custom properties (`--surface`, `--text`, `--muted`, `--border`, `--blue`)
  - `resolveTheme(choice, settings)` turns a choice plus the media facts into a `Theme`.
    It holds every rule above, and it is the one place they live.
- **Model.**
  - `themeChoice: ThemeChoice` and `settings: { scheme, contrast }`. The theme in force is
    always derived, never stored.
  - New Messages: `ChangedColorScheme`, `ChangedContrast`, `ChoseTheme`.
  - Settings come from `Dom.streamFromMediaQuery` subscriptions, as reduced motion does
    today.
- **Remembering the choice.** Two Commands, so `update` stays pure:
  - `LoadThemeChoice` at init, settled by `SettledThemeChoice`
  - `SaveThemeChoice` on `ChoseTheme`
- **Scene.**
  - Every hard-coded colour reads from `themes[theme]`: `ink`, `guide`, `outline`, the star
    colour, both palettes, the shell material and the egg materials.
  - `materials` becomes `materialsFor(theme)` with the **same ids**. effect-three's shared
    material definitions are upserts, so a theme change updates live materials in place,
    with no remount.
  - Blueprint replaces the star field with a static line grid. Paper and High contrast show
    no sky.
  - The constellation egg lives in the stars, so it shows in Night and Blueprint only. The
    other eggs work in every theme.
- **View.**
  - The app root carries `data-theme` and the theme's CSS custom properties, so the sidebar,
    overlays and minimap follow the 3D scene.
  - The CSS fallbacks stay as Night's values, for the moment before hydration.
  - The page itself stays dark-neutral (`color-scheme` follows the theme).
- **Colour still means the same thing.**
  - Each category keeps its hue in every theme, with a different step per surface. Colour
    follows the entity, and the legend, labels and table still carry identity, so colour is
    never alone.
  - The relationship palette was validated only against Night's surface (#12121f).
    Blueprint and Paper get their own steps.

### Palette validation (a build step, with results in the PR)

- **Run the validator.** Each theme's category set and relationship set goes through the
  dataviz `validate_palette.js`, against that theme's surface:
  - lightness band, chroma floor
  - adjacent-pair CVD ΔE ≥ 8
  - normal-vision floor
  - contrast against the surface
- **Fix any failures.** A failing slot snaps to the nearest passing step of the same hue.
  - If no step passes on a surface, the slot relies on its line style or body shape there,
    noted in the PR.
  - A contrast WARN means the legend and table must stay visible: they already are.
- **High contrast** uses the system's forced colours where they apply, and otherwise
  Paper's validated steps at full strength.

### Tests (bun:test, pure)

- **Tokens:** every theme has every token, and `materialsFor` returns the same set of ids
  for every theme.
- **`resolveTheme`:** the whole matrix (scheme × contrast × choice), with a manual choice
  winning over Auto.
- **Messages:**
  - `ChoseTheme` saves, and Auto clears the saved choice.
  - `SettledThemeChoice` restores it, and a garbage or missing value falls back to Auto.
- **Scene:**
  - Night has stars; Blueprint has the grid and no stars; Paper and High contrast have no
    sky.
  - High contrast has no translucent shells.
  - The constellation egg shows only with stars.
- **Palettes:** each theme's palettes match the validated values in `themes.ts`. The PR
  records the validator output.

### Delivery

- Branch `feat/radar-themes`, three commits:
  1. theme state, picker and remembering, with Night and Paper
  2. Blueprint and its grid
  3. High contrast
- A Chromium pass of all four themes at desktop and 375px, with screenshots in the PR.
- Auto is also checked by switching the emulated colour scheme.

---

## 2. Deep links

**What the reader gets:** the address bar always describes the view, so a copied URL opens
the radar exactly there. A **Copy link** button in the details card and the breadcrumb says
"Link copied" in the readout.

- **The link's fields** (query string, all optional, unknown or invalid ones dropped):
  - `entry`: the pinned entry
  - `edition`: by date, so links survive new editions
  - `view`: `universe`, `cluster:<category>` or `entry`, the last flying to `entry`
  - `q`, `category`, `rings` (only when not all), `edges=off`
  - `theme` (a picked theme; Auto is left out)
- **Not the raw camera.** A drag is not a place worth linking, and camera noise would churn
  the URL.
- **Pure core** in `link.ts`: `linkOf(model)` gives the query string, and
  `applyLink(model, params)` sets edition, filters, pin, theme and the view's camera.
- **Reading the link.** `radar.astro` renders on the server, so it passes the page's query
  parameters to the app as a `link` prop. `init` applies them on the server and the client
  alike, so hydration matches.
- **Writing the link.** The `update` wrapper compares `linkOf` before and after each step.
  When it changes, it adds a `ReplaceLink` Command, which calls Foldkit's
  `Navigation.replaceUrl` (no history entry per click).
- **Theme in a link** applies for that visit only; it is not saved over the reader's own
  choice.
- **Copy link** is a Command writing `location.href` to the clipboard. If the clipboard
  refuses, the readout says so.
- **Tests:**
  - `applyLink(linkOf(m))` round-trips every field.
  - Garbage parameters are dropped.
  - Drags and hovers never change the link.
  - `init` with a link opens pinned, in the right edition and theme.

## 3. Flight recorder (guided tours)

**What the reader gets:** a **Tour** section in the sidebar: Record, Stop, Play, Save and
Load. Play replays the session as a guided tour, with a caption bar over the stage ("Flies
to FoldKit", "Scrubs to the second edition", "Shatters the Monolith").

- **What is recorded.** The reader's intents, in order, from an allowlist of Messages:
  - pins, fly-tos, relays, cluster stops, universe and reset
  - turns and zooms
  - edition and play
  - search, filters, rings, the edges toggle
  - theme
  - the Monolith and the Konami code
- **What is not.** Drags, hovers and animation frames: a tour is the named moves, not mouse
  noise.
- **Where a tour starts.** A recording begins with `linkOf(model)` at the moment Record is
  pressed. Replay first applies that link, then feeds the steps, so it starts where the
  recording did.
- **Pacing is by kind, not by wall-clock time,** so tours are deterministic and watchable:
  - a flight or relay waits for its landing (about 2.4 s)
  - a pin waits 1.5 s
  - a filter or scrub waits 1.2 s
  - playing the timeline waits for it to finish
- **During playback** a subscription clock drives the steps. Any interaction of the
  reader's stops the tour. Under reduced motion it steps without flights, cameras landing
  at once.
- **Saving and loading.** A tour is saved as a JSON file through a download Command, and
  loaded through Foldkit's `File.select` and `readAsText`. Loading decodes against the
  Message schema, and the readout reports a bad file in words.
- **Tests:**
  - The central property: folding `update` over a recording, from its start link, ends at
    the Model the recording stopped at (comparing everything but cameras in flight and
    clocks).
  - Pacing is a pure table.
  - Captions exist for every recorded kind.
  - Disallowed Messages are never recorded.

## 4. Bring your own radar

**What the reader gets:** a **Data** section with **Load your radar…** (`.json` or `.csv`)
and **Back to the demo**. The file is read in the browser and never leaves it.

- **JSON:** a `RadarDataset`, validated by the existing `decodeRadarDataset`, so it may
  carry relationships and editions too.
- **CSV:** the common tech-radar sheet format, `name, ring, quadrant, isNew, description`,
  with an optional `url`.
  - Quadrant names map case-insensitively to the four categories (Techniques, Tools,
    Platforms, Languages & Frameworks); `Hold` maps to Caution.
  - Ids are slugs of the names, made unique.
  - A small pure parser handles quoted fields and commas inside quotes.
- **`sourceUrl` becomes optional** in the entry schema. Today it is required and must parse
  as a URL, which a sheet without links would fail. The details card hides "Source" when
  there is none.
- **Errors** list in the panel by row and field ("Row 7: ring 'Later' is not adopt, trial,
  assess or hold"). Nothing loads until the file is clean.
- **What follows the data:**
  - With no editions the timeline hides; with no relationships, the edges and moons do.
  - The fixture's own eggs (the Futhark saucer, the CAP moons on Local-first sync) simply
    don't appear. The others work on any data.
  - A deep link to an entry the loaded data lacks drops the pin.
- **Tests:** the CSV parser (quoting, blank lines, BOM), quadrant and ring mapping, id
  uniqueness, error messages, and a loaded radar rendering a scene.

## 5. Finishing touches

**The opening shot**

- The first time the radar opens, the camera starts far out above it and flies in to home
  (or to a deep link's view), while a title card ("3D tech radar", the edition date) fades
  away.
- **How:** the model starts with an `opening` camera. On the scene's `StartedScene`
  lifecycle event, `update` sets the real target, and the existing flight damping does the
  rest. This is pure, with no timers.
- Under reduced motion the camera starts at its target and the title only fades.

**Poster export**

- A **Save poster** button saves the current view as a PNG:
  - the stage, plus a strip with the title, edition, theme and date
  - named `tech-radar-<theme>-<date>.png`
  - Blueprint is the showpiece.
- **How:**
  - The radar gets its own mount whose WebGL renderer passes `preserveDrawingBuffer: true`.
    effect-three's renderer factory already forwards renderer options, so no library change
    is needed.
  - A Command draws the stage canvas and the caption strip onto an offscreen canvas and
    downloads it.
  - Labels are drawn in the canvas (troika), so they come along. HTML overlays don't.
- **WebGPU pages:** where the page draws with WebGPU (`?renderer=webgpu`), capture differs,
  so the button hides there. That's noted as a follow-up for effect-three.
- **Tests:**
  - The opening steps (start, then the lifecycle sets the target, and reduced motion skips
    it).
  - The poster's file name and caption text.
  - The canvas capture itself is checked in the browser.

## Order and delivery

- **Each item is its own branch and PR,** in the order above, after the themes PR. Deep
  links include the theme, and tours build on deep links.
- **Each is verified** with the full suites, `bun run check` and a Chromium pass at desktop
  and 375px.
- **Each is committed locally,** and pushed and opened as a PR only when asked.
