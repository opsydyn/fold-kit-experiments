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

export const installation = `npm install @opsydyn/effect-three @opsydyn/effect-three-foldkit three effect foldkit
# when a scene needs physics or labels
npm install @opsydyn/effect-three-rapier @opsydyn/effect-three-troika`;

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

export const previewSnippet = `// In a build, a server or a test: no browser, no GPU.
const result = previewSvg(sceneFor(model), { width: 640, height: 400, at: 0 });
if (result._tag === 'Preview') await Bun.write('preview.svg', result.svg);

// Or from a saved scene file:
// bun run scene:preview scene.json preview.svg --background f4f1ea`;

export const autoRotate = `// The camera turns by itself until a gesture; keep where it got to first.
camera: perspectiveCamera({ position: [3, 4, 12], damping: 0.08, autoRotate: 0.25 }),

AutoRotated: ({ turned }) => ({
  model: { ...model, camera: autoRotated(model.camera, turned) },
}),
MadeGesture: ({ gesture }) => ({
  model: { ...model, camera: orbit(model.camera, gesture) },
}),`;

export const physicsSnippet = `physics: physics({
  joints: [
    joint({
      key: 'wheel:hinge',
      a: 'axle',
      b: 'wheel',
      // The motor's speed is a number in the Model.
      kind: revoluteJoint({ axis: [0, 0, 1], motor: velocityMotor(model.wheelSpeed, 40) }),
    }),
  ],
}),

// Only teal marbles (group 2) meet the grate; gold ones fall through it.
body({ type: 'fixed', collisionGroups: interactionGroups(3, 2) }),

// Named sensor colliders: a collision says which bin a marble entered.
body({
  type: 'fixed',
  sensor: true,
  colliders: [cuboidCollider({ name: 'gold-bin', halfExtents: [1.4, 0.5, 0.3] })],
}),

// The wheel reports pushes harder than 16 N as contact forces.
body({ mass: 3, contactForces: 16 }),`;

export const labelSnippet = `label({
  key: 'code:text',
  text: code,
  font: '/fonts/inter.woff',
  fontSize: 0.18,
  colorRanges: [colorRange(0, 0xe6e3dc), colorRange(6, 0x5b9bff)],
  curveRadius: 0,
  material: model.lit ? standard({ roughness: 0.55 }) : null,
}),

// scene({ measure: ['code:text'] }) reports the laid-out size:
onLabelMeasured: (measured) => Message.MeasuredLabel({ measured }),`;

export const xrSnippet = `scene({
  xr: xr({ glide: glide(), hitTest: true, planes: true, meshes: true,
    anchors: plants.map((plant) => xrAnchor({ id: plant.id, position: plant.at })) }),
  children: [
    // Rides the left hand, without a Message per frame.
    group({ key: 'tips', follow: jointSpace('left', 'wrist'), children: [tips] }),
    // Stays where it was put as the session learns the room.
    ...plants.map((plant) =>
      group({ key: plant.id, follow: anchorSpace(plant.id), children: [pot] })),
    // A detected mesh, drawn with the geometry the session lends.
    ...model.meshes.map(({ id }) =>
      group({ key: id, follow: meshSpace(id),
        children: [mesh({ key: \`\${id}:shape\`, geometry: xrMesh(id), material })] })),
  ],
});`;

export const agentSnippet = `// main.ts: hand DevTools the Message schema, and in development an agent can send
// Messages through the Foldkit DevTools MCP server, decoded like any other.
export const devTools = { Message, excludeFromHistory: ['MadeGesture'] };

// message.ts: what an agent (or a script, or a test) sends to arrange the room.
PlacedPlant: { at: Vec3, kind: PlantKind },  // PlantKind: 'fern' | 'cactus' | 'tulip'

// An agent's tool call; a kind the schema does not know is rejected before update.
foldkit_dispatch_messages({ messages: [
  { _tag: 'ClickedClear' },
  { _tag: 'PlacedPlant', at: [1.2, 0, 0.4], kind: 'tulip' },
] })`;

export const lending = `// Application-owned assets, shown but never disposed by the scene.
store.lend('car', gltf.scene);            // borrowed({ key: 'car', id: 'car' })
store.lendTexture('bricks', texture);     // standard({ map: 'bricks' })
store.lendGeometry('terrain', geometry);  // mesh({ geometry: lentGeometry('terrain') })`;

export const renderers = `import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
// Draws labels with either renderer: node materials (TSL) under WebGPU.
import { troikaLabels } from '@opsydyn/effect-three-troika/webgpu';

// WebGPU where the browser has it, its WebGL 2 backend otherwise.
const environment = EffectThreeFoldkit.makeEnvironment(window, {
  renderer: EffectThreeFoldkit.webgpuRendererFactory, // one per canvas
  labels: troikaLabels(),
});`;
