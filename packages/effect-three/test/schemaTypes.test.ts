/**
 * Compile-time proof that the runtime Schemas decode exactly the kernel's types, so the
 * two can't drift. A mismatch fails `tsc -p tsconfig.test.json`, not this test's runtime.
 */
import { expect, test } from 'bun:test';

import type * as Kernel from '../src/kernel/index.ts';
import { SceneSchema } from '../src/runtime/index.ts';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type Proof = [
  Equals<typeof SceneSchema.Vec3.Type, Kernel.Vec3>,
  Equals<typeof SceneSchema.Rotation.Type, Kernel.Rotation>,
  Equals<typeof SceneSchema.GeometryRef.Type, Kernel.GeometryRef>,
  Equals<typeof SceneSchema.ShapeGeometry.Type, Kernel.ShapeGeometry>,
  Equals<typeof SceneSchema.Transition.Type, Kernel.Transition>,
  Equals<typeof SceneSchema.MaterialRef.Type, Kernel.MaterialRef>,
  Equals<typeof SceneSchema.ResourceDefinitions.Type, Kernel.ResourceDefinitions>,
  Equals<typeof SceneSchema.MeshNode.Type, Kernel.MeshNode>,
  Equals<typeof SceneSchema.PerspectiveCamera.Type, Kernel.PerspectiveCamera>,
  Equals<typeof SceneSchema.OrthographicCamera.Type, Kernel.OrthographicCamera>,
  Equals<typeof SceneSchema.Camera.Type, Kernel.Camera>,
  Equals<typeof SceneSchema.RenderSettings.Type, Kernel.RenderSettings>,
  Equals<typeof SceneSchema.SceneDescription.Type, Kernel.SceneDescription>,
  Equals<typeof SceneSchema.SceneEvent.Type, Kernel.SceneEvent>,
  Equals<typeof SceneSchema.DescriptionError.Type, Kernel.DescriptionError>,
  Equals<typeof SceneSchema.Gizmo.Type, Kernel.Gizmo>,
  Equals<typeof SceneSchema.Placement.Type, Kernel.Placement>,
  Equals<typeof SceneSchema.Pivot.Type, Kernel.Pivot>,
  Equals<typeof SceneSchema.Tape.Type, Kernel.Tape>,
  Equals<typeof SceneSchema.Hud.Type, Kernel.Hud>,
];

const schemasMatchKernel: Proof extends ReadonlyArray<true> ? true : never = true;

test('runtime Schemas decode exactly the kernel types', () => {
  expect(schemasMatchKernel).toBe(true);
});
