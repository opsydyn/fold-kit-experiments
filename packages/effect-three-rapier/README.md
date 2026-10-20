# @opsydyn/effect-three-rapier

Rapier physics for `@opsydyn/effect-three`. Bodies are described on meshes, groups, loaded
models and instances (with colliders from their geometry or their own), and joints (with
motors) in `physics({ joints })`; this package is the engine that simulates them, reports
collisions and contact forces, and draws its debug lines ([ADR-007](../../docs/effect-three/adr/007-physics-as-a-pose-source.md)).

```sh
npm install @opsydyn/effect-three-rapier @opsydyn/effect-three three
```

Released with the core at one version: see its [Stability](../effect-three/README.md#stability)
and [Limits](../effect-three/README.md#limits).

```ts
import { body, box, mesh, physics, scene, standard } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { loadRapier } from '@opsydyn/effect-three-rapier';

const environment = EffectThreeFoldkit.makeEnvironment(window, { physics: loadRapier() });

scene({
  physics: physics(),
  children: [
    mesh({
      key: 'floor',
      geometry: box({ width: 10, height: 1, depth: 10 }),
      material: standard(),
      body: body({ type: 'fixed' }),
    }),
    mesh({
      key: 'crate',
      position: [0, 4, 0],
      geometry: box(),
      material: standard(),
      body: body(),
    }),
  ],
});
```

Rapier (`@dimforge/rapier3d-compat`, Apache-2.0) embeds its WebAssembly, so nothing else is
fetched; load it only on pages that need physics.

## Deterministic

Where peers must get the same world (a lockstep session between machines, a replay shared
as a link), load Rapier's deterministic build instead: the same engine, bit-identical on
every platform for the same inputs at the same steps. Install its build alongside (an
optional peer), and drive the world with `physics({ until })`
([ADR-014](../../docs/effect-three/adr/014-physics-in-lockstep.md)):

```sh
npm install @dimforge/rapier3d-deterministic-compat
```

```ts
import { loadRapier } from '@opsydyn/effect-three-rapier/deterministic';

const environment = EffectThreeFoldkit.makeEnvironment(window, { physics: loadRapier() });
```

The engine is deterministic; what the scene feeds it must agree too. Give every peer the
same bodies in the same order, and prefer colliders sized as data (`ballCollider`,
`cuboidCollider`) to ones measured from curved geometry: browsers may round sines and
cosines differently.

## Snapshots

Worlds take snapshots (`physics({ snapshotAt })` reports one) and start from them
(`physics({ from })`), exactly: a world restored from a snapshot goes on as the one it was
taken from, bit for bit with the deterministic build. A newcomer to a lockstep session can
start from the leader's snapshot instead of replaying the game
([ADR-018](../../docs/effect-three/adr/018-snapshot-welcome.md)). Snapshots work in a
worker too; each build restores its own.

## In a worker

To keep stepping off the page's thread, run Rapier in a worker behind the same engine
contract ([ADR-017](../../docs/effect-three/adr/017-physics-in-a-worker.md)). The worker
serves worlds with either build; the page gets an engine from `remotePhysics`, and does
not load Rapier's WebAssembly itself:

```ts
// physics.worker.ts
import { loadRapier } from '@opsydyn/effect-three-rapier/deterministic';
import { servePhysics } from '@opsydyn/effect-three-rapier/worker';

servePhysics(globalThis, loadRapier());
```

```ts
// the page
import { remotePhysics } from '@opsydyn/effect-three-rapier/worker';

const worker = new Worker(new URL('./physics.worker.ts', import.meta.url), { type: 'module' });
const environment = EffectThreeFoldkit.makeEnvironment(window, { physics: remotePhysics(worker) });
```

What the scene graph asks of a world in a frame goes in one message, and the worker
answers with that frame's collisions and forces and every body's pose. What you see lags
by about a frame. A world on `physics({ until })` is reported as there once the worker has
answered everything it was asked, so its checksum is the one an engine in the page gives,
a frame later; peers in the page and in workers play one session together.
