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

## 2. Deep links (sketch)

- **What goes in the URL.** The query string records:
  - the pinned entry, the edition, the view (home, universe, a cluster or a fly-to)
  - filters, search, theme and whether edges are on
- **What doesn't.** Not the raw camera position: a link opens on a named view, and the
  view then flies there.
- **Reading and writing.** A Command writes the URL with `history.replaceState` when one of
  those fields changes. `init` reads it, so a shared link opens exactly there.
- **Copy link.** A button in the details card and the breadcrumb.
- **Tests:** encode/decode round-trips. Unknown or invalid parameters are dropped, never
  thrown.

## 3. Flight recorder (sketch)

- **Recording.** The app records the reader's intents with their timing: Messages such as
  pins, flights, scrubs, theme changes and eggs, but not animation frames or pointer moves.
- **Replay.** Feeds them back on a subscription clock, with a caption per step. Played back,
  it is a guided tour.
- **Sharing.** Export and import as JSON. A tour may later be shared in a deep link.
- **Tests:** replaying a recording reproduces the recorded final Model exactly. It is a fold
  over `update`, the property the Elm-style design makes free.

## 4. Bring your own radar (sketch)

- **Loading.** A drop zone and file input in the sidebar takes JSON (`RadarDataset`) or a
  CSV in the common radar format (name, ring, quadrant, description, ...).
- **Errors.** Decoding goes through `decodeRadarDataset`, and the errors are listed in
  words.
- **Privacy.** The data stays in the browser. "Back to the demo" restores the fixture.

## 5. Finishing touches (sketch)

- **The opening shot.** The camera starts far out in the universe view and flies in as the
  title fades. Under reduced motion, a fade only.
- **Poster export.** Saves the current view as a PNG, Blueprint at its best. It may need
  effect-three to keep or read back the drawing buffer; check that first and raise it there
  if so.
