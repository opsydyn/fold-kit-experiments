/**
 * Bounded generators for scene descriptions. Small value domains make equal values,
 * key collisions, kind changes and moves common, which is what the diff must handle.
 */
import { Arbitrary, Schema } from 'effect';

import type { SceneDescription, SceneNode } from '../src/kernel/index.ts';
import { type Edit, evolve } from './support/edits.ts';
import { withUniqueKeys } from './support/scenes.ts';

const Small = Schema.Int.check(Schema.isBetween({ minimum: -3, maximum: 3 }));
const Size = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 3 }));
const Vec3 = Schema.Tuple([Small, Small, Small]);
const Key = Schema.String.check(Schema.isPattern(/^[a-h]$/));
const Colour = Schema.Literals([0xff0000, 0x00ff00, 0x0000ff]);
const Unit = Schema.Literals([0, 0.5, 1]);

const Rotation = Schema.Union([
  Schema.TaggedStruct('Fixed', { euler: Vec3 }),
  Schema.TaggedStruct('Spin', {
    axis: Schema.Literals(['x', 'y', 'z']),
    radiansPerSecond: Small,
    phase: Small,
  }),
]);

const Box = Schema.TaggedStruct('Box', { width: Size, height: Size, depth: Size });
const Segments = Schema.Literals([3, 8]);
const Shape = Schema.Union([
  Box,
  Schema.TaggedStruct('Sphere', {
    radius: Size,
    widthSegments: Segments,
    heightSegments: Segments,
  }),
  Schema.TaggedStruct('Plane', { width: Size, height: Size }),
  Schema.TaggedStruct('Cylinder', {
    radiusTop: Schema.Literals([0, 1]),
    radiusBottom: Size,
    height: Size,
    radialSegments: Segments,
  }),
  Schema.TaggedStruct('Torus', {
    radius: Size,
    tube: Schema.Literals([0.25, 0.5]),
    radialSegments: Segments,
    tubularSegments: Segments,
  }),
  Schema.TaggedStruct('Cone', { radius: Size, height: Size, radialSegments: Segments }),
  Schema.TaggedStruct('Capsule', {
    radius: Size,
    height: Size,
    capSegments: Schema.Literals([1, 4]),
    radialSegments: Segments,
  }),
  Schema.TaggedStruct('Ring', {
    innerRadius: Schema.Literals([0, 0.5]),
    outerRadius: Size,
    thetaSegments: Segments,
  }),
  Schema.TaggedStruct('Circle', { radius: Size, segments: Segments }),
  // Never lent a font, so empty: the diff, equality and resource balance still apply.
  Schema.TaggedStruct('Text', {
    text: Schema.Literals(['a', 'bc']),
    font: Schema.Literals(['f1']),
    size: Size,
    depth: Schema.Literals([0, 0.2]),
    curveSegments: Schema.Literals([4]),
    bevel: Schema.Null,
    center: Schema.Boolean,
  }),
]);
const Behaviour = Schema.NullOr(
  Schema.Struct({
    name: Schema.Literals(['float']),
    params: Schema.Record(Schema.String, Schema.Literals([0.5, 2])),
  }),
);
const Transition = Schema.Union([
  Schema.TaggedStruct('Instant', {}),
  Schema.TaggedStruct('Ease', {
    seconds: Schema.Literals([0.25, 1]),
    easing: Schema.Literals(['linear', 'easeInOutCubic', 'easeOutCubic', 'easeOutBack']),
  }),
]);
const surface = {
  opacity: Unit,
  transparent: Schema.Boolean,
  side: Schema.Literals(['front', 'back', 'double']),
  wireframe: Schema.Boolean,
};
const shaded = { ...surface, flatShading: Schema.Boolean };
const Map = Schema.NullOr(Schema.Literals(['tex-a', 'tex-b']));
const pbr = {
  color: Colour,
  map: Map,
  roughness: Unit,
  metalness: Unit,
  emissive: Colour,
  emissiveIntensity: Unit,
};

