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
const Standard = Schema.TaggedStruct('Standard', {
  color: Colour,
  roughness: Unit,
  metalness: Unit,
});

const Children = Schema.Array(Schema.suspend((): Schema.Codec<SceneNode> => Node)).check(
  Schema.isMaxLength(4),
);

const Node: Schema.Codec<SceneNode> = Schema.Union([
  Schema.TaggedStruct('Group', {
    key: Key,
    position: Vec3,
    rotation: Rotation,
    scale: Vec3,
    children: Children,
  }),
  Schema.TaggedStruct('Mesh', {
    key: Key,
    position: Vec3,
    rotation: Rotation,
    scale: Vec3,
    geometry: Schema.Union([
      Box,
      Schema.TaggedStruct('SharedGeometry', { id: Schema.Literals(['g1', 'g2']) }),
    ]),
    material: Schema.Union([
      Standard,
      Schema.TaggedStruct('SharedMaterial', { id: Schema.Literals(['m1', 'm2']) }),
    ]),
    interactive: Schema.Boolean,
  }),
  Schema.TaggedStruct('AmbientLight', { key: Key, color: Colour, intensity: Size }),
  Schema.TaggedStruct('DirectionalLight', {
    key: Key,
    color: Colour,
    intensity: Size,
    position: Vec3,
  }),
]);

const sceneFields = {
  camera: Schema.Struct({
    fov: Schema.Literals([45, 60]),
    near: Schema.Literals([0.1]),
    far: Schema.Literals([100]),
    position: Vec3,
    lookAt: Vec3,
  }),
  resources: Schema.Struct({
    geometries: Schema.Tuple([
      Schema.Struct({ id: Schema.Literals(['g1']), geometry: Box }),
      Schema.Struct({ id: Schema.Literals(['g2']), geometry: Box }),
    ]),
    materials: Schema.Tuple([
      Schema.Struct({ id: Schema.Literals(['m1']), material: Standard }),
      Schema.Struct({ id: Schema.Literals(['m2']), material: Standard }),
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
