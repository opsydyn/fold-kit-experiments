# Radar Easter eggs — first batch

Three hidden extras for the 3D tech radar, each a real architecture idea. They add delight
without touching the radar's data, layout or labels.

## Ground rules (all eggs)

- **One pure module**, `src/radar/easter.ts`. Each egg is a trigger read from the Model and
  turned into extra scene nodes, which `sceneFor` appends after the labels. No egg changes
  `positionsOf`, filters, placement or the dataset.
- **Out of the way.** Eggs live beyond the outer shell (radius > 3.3), never take part in
  label placement, and are never placement obstacles.
- **Render on demand.** An egg animates only while it is shown. Under reduced motion it
  appears in its final pose, with no ascent, spin or drift.
- **Literal unions, not booleans**, for egg state (the lint policy), and `Match` for
  branching.

## 1. The abduction — Strangler Fig (timeline)

When the shown edition has an entry that **left** the radar since the edition before, a
flying saucer hovers over that entry's old position, with a faint light beam down to it.

- **Saucer:** a flattened sphere and a torus rim, standard metal; the beam is a `basic`,
  translucent, depth-test-off cone.
- **Data:** a new pure `departuresIn(model, index)` returns the ids that left, with their
  previous ring, so their positions come from the earlier edition.
  - `changesIn` keeps its wording but is built on the same helper.
- **Motion:** while the timeline plays, a ghost of the departed blip rises up the beam,
  driven by `playClock / playStep`, so it is deterministic and frame-stepped like playback.
  - When the timeline is scrubbed or paused, the ghost waits at the bottom of the beam.
  - Under reduced motion there is no ascent.
- **Readout:** hovering the saucer says "Strangler Fig: <name> was replaced, bit by bit,
  and left the radar".
- **Fixture:** add one departure to an illustrative edition (an entry present in the second
  edition and absent from the third), so the egg can be seen in the demo.
  - The decoder already validates `absent` ids.

## 2. The Monolith — monolith vs microservices (universe view)

In the universe view, a black slab hangs just beyond the Caution shell, inside the frame,
in proportion 1 : 4 : 9 (the film's ratio).

- **Click it:** it shatters into 24 small cubes (`instances`) that ease out to a loose orbit
  and slowly turn round it as **microservices**.
- **Click again:** they ease back into the slab.
- **Readout on hover:**
  - whole: "A monolith. Click to decompose."
  - shattered: "Microservices. Click to put the distributed monolith back together."
- **Model:** `monolith: 'whole' | 'shattered'` and one new Message, `ClickedMonolith`, routed
  from `clickedAt` by key (like category labels).
- **When it shows:** only when `isBirdsEye(camera)` (or when summoned, see 3), so the side
  view stays clean.
- **Motion:** the orbit spins only while shattered and shown; under reduced motion the cubes
  sit still.

## 3. Search eggs — magic words

A word typed into search that names an egg summons it. These words match no entries, so the
radar is not filtered: they are passed over by `filtersOf`, and the radar stays full behind
the egg.

| Word            | Effect                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------- |
| `monolith`      | The Monolith appears from any view, whole.                                                  |
| `microservices` | The Monolith appears already shattered.                                                     |
| `42`            | The readout: "Deep Thought has computed the answer. The question is still being worked on." |
| `cobol`         | A Voyager-style probe drifts slowly across the far sky: still running, very far away.       |

- **Matching:** a pure `summoned(query)` returns an `Option` of the egg. It is
  case-insensitive and trimmed, and matches whole words only.
- `kafka` (a comet of messages along the "Builds on" edges) is left for a later batch; it
  needs its own frame loop.

## Tests (bun:test, pure)

- **Departures:**
  - `departuresIn` lists exactly the entries absent now but present before, and none for the
    first edition.
  - `changesIn` still reads as it does today.
- **Saucer:**
  - The scene has a saucer node only in an edition with a departure, positioned above the
    departed entry's previous blip.
  - The ghost's height grows with `playClock` and is fixed under reduced motion.
- **Monolith:**
  - Present only from above, or when summoned.
  - `ClickedMonolith` toggles `whole` and `shattered`.
  - All 24 cubes sit outside the outer shell, inside the universe view's frame, and clear of
    every blip.
- **Search:**
  - `summoned` maps each word, ignores case and spaces, and rejects partial matches
    (`monoliths`).
  - Magic words leave `visibleOf` unchanged.
- **Sanity:**
  - No egg node key starts with `blip:` or `label:`, so placement and hover never see them.
  - `needsFrame` is false with no egg animating.

## Delivery

- Branch `feat/radar-easter-eggs`, one commit per egg (abduction, monolith, search words),
  one PR.
- Verified with the full test suite, typecheck, `bun run check` and a Chromium pass at
  desktop and 375px, including reduced motion.
- Commit locally; push and open the PR only when asked.

## Later (not in this batch)

- CAP moons
- Constellations visible from one angle (hexagonal architecture, C4, layers)
- Conway's Law invaders on the Konami code
- Fallacies of distributed computing in the saucer's readout
- The `kafka` comet