/** Every material kind, with small domains so equal values and kind changes are common. */
const Surface = Schema.Union([
  Schema.TaggedStruct('Basic', { color: Colour, map: Map, ...surface }),
  Schema.TaggedStruct('Lambert', { color: Colour, map: Map, emissive: Colour, ...shaded }),
  Schema.TaggedStruct('Phong', {
    color: Colour,
    map: Map,
    emissive: Colour,
    specular: Colour,
    shininess: Schema.Literals([10, 30]),
    ...shaded,
  }),
  Schema.TaggedStruct('Standard', { ...pbr, ...shaded }),
  Schema.TaggedStruct('Physical', {
    ...pbr,
    clearcoat: Unit,
    clearcoatRoughness: Unit,
    transmission: Unit,
    ior: Schema.Literals([1, 1.5]),
    ...shaded,
  }),
  Schema.TaggedStruct('Normal', shaded),
  Schema.TaggedStruct('Shadow', { color: Colour, opacity: Unit }),
]);

const Children = Schema.Array(Schema.suspend((): Schema.Codec<SceneNode> => Node)).check(
  Schema.isMaxLength(4),
);

const Node: Schema.Codec<SceneNode> = Schema.Union([
  Schema.TaggedStruct('Group', {
    key: Key,
    position: Vec3,
    rotation: Rotation,
    scale: Vec3,
    transition: Transition,
    behaviour: Behaviour,
    interactive: Schema.Boolean,
    children: Children,
    body: Schema.Null,
  }),
  Schema.TaggedStruct('Mesh', {
    key: Key,
    position: Vec3,
    rotation: Rotation,
    scale: Vec3,
    transition: Transition,
    behaviour: Behaviour,
    geometry: Schema.Union([
      ...Shape.members,
      Schema.TaggedStruct('SharedGeometry', { id: Schema.Literals(['g1', 'g2']) }),
    ]),
    material: Schema.Union([
      ...Surface.members,
      Schema.TaggedStruct('SharedMaterial', { id: Schema.Literals(['m1', 'm2']) }),
    ]),
    interactive: Schema.Boolean,
    castShadow: Schema.Boolean,
    receiveShadow: Schema.Boolean,
    body: Schema.NullOr(
      Schema.Struct({
        type: Schema.Literals(['dynamic', 'fixed', 'kinematic']),
        collider: Schema.Literals(['cuboid', 'ball']),
        mass: Schema.NullOr(Schema.Literals([2])),
        friction: Schema.Literals([0.5]),
        restitution: Schema.Literals([0, 0.5]),
        linearDamping: Schema.Literals([0]),
        angularDamping: Schema.Literals([0]),
        gravityScale: Schema.Literals([1]),
        ccd: Schema.Boolean,
        sensor: Schema.Boolean,
        linearVelocity: Vec3,
        angularVelocity: Vec3,
        impulse: Schema.NullOr(Schema.Struct({ id: Schema.Literals([1, 2]), impulse: Vec3 })),
      }),
    ),
  }),
  Schema.TaggedStruct('Instances', {
    key: Key,
    position: Vec3,
    rotation: Rotation,
    scale: Vec3,
    transition: Transition,
    behaviour: Behaviour,
    geometry: Schema.Union([
      ...Shape.members,
      Schema.TaggedStruct('SharedGeometry', { id: Schema.Literals(['g1', 'g2']) }),
    ]),
    material: Schema.Union([
      ...Surface.members,
      Schema.TaggedStruct('SharedMaterial', { id: Schema.Literals(['m1', 'm2']) }),
    ]),
    interactive: Schema.Boolean,
    castShadow: Schema.Boolean,
    receiveShadow: Schema.Boolean,
    // Up to 20 instances, so lists cross the 16-slot starting capacity and must grow.
    instances: Schema.Array(
      Schema.Struct({
        key: Schema.String.check(Schema.isPattern(/^i[0-9]{1,2}$/)),
        position: Vec3,
        rotation: Vec3,
        scale: Vec3,
        color: Colour,
      }),
    ).check(Schema.isMaxLength(20)),
  }),
  Schema.TaggedStruct('Borrowed', {
    key: Key,
    id: Schema.Literals(['model-a', 'model-b']),
    animation: Schema.NullOr(
      Schema.Struct({
        clip: Schema.Literals(['wave', 'roll']),
        speed: Schema.Literals([1, -0.5]),
        loop: Schema.Boolean,
      }),
    ),
    position: Vec3,
    rotation: Rotation,
    scale: Vec3,
    transition: Transition,
    behaviour: Behaviour,
    body: Schema.Null,
    interactive: Schema.Boolean,
  }),
  Schema.TaggedStruct('AmbientLight', { key: Key, color: Colour, intensity: Size }),
  Schema.TaggedStruct('PointLight', {
    key: Key,
    color: Colour,
    intensity: Size,
    position: Vec3,
    distance: Schema.Literals([0, 10]),
    decay: Schema.Literals([1, 2]),

    castShadow: Schema.Boolean,
    shadowMapSize: Schema.Literals([256, 512]),
    shadowBias: Schema.Literals([0, -0.001]),
  }),
  Schema.TaggedStruct('SpotLight', {
    key: Key,
    color: Colour,
    intensity: Size,
    position: Vec3,
    target: Vec3,
    distance: Schema.Literals([0, 10]),
    angle: Schema.Literals([0.5, 1]),
    penumbra: Unit,
    decay: Schema.Literals([1, 2]),

    castShadow: Schema.Boolean,
    shadowMapSize: Schema.Literals([256, 512]),
    shadowBias: Schema.Literals([0, -0.001]),
  }),
  Schema.TaggedStruct('Grid', {
    key: Key,
    position: Vec3,
    size: Schema.Literals([4, 10]),
    divisions: Schema.Literals([2, 10]),
    color: Colour,
    centerColor: Colour,
  }),
  Schema.TaggedStruct('HemisphereLight', {
    key: Key,
    color: Colour,
    groundColor: Colour,
    intensity: Size,
    position: Vec3,
  }),
  Schema.TaggedStruct('DirectionalLight', {
    key: Key,
    color: Colour,
    intensity: Size,
    position: Vec3,

    castShadow: Schema.Boolean,
    shadowMapSize: Schema.Literals([256, 512]),
    shadowBias: Schema.Literals([0, -0.001]),
    shadowArea: Schema.Literals([5, 10]),
  }),
]);

