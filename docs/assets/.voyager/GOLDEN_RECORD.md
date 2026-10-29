# The golden record

> Launched from `apps/tech-radar`. Still running, very far away.

You found it. The Voyager probes each carry a golden record, a message for whoever finds
them out in the dark. This is the radar's: the log of every Easter egg it hides, so they
outlive whoever hid them.

The trail that leads here is an egg too:

1. Search the radar for **42**. Deep Thought answers, and tells you to ask the probe that
   is still running.
2. Search for **cobol**. A small probe circles the far sky. Hover it: it says its golden
   record is kept with the assets.
3. `docs/assets/`, in a folder a plain listing does not show.

Every egg below is a real architecture idea in disguise. They live in the tech radar's own
copy of the 3D radar, `apps/tech-radar/src/radar/three/`; the effect-three sample it was
copied from keeps its own. Each one is pure, read from the Model, drawn after the radar's
own scene, and holds still under reduced motion.

## Magic words

Type one into the radar's search, alone. Case and spaces don't matter; near misses do.

| Word            | What happens                                                                                                                  | The idea                                                                       | Where       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------- |
| `monolith`      | A black slab floats beside the radar. Click it and it breaks into blocks.                                                     | Monolith versus microservices                                                  | `easter.ts` |
| `microservices` | The same slab, already in pieces. Click to put the distributed monolith back together.                                        | The distributed monolith                                                       | `easter.ts` |
| `42`            | Deep Thought answers in the readout.                                                                                          | The answer is not the question; the first clue                                 | `summon.ts` |
| `cobol`         | A Voyager-style probe circles the far sky, dish turned home.                                                                  | Legacy that is still running, very far away; the second clue                   | `easter.ts` |
| `kafka`         | A comet of messages rides every _Builds on_ edge in turn.                                                                     | One append-only log, replayed                                                  | `comet.ts`  |
| `astro`         | A rocket crosses the sky. In its wake one blip in three lights up as an island; the rest stay still.                          | Islands: ship HTML, hydrate only what moves                                    | `stack.ts`  |
| `foldkit`       | Space folds: shells and blips swirl into one bright point, then unfold through every edition in turn.                         | An update folds every Message into one Model, and here the fold runs over time | `stack.ts`  |
| `effect`        | A fiber forks from Effect to each category. Platforms fails with a typed error, is retried after 500 ms, then 1 s, and joins. | Fibers, typed errors, retries on an exponential Schedule                       | `stack.ts`  |

`foldkit` and `effect` name real entries, so they still find them while their eggs play.
The others filter nothing: the radar stays full behind the egg.

## Things to find without typing

| Trigger                                                               | What happens                                                                                              | The idea                                                        | Where               |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------- |
| The Konami code (↑ ↑ ↓ ↓ ← → ← → B A)                                 | Four ranks of pixel aliens march across the sky, one per category, in its colour.                         | Conway's Law: four teams, four ranks                            | `invaders.ts`       |
| Look straight down on the radar (the universe view, or tilt past 55°) | The Monolith comes out on its own, from above, where the radar reads as a map.                            |                                                                 | `easter.ts`         |
| Play the timeline past an edition that dropped an entry               | A saucer hovers where it was and beams a ghost of it away. Each visit to a saucer reads the next fallacy. | The Strangler Fig; the eight fallacies of distributed computing | `easter.ts`         |
| Fly close to Local-first sync                                         | Three extra moons: Consistency, Availability, Partition tolerance. From any bearing one is gone.          | CAP: pick two                                                   | `capMoons.ts`       |
| Turn to bearing 150°, elevation 20° (five presses of Turn from home)  | Scattered stars line up into two nested hexagons.                                                         | Hexagonal architecture, ports and adapters                      | `constellations.ts` |
| Turn to bearing −110°, elevation 40°                                  | Stars line up in three stacked bands.                                                                     | Layered architecture                                            | `constellations.ts` |
| Turn to bearing 30°, elevation −30°                                   | Stars line up as four nested boxes.                                                                       | The C4 model                                                    | `constellations.ts` |
| The theme picker                                                      | Paragon and Renegade: two deep-space themes after a dying star seen from orbit.                           | Hidden in plain sight                                           | `themes.ts`         |

## Adding an egg

- Make it a real idea, not only a joke. The readout says which.
- Keep it pure: a trigger read from the Model, scene nodes appended after the radar's own,
  keys starting `egg:`. If it moves, drive it from a clock in the Model, advanced by an
  animation-frame subscription that runs only while the egg is out.
- Hold it still under reduced motion.
- Never take a word that names an entry away from the search.
- Write it down here. Then leave the trail as you found it.
