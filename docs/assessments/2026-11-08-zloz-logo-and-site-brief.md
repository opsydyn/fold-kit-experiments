# Foldkit Zloz — shared logo and site brief

**Date:** 2026-11-08. **Status:** implementation brief for review; no logo, new site
or deployment is produced by this planning slice. The user-selected identity is
fixed below; the recommended mark direction and technical names are proposals.
See the [migration inventory](2026-11-08-zloz-naming-migration-inventory.md) for
compatibility, source ownership and delivery gates.

**Implementation follow-up:** The approved [three SVG concepts](../assets/zloz/README.md)
now have shared family-header proofs in both themes, with
[local visual evidence](../../apps/promo/evidence/zloz-logos.md). No final mark is
selected; the original planning-slice status above is retained as history.

## Product and audience

**Foldkit Zloz** is a functional, extensible graph toolkit for interactive node
editors, C4 architecture modelling, and Mermaid export.

**Primary tagline:** Compose systems. Connect ideas.

**Supporting strapline:** Compose. Connect. Communicate.

**Positioning:** More than a flow editor. A system composition toolkit.

Developers compose an interactive graph inside their own application; architects
explore and explain system boundaries; teams communicate a model through portable
diagrams. Designers should be able to realize a visual language through public
composition and themes. The sites must make those jobs clear before listing
individual controls.

Use **Foldkit Zloz** on first mention and **Zloz** thereafter. Use ASCII `zloz` for
slugs, filenames and proposed package names. Explain **Złóż** once in the origin
story: Polish for “fold, assemble, put together.” Do not require accented typing
in navigation, search or installation examples.

Foldkit is the UI toolkit; Zloz is its graph and system modelling toolkit.
Functional composition, immutable data, headless ownership, extensibility and
portability are product principles, not decorative technical copy.

## Three capabilities and honest proof

| Capability      | Demonstration                                                                     | Copy boundary                                                                      |
| --------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Compose**     | A real editable graph: named ports, connections, grouping, layout and Undo        | Demonstrate package-backed behavior, not a looping video presented as an editor    |
| **Model**       | C4 system context and nested container/persistence boundaries                     | Explain C4 meaning versus visual geometry; show where customization belongs        |
| **Communicate** | Export the model as Mermaid with source, identities and visible conversion losses | Say export, not general import or lossless round trip; retain canonical model JSON |

Existing evidence: [nested export](../../apps/flow-sample/evidence/mermaid-subgraphs.md)
and [persistent canvas](../../apps/flow-sample/evidence/sidebar.md). Agent tooling,
general Mermaid import, durable editions and full React Flow parity are not
established by those receipts. The earlier [agents/editions assessment](2026-11-08-flow-mermaid-agents-and-editions.md)
remains a separate feature track, not a current hero claim.

## The family identity to retain

The reference is the **actual local Viz and Three sites**, not an invented new
visual system:

- [Viz layout](../../apps/promo/src/layouts/Layout.astro) and
  [Three layout](../../apps/three-promo/src/layouts/Layout.astro): shared header,
  wordmark placement, navigation, theme toggle, skip link and footer structure.
- [Viz CSS](../../apps/promo/src/styles/site.css) and
  [Three CSS](../../apps/three-promo/src/styles/site.css): Inter Variable,
  editorial scale, restrained borders, large whitespace and semantic theme tokens.
- [Viz mark](../../apps/promo/src/components/Brand.astro) and
  [Three mark](../../apps/three-promo/src/components/Brand.astro): flat filled SVG
  facets in a 32×32 coordinate system. Viz is a folded strip; Three is a faceted
  cube. Zloz needs a third distinct silhouette.

Representative verified tokens, to reuse through semantic variables:

| Role        | Light     | Dark      |
| ----------- | --------- | --------- |
| Page        | `#faf9f6` | `#111319` |
| Surface     | `#fffefa` | `#191c24` |
| Text        | `#151619` | `#f4f2ed` |
| Muted       | `#5d6574` | `#adb6c7` |
| Border      | `#d9dce1` | `#303641` |
| Blue accent | `#3d79fa` | `#4485ff` |

Retain the blue/gold/coral family palette, with mint/lavender/periwinkle as
supporting colors. Reuse the source token system rather than creating a parallel
palette. Existing promo shells use a 1440px maximum width, 60px desktop gutters,
and a large tightly spaced variable-weight hero heading with responsive rules.
Adapt scale for the workbench: dense product controls do not need a 102px hero.

Share the visual primitives deliberately. Do not import all Viz chart CSS or all
Three scene CSS into Zloz merely to inherit the header. A small family shell or
focused token/component reuse is preferable to a new general design-system
package at this stage. Keep logo/site assets out of the graph runtime.

## Distinct logo brief

**Meaning:** independent elements assembled into a coherent system. The mark
should suggest connection and folding without relying on an arrow or Polish
accent to explain the name.

| Direction                               | Description                                                                                                                       | Review concern                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **A — Assembly junction (recommended)** | Two or three faceted pieces meet at an intentional junction; a small negative-space port or connection makes the assembly legible | Must remain distinct from Viz's folded strip and Three's cube |
| **B — Nested frame**                    | An outer folded boundary encloses a smaller element, with one simple connection                                                   | Avoid tiny boxes/lines that disappear as a favicon            |
| **C — Connected planes**                | Offset planes joined by one bridge, suggesting composed parts                                                                     | Avoid a generic node-network icon or a second cube            |

Create a compact contact sheet before selecting a final mark. Direction A is the
starting recommendation, not an approved finished drawing. Compare all concepts
beside the current Viz/Three marks at equal size in both themes.

Asset requirements:

- Author editable SVG with a small, intentional path set; start on the family's
  32×32 grid. Use a visually distinct silhouette, not a recolored existing logo.