const sceneFields = {
  gestures: Schema.Literals(['page', 'scene']),
  measure: Schema.Array(Schema.String).check(Schema.isMaxLength(0)),
  xr: Schema.NullOr(
    Schema.Struct({
      origin: Vec3,
      heading: Schema.Literals([0, 1]),
      referenceSpace: Schema.Literals(['local-floor', 'local']),
      framebufferScale: Schema.Literals([1]),
    }),
  ),
  physics: Schema.NullOr(
    Schema.Struct({
      gravity: Schema.Tuple([Schema.Literals([0]), Schema.Literals([-9.81]), Schema.Literals([0])]),
      paused: Schema.Boolean,
      timeStep: Schema.Literals([1 / 60]),
      interpolate: Schema.Boolean,
    }),
  ),
  contactShadows: Schema.NullOr(
    Schema.Struct({
      position: Vec3,
      size: Schema.Tuple([Schema.Literals([4, 10]), Schema.Literals([10])]),
      near: Schema.Literals([-0.01, 0]),
      far: Schema.Literals([10]),
      blur: Schema.Literals([0, 1]),
      smooth: Schema.Boolean,
      opacity: Schema.Literals([0.5, 1]),
      color: Colour,
      resolution: Schema.Literals([64]),
    }),
  ),
  sky: Schema.NullOr(
    Schema.Struct({
      sunPosition: Vec3,
      turbidity: Schema.Literals([2, 10]),
      rayleigh: Schema.Literals([0.5]),
      mieCoefficient: Schema.Literals([0.005]),
      mieDirectionalG: Schema.Literals([0.8]),
      clouds: Schema.Literals([0, 0.4]),
      distance: Schema.Literals([1000]),
    }),
  ),
  environment: Schema.NullOr(
    Schema.Struct({
      map: Schema.NullOr(Schema.Literals(['env'])),
      background: Schema.Union([Schema.Boolean, Schema.Literal('only')]),
      backgroundBlurriness: Schema.Literals([0, 0.5]),
      backgroundIntensity: Schema.Literals([1]),
      environmentIntensity: Schema.Literals([0.5, 1]),
    }),
  ),
  overlays: Schema.Array(
    Schema.Struct({
      key: Schema.Literals(['o1', 'o2']),
      node: Schema.Null,
      position: Vec3,
      center: Schema.Boolean,
      distanceFactor: Schema.NullOr(Schema.Literals([10])),
      occlude: Schema.Boolean,
      zIndexRange: Schema.Tuple([Schema.Literals([100]), Schema.Literals([0])]),
      view: Schema.Null,
    }),
  ).check(Schema.isMaxLength(2)),
  renderTextures: Schema.Array(
    Schema.Struct({
      id: Schema.Literals(['rt-a', 'rt-b']),
      width: Schema.Literals([64, 128]),
      height: Schema.Literals([64]),
      camera: Schema.TaggedStruct('Perspective', {
        fov: Schema.Literals([50]),
        near: Schema.Literals([0.1]),
        far: Schema.Literals([100]),
        position: Vec3,
        lookAt: Vec3,
        damping: Schema.Literals([0, 0.1]),
      }),
      background: Schema.NullOr(Colour),
      children: Schema.Array(Node).check(Schema.isMaxLength(3)),
    }),
  ).check(Schema.isMaxLength(2)),
  views: Schema.Array(
    Schema.Struct({
      key: Schema.Literals(['left', 'right']),
      camera: Schema.TaggedStruct('Perspective', {
        fov: Schema.Literals([45]),
        near: Schema.Literals([0.1]),
        far: Schema.Literals([100]),
        position: Vec3,
        lookAt: Vec3,
        damping: Schema.Literals([0]),
      }),
      rect: Schema.Struct({
        x: Schema.Literals([0, 0.5]),
        y: Schema.Literals([0]),
        width: Schema.Literals([0.5]),
        height: Schema.Literals([1]),
      }),
    }),
  ).check(Schema.isMaxLength(2)),
  render: Schema.Struct({
    effects: Schema.Array(
      Schema.Union([
        Schema.TaggedStruct('Bloom', {
          strength: Schema.Literals([1, 2]),
          radius: Schema.Literals([0.4]),
          threshold: Schema.Literals([0.85]),
        }),
        Schema.TaggedStruct('Vignette', {
          offset: Schema.Literals([1]),
          darkness: Schema.Literals([1]),
        }),
        Schema.TaggedStruct('Film', {
          intensity: Schema.Literals([0.5]),
          grayscale: Schema.Boolean,
        }),
      ]),
    ).check(Schema.isMaxLength(2)),
    frames: Schema.Literals(['always', 'demand', 'never']),
    resolution: Schema.Literals([0.5, 1]),
    shadows: Schema.Literals(['off', 'soft']),
    toneMapping: Schema.Literals(['none', 'aces']),
    exposure: Schema.Literals([1, 2]),
    colorSpace: Schema.Literals(['srgb', 'linear']),
  }),
  camera: Schema.Union([
    Schema.TaggedStruct('Perspective', {
      fov: Schema.Literals([45, 60]),
      near: Schema.Literals([0.1]),
      far: Schema.Literals([100]),
      position: Vec3,
      lookAt: Vec3,
      damping: Schema.Literals([0, 0.1]),
    }),
    Schema.TaggedStruct('Orthographic', {
      zoom: Schema.Literals([1, 50]),
      near: Schema.Literals([0.1]),
      far: Schema.Literals([100]),
      position: Vec3,
      lookAt: Vec3,
      damping: Schema.Literals([0, 0.1]),
    }),
  ]),
  resources: Schema.Struct({
    geometries: Schema.Tuple([
      Schema.Struct({ id: Schema.Literals(['g1']), geometry: Shape }),
      Schema.Struct({ id: Schema.Literals(['g2']), geometry: Shape }),
    ]),
    materials: Schema.Tuple([
      Schema.Struct({ id: Schema.Literals(['m1']), material: Surface }),
      Schema.Struct({ id: Schema.Literals(['m2']), material: Surface }),
    ]),
  }),
  children: Schema.Array(Node).check(Schema.isMaxLength(6)),
};

