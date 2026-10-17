# @opsydyn/effect-three-rapier

Rapier physics for `@opsydyn/effect-three`. Bodies are described on meshes, groups, loaded
models and instances, and joints in `physics({ joints })`; this package is the engine that
simulates them ([ADR-007](../../docs/effect-three/adr/007-physics-as-a-pose-source.md)).

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
