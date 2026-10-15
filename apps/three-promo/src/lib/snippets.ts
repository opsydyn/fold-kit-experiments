/** Code shown on the landing page and in the docs. */

export const teaser = `const sceneFor = (model: Model) =>
  scene({
    children: [
      mesh({
        key: 'cube',
        geometry: box(),
        material: standard({ color: model.colour }),
        rotation: spin({ axis: 'y', radiansPerSecond: 1 }),
        interactive: true,
      }),
    ],
  });`;

export const transitions = `const cubeNode = (model: Model, cube: Cube, index: number) =>
  mesh({
    key: cube.key,
    position: [index * 1.1, 0, 0], // the Model owns the target
    scale: hovered(model, cube) ? [1.12, 1.12, 1.12] : [1, 1, 1],
    transition: ease({ seconds: 0.35 }), // the scene shows the journey
    geometry: sharedGeometry('cube'),
    material: sharedMaterial(cube.paint),
  });`;

export const installation =
  'bun add @opsydyn/effect-three @opsydyn/effect-three-foldkit three effect foldkit';

export const entry = `// entry.ts: once per application
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';

export const environment = EffectThreeFoldkit.makeEnvironment(window);
export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);`;

export const view = `// view.ts
EffectThreeFoldkit.view(
  {
    scene: sceneFor(model),
    mount: sceneMount,
    className: 'stage', // the element needs a size
    onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
    onClick: ({ key }) => Message.ClickedCube({ key }),
  },
  h,
);`;

export const sharing = `scene({
  resources: {
    geometries: [{ id: 'cube', geometry: box() }],
    materials: [{ id: 'paint', material: standard({ color: 0x3d79fa }) }],
  },
  children: [
    mesh({ key: 'a', geometry: sharedGeometry('cube'), material: sharedMaterial('paint') }),
    mesh({ key: 'b', geometry: sharedGeometry('cube'), material: sharedMaterial('paint') }),
  ],
});`;

export const runtime = `import { Effect, Layer } from 'effect';
import { FrameSource, ResourceRegistry, SceneRuntime } from '@opsydyn/effect-three';

const program = Effect.gen(function* () {
  const handle = yield* SceneRuntime.make({ scene, renderer, viewport });
  const ops = yield* handle.update(nextScene); // [] when nothing changed
  handle.pointer({ _tag: 'PointerDown', x: 0, y: 0, button: 0 });
}).pipe(Effect.scoped); // closing the scope releases everything

const environment = Layer.mergeAll(ResourceRegistry.layer, FrameSource.layer(scheduler));`;

export const testing = `const frames = createManualFrames();
const renderers = recordingRendererFactory();

const handle = yield* SceneRuntime.make({ scene, renderer: renderers, viewport });
yield* advanceFrames(frames, 500, 20); // TestClock.adjust + frames.step()

expect(renderers.created()[0]?.renders()).toBe(500);
expect(handle.graph.object('cube')?.rotation.y).toBeCloseTo(10);
expect(yield* handle.drainEvents).toEqual([]); // animation never reaches update`;