const Scene = Schema.Struct(sceneFields);

// Constructive, not a filter: at size 0 every array is empty, so filtering for a
// non-empty scene discards every candidate and the check exhausts.
const NonEmptyScene = Schema.Struct({
  ...sceneFields,
  children: Schema.Array(Node).check(Schema.isMinLength(1), Schema.isMaxLength(6)),
});

/** A valid scene: unique keys and only defined shared ids. */
export const scene: Arbitrary.Arbitrary<SceneDescription> = Arbitrary.schema(Scene).pipe(
  Arbitrary.map(withUniqueKeys),
);

const Index = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 63 }));

const EditSchema: Schema.Codec<Edit> = Schema.Union([
  Schema.TaggedStruct('Perturb', { target: Index }),
  Schema.TaggedStruct('Remove', { target: Index }),
  Schema.TaggedStruct('Move', { target: Index, destination: Index }),
  Schema.TaggedStruct('Reverse', { destination: Index }),
  Schema.TaggedStruct('Insert', { node: Node, destination: Index }),
  Schema.TaggedStruct('ChangeKind', { target: Index, node: Node }),
]);

const edits = Arbitrary.array(Arbitrary.schema(EditSchema), { minLength: 1, maxLength: 12 });

/** Unrelated scenes in a row: exercises wholesale replacement. */
const independentSequence = Arbitrary.array(scene, { minLength: 1, maxLength: 6 });