- Supply standalone mark, horizontal **Foldkit Zloz** lockup, monochrome/currentColor
  variant and favicon. Provide light/dark treatment and a PNG social-preview export.
- Check 16, 24 and 32px readability, large hero use, monochrome and reversed use.
  Specify clear space, minimum size and a stable accessible brand-link label.
- Keep the wordmark selectable text where appropriate. Decorative inline SVG is
  hidden from assistive technology when adjacent text already names the brand.
- Use one authored asset source for both sites; do not hand-maintain divergent
  logo copies or introduce an image/renderer dependency into core.
- A static mark is sufficient. Any motion is optional, respects reduced motion
  and is not required to recognize the product.

Suggested review artifact location: `docs/assets/zloz/`. Production asset placement
is decided with the site-shell slice, after the mark is selected.

## Promo site — explain and invite

Proposed workspace: `apps/zloz-promo` (private). Astro owns the document, metadata
and family shell; optional native Foldkit islands demonstrate package behavior.
The purpose is product explanation and a clear path into the workbench/docs.

| Page/area     | Required content                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Home          | Zloz lockup, primary tagline, one-line description, real graph hero, three capabilities and four principles                        |
| Examples      | Small editable composition, C4 context, nested container model and Mermaid export review, each linked to a full workbench scenario |
| Docs          | Ownership/quick start, package map, customization/theming, formats/losses and API/type-contract navigation                         |
| Footer/origin | Foldkit relationship, Złóż origin, repository/license and sibling Viz/Three links                                                  |

Primary hero action: **Open the workbench**. Secondary: **Read the API**.
Present package installation as available only after actual publication. Before
that, show a truthful local/release-candidate path. Code snippets must compile
against the available package surface, not merely demonstrate a proposed name.

Use actual model examples, meaningful captions and source. Avoid unsupported
comparison claims, fake runtime telemetry and unexplained decorative graphs.
Screenshots are fallback evidence, not substitutes for advertised interaction.

## Full demo — compose and inspect

Proposed workspace: `apps/zloz-demo`, evolved from `apps/flow-sample`. Tech Radar is
the reference for a complete navigable application and delivery approach; keep
Zloz's editing jobs and the family identity rather than copying radar-specific UI.

- Retain the **single persistent canvas with independently scrolling left
  controls**. Theme and collapse stay easy to reach; narrow mode has a useful
  rail and Fit action. Settings should not push the canvas below the fold.
- Start the scenario library with release workflow, C4 context, C4 container,
  nested container, Onion/grouped architecture and the existing customization/
  policy/large-graph examples. Mark future examples explicitly.
- Organize existing Diagram, Appearance, Navigation, Ports, Policies, Inspect,
  Diagnostics and Mermaid tools so engineers can locate and compare behavior.
  Searchable settings remain a useful separate feature slice.
- Keep Inspect selection-aware and preserve drafts, permissions, Undo and graph
  identity when switching panels. Make example replacement and draft recovery
  clear; do not imply a marketing navigation change preserves an unsaved document.
- Keep diagnostics opt-in/controllable, with core editing and protection reasons
  usable in minimal mode. Keep export losses visible for an explicit export task.
- Provide canonical JSON import/export and Mermaid projection review/download.
  Moving to a new origin requires an explicit export/import or migration path:
  legacy localStorage keys cannot transfer drafts across origins by themselves.
- Link to package API/type contracts and small source examples. Reusable graph,
  layout, C4 and export features belong in packages, not Astro-only helpers.

Astro owns routes and deployment; Foldkit owns interactive Model/messages/Commands.
Do not put a second router, account system or hosting client into the core package.
No new persistence backend is selected by this brief.

## Hosting and delivery boundaries

Cloudflare is the required destination for the full demo. The existing
[Tech Radar stack](../../infra/tech-radar/alchemy.run.ts) and
[runbook](../../infra/tech-radar/README.md) are local references for Astro delivery,
not a new Zloz deployment. Select the concrete Cloudflare service, hostname,
canonical/base paths and preview routing in the hosting slice. Preserve old
`/flow`/API links and correct direct-navigation behavior.

Use separate Zloz infrastructure/state/domain ownership. Do not copy Tech Radar's
production hostname, account/profile state or bindings. Promo hosting is not
selected here; its shell should support a correct base path as Viz/Three do.
Local builds, preview URLs, production acceptance and npm availability must have
separate evidence. Publication remains last.

## Reviewable delivery slices

1. **Logo contact sheet:** 2–3 authored SVG concepts, family-header lockups,
   light/dark/monochrome and small-size comparisons. Select one before final assets.
2. **Public copy + shell:** selected mark, exact approved messaging, family tokens,
   responsive header/footer and first-paint theme behavior. Keep technical imports stable.
3. **Naming bridge:** implement the separately reviewed package/API compatibility
   plan and update runnable docs; preserve old files/keys/URLs.
4. **Promo pages + demo promotion:** real package-backed scenarios, source/API
   navigation and responsive screenshots/journeys.
5. **Hosting qualification:** Cloudflare preview, direct links/assets/theme and
   production acceptance, followed by publication readiness and release.

Acceptance for the implemented sites: recognizable family identity with a distinct
Zloz mark; accurate capabilities and code; working Compose/Model/Communicate paths;
persistent visible canvas on desktop/narrow layouts; no graph/history loss from
presentation changes; readable themes, native focus and reduced-motion behavior.
Accessibility is a design constraint in every slice; full accessibility
qualification remains after functional parity, following the user's sequencing.
A brief is not proof that those sites or assets already exist.

**Recommended next:** the logo contact sheet in the shared family header, then a
selected-mark public-copy/shell slice. No asset or site implementation is part
of this document commit.
