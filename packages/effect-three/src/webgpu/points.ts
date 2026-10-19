/**
 * The WebGPU kit's points. WebGPU draws point primitives one pixel across, so sized
 * points are instanced sprites with three's `PointsNodeMaterial`, as three's WebGPU
 * examples draw them: a quad a point, `sizeNode` pixels across. Dots, sparkles and stars
 * port the WebGL kit's shaders (Drei's, `bf6f4ad`) to TSL, from the same kernel buffers:
 * the sprite's `uv` stands in for `gl_PointCoord`.
 *
 * Sparkles drift in the node's own space here (Drei moves them in world space), which
 * is the same unless the node is rotated or scaled.
 *
 * @module
 */
import { AdditiveBlending, Group, InstancedBufferAttribute } from 'three';
import {
  cos,
  distance,
  exp,
  float,
  fwidth,
  instancedBufferAttribute,
  modelWorldMatrix,
  positionView,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { PointsNodeMaterial, Sprite } from 'three/webgpu';

import type { PointLook, PointsNode } from '../kernel/description.ts';
import { type PointBuffers, pointBuffers } from '../kernel/pointBuffers.ts';
import type { HostedPoints } from '../kernel/renderKit.ts';

/** Scene time for sparkles and stars, a uniform the host sets each frame. */
const createTime = () => uniform(0);
type Time = ReturnType<typeof createTime>;

const vec3Attribute = (array: Float32Array) =>
  instancedBufferAttribute<'vec3'>(new InstancedBufferAttribute(array, 3), 'vec3');
const floatAttribute = (array: Float32Array) =>
  instancedBufferAttribute<'float'>(new InstancedBufferAttribute(array, 1), 'float');

type Attributes = {
  readonly position: ReturnType<typeof vec3Attribute>;
  readonly color: ReturnType<typeof vec3Attribute>;
  readonly size: ReturnType<typeof floatAttribute>;
};

const attributes = (buffers: PointBuffers): Attributes => ({
  position: vec3Attribute(buffers.positions),
  color: vec3Attribute(buffers.colors),
  size: floatAttribute(buffers.sizes),
});

/** Where the sprite's fragment is across its point: `gl_PointCoord`. */
const pointCoord = uv();

/** Dots: Drei's `PointMaterial`, round by its mask, a size factor a point. */
const dotsMaterial = (
  look: Extract<PointLook, { readonly _tag: 'Dots' }>,
  given: Attributes,
): PointsNodeMaterial => {
  const material = new PointsNodeMaterial({
    transparent: look.transparent,
    sizeAttenuation: look.sizeAttenuation,
  });
  material.positionNode = given.position;
  material.colorNode = vec4(given.color, 1);
  material.sizeNode = given.size.mul(look.size);
  const cxy = pointCoord.mul(2).sub(1);
  const r = cxy.dot(cxy);
  const delta = fwidth(r);
  const mask = float(1).sub(smoothstep(float(1).sub(delta), delta.add(1), r));
  material.opacityNode = look.round ? mask.mul(look.opacity) : float(look.opacity);
  // Corners left out entirely, opaque or not.
  material.alphaTestNode = float(0.01);
  return material;
};

/** Drei's sparkles: motes swaying about their places, glowing from their middles. */
const sparklesMaterial = (
  buffers: PointBuffers,
  given: Attributes,
  time: Time,
): PointsNodeMaterial => {
  const speed = floatAttribute(buffers.speeds);
  const opacity = floatAttribute(buffers.opacities);
  const noise = vec3Attribute(buffers.noise);
  const material = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    sizeAttenuation: false,
  });
  const worldX = modelWorldMatrix.mul(vec4(given.position, 1)).x;
  const phase = time.mul(speed);
  material.positionNode = given.position.add(
    vec3(
      cos(phase.add(worldX.mul(noise.z).mul(100))).mul(0.2),
      sin(phase.add(worldX.mul(noise.x).mul(100))).mul(0.2),
      cos(phase.add(worldX.mul(noise.y).mul(100))).mul(0.2),
    ),
  );
  material.colorNode = vec4(given.color, 1);
  // Drei's `size * 25 * pixelRatio / -viewZ`; the material multiplies in the pixel ratio.
  material.sizeNode = given.size.mul(25).div(positionView.z.negate());
  const strength = float(0.05)
    .div(distance(pointCoord, vec2(0.5, 0.5)))
    .sub(0.1);
  material.opacityNode = strength.mul(opacity).clamp(0, 1);
  return material;
};

/**
 * Drei's stars. Its shader places them at `vec4(position, 0.5)`: the same direction as
 * twice the position at full weight, half as far in clip space, so here they are drawn at
 * twice their positions, and sized by half the view depth.
 */
const starsMaterial = (
  look: Extract<PointLook, { readonly _tag: 'Stars' }>,
  given: Attributes,
  time: Time,
): PointsNodeMaterial => {
  const material = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: false,
  });
  material.positionNode = given.position.mul(2);
  material.colorNode = vec4(given.color, 1);
  material.sizeNode = given.size
    .mul(float(30).div(positionView.z.negate().mul(0.5)))
    .mul(sin(time.add(100)).add(3));
  const d = distance(pointCoord, vec2(0.5, 0.5));
  const soft = float(1).div(exp(d.sub(0.25).mul(16)).add(1));
  material.opacityNode = look.fade ? soft : float(1);
  return material;
};

const materialFor = (
  look: PointLook,
  buffers: PointBuffers,
  given: Attributes,
  time: Time,
): PointsNodeMaterial => {
  switch (look._tag) {
    case 'Dots':
      return dotsMaterial(look, given);
    case 'Sparkles':
      return sparklesMaterial(buffers, given, time);
    case 'Stars':
      return starsMaterial(look, given, time);
  }
};

const draw = (look: PointLook, time: Time): Sprite => {
  const buffers = pointBuffers(look);
  const material = materialFor(look, buffers, attributes(buffers), time);
  const sprite = new Sprite(material);
  sprite.count = buffers.count;
  sprite.visible = buffers.count > 0;
  sprite.frustumCulled = false;
  return sprite;
};

export const hostPoints = (first: PointsNode): HostedPoints => {
  const object = new Group();
  const time = createTime();
  let look = first.look;
  let drawn = draw(look, time);
  object.add(drawn);
  // Sprites share three's one quad geometry: only the material is this node's.
  const free = (): void => {
    drawn.material.dispose();
  };
  return {
    object,
    update: (next) => {
      look = next.look;
      drawn.removeFromParent();
      free();
      drawn = draw(look, time);
      object.add(drawn);
    },
    tick: (seconds) => {
      time.value = look._tag === 'Stars' ? seconds * look.speed : seconds;
    },
    dispose: free,
  };
};