/** A scene evolved by small edits: exercises identity, moves, reorders and updates. */
const evolvedSequence = Arbitrary.all([scene, edits]).pipe(
  Arbitrary.map(([start, steps]) => evolve(start, steps)),
);

/** A valid scene with at least one node. */
export const nonEmptyScene: Arbitrary.Arbitrary<SceneDescription> = Arbitrary.schema(
  NonEmptyScene,
).pipe(Arbitrary.map(withUniqueKeys));

/** A sequence of scenes to reconcile one after another. */
export const sceneSequence = Arbitrary.all([independentSequence, evolvedSequence]).pipe(
  Arbitrary.map(([independent, evolved]) => [...independent, ...evolved]),
);

/** Two independent scenes. */
export const scenePair = Arbitrary.all([scene, scene]);

const Rate = Schema.Finite.check(Schema.isBetween({ minimum: -10, maximum: 10 }));
const Seconds = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 3600 }));
const SpinParameters = Schema.Struct({
  axis: Schema.Literals(['x', 'y', 'z']),
  radiansPerSecond: Rate,
  phase: Rate,
});
const frameTimes = Arbitrary.array(Arbitrary.schema(Seconds), { minLength: 1, maxLength: 50 });

/** A spin behaviour and a series of frame times (unsorted). */
export const spinAndTimes = Arbitrary.all([Arbitrary.schema(SpinParameters), frameTimes]);

const Easing = Schema.Literals(['linear', 'easeInOutCubic', 'easeOutCubic', 'easeOutBack']);
const TweenTime = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 2 }));
const tweenTimes = Arbitrary.array(Arbitrary.schema(TweenTime), { minLength: 1, maxLength: 30 });

/** An easing and a series of frame times (unsorted) around a one-second tween. */
export const easingAndTimes = Arbitrary.all([Arbitrary.schema(Easing), tweenTimes]);
