/**
 * The WebGL kit's points: three's `Points` with the materials Drei draws them with
 * (`bf6f4ad`): its `PointMaterial` (three's `PointsMaterial` with a round mask), and the
 * shaders of its `Sparkles` and `Stars`, ported as they are. The buffers come from the
 * kernel (`pointBuffers`), the same for every renderer.
 *
 * One change from Drei's `PointMaterial`: it applies tone mapping and the output colour
 * space a second time after its mask, which brightens the dots; here the mask only sets
 * the alpha, and fully masked corners are discarded so opaque dots are round too.
 *
 * @module
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  type Material,
  Points,
  PointsMaterial,
  ShaderMaterial,
} from 'three';

import type { PointLook, PointsNode } from '../kernel/description.ts';
import { type PointBuffers, pointBuffers } from '../kernel/pointBuffers.ts';
import type { HostedPoints } from '../kernel/renderKit.ts';

/** Drei's `PointMaterial` mask: 1 inside the circle, smoothed over a pixel at its edge. */
const roundMask = /* glsl */ `
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  float r = dot(cxy, cxy);
  float delta = fwidth(r);
  float mask = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, r);
  gl_FragColor.a *= mask;
  if (gl_FragColor.a < 0.01) discard;
`;

/** Dots: `PointsMaterial` with a size factor a point and, round, Drei's mask. */
const dotsMaterial = (look: Extract<PointLook, { readonly _tag: 'Dots' }>): Material => {
  const material = new PointsMaterial({
    color: 0xffffff,
    vertexColors: true,
    size: look.size,
    sizeAttenuation: look.sizeAttenuation,
    opacity: look.opacity,
    transparent: look.transparent,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('uniform float size;', 'uniform float size;\nattribute float pointSize;')
      .replace('gl_PointSize = size;', 'gl_PointSize = size * pointSize;');
    if (look.round) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>\n${roundMask}`,
      );
    }
  };
  material.customProgramCacheKey = () => `effect-three:dots:${look.round}`;
  return material;
};

/** Drei's `SparklesImplMaterial`, its shaders as Drei writes them. */
const sparklesMaterial = (): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: { time: { value: 0 }, pixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float pixelRatio;
      uniform float time;
      attribute float size;
      attribute float speed;
      attribute float opacity;
      attribute vec3 noise;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        vec4 modelPosition = modelMatrix * vec4(position, 1.0);
        modelPosition.y += sin(time * speed + modelPosition.x * noise.x * 100.0) * 0.2;
        modelPosition.z += cos(time * speed + modelPosition.x * noise.y * 100.0) * 0.2;
        modelPosition.x += cos(time * speed + modelPosition.x * noise.z * 100.0) * 0.2;
        vec4 viewPosition = viewMatrix * modelPosition;
        vec4 projectionPostion = projectionMatrix * viewPosition;
        gl_Position = projectionPostion;
        gl_PointSize = size * 25. * pixelRatio;
        gl_PointSize *= (1.0 / - viewPosition.z);
        vColor = color;
        vOpacity = opacity;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
        float strength = 0.05 / distanceToCenter - 0.1;
        gl_FragColor = vec4(vColor, strength * vOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });

/** Drei's `StarfieldMaterial`, its shaders as Drei writes them. */
const starsMaterial = (fade: boolean): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: { time: { value: 0 }, fade: { value: fade ? 1 : 0 } },
    vertexShader: /* glsl */ `
      uniform float time;
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 0.5);
        gl_PointSize = size * (30.0 / -mvPosition.z) * (3.0 + sin(time + 100.0));
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: /* glsl */ `
      uniform float fade;
      varying vec3 vColor;
      void main() {
        float opacity = 1.0;
        if (fade == 1.0) {
          float d = distance(gl_PointCoord, vec2(0.5, 0.5));
          opacity = 1.0 / (1.0 + exp(16.0 * (d - 0.25)));
        }
        gl_FragColor = vec4(vColor, opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
    vertexColors: true,
  });

/** The geometry from the kernel's buffers, with the attribute names each shader reads. */
const pointsGeometry = (buffers: PointBuffers, look: PointLook): BufferGeometry => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('color', new BufferAttribute(buffers.colors, 3));
  geometry.setAttribute(
    look._tag === 'Dots' ? 'pointSize' : 'size',
    new BufferAttribute(buffers.sizes, 1),
  );
  if (look._tag === 'Sparkles') {
    geometry.setAttribute('speed', new BufferAttribute(buffers.speeds, 1));
    geometry.setAttribute('opacity', new BufferAttribute(buffers.opacities, 1));
    geometry.setAttribute('noise', new BufferAttribute(buffers.noise, 3));
  }
  return geometry;
};

const materialFor = (look: PointLook): Material => {
  switch (look._tag) {
    case 'Dots':
      return dotsMaterial(look);
    case 'Sparkles':
      return sparklesMaterial();
    case 'Stars':
      return starsMaterial(look.fade);
  }
};

const draw = (look: PointLook): Points<BufferGeometry, Material> => {
  const buffers = pointBuffers(look);
  const drawn = new Points(pointsGeometry(buffers, look), materialFor(look));
  drawn.visible = buffers.count > 0;
  // Sparkles size by the device's pixel ratio, as Drei's take the viewport's `dpr`.
  drawn.onBeforeRender = (renderer) => {
    const material = drawn.material;
    if (material instanceof ShaderMaterial && material.uniforms['pixelRatio'] !== undefined) {
      material.uniforms['pixelRatio'].value = renderer.getPixelRatio();
    }
  };
  return drawn;
};

export const hostPoints = (first: PointsNode): HostedPoints => {
  const object = new Group();
  let look = first.look;
  let drawn = draw(look);
  object.add(drawn);
  const free = (): void => {
    drawn.geometry.dispose();
    drawn.material.dispose();
  };
  return {
    object,
    update: (next) => {
      look = next.look;
      drawn.removeFromParent();
      free();
      drawn = draw(look);
      object.add(drawn);
    },
    tick: (seconds) => {
      const time =
        drawn.material instanceof ShaderMaterial ? drawn.material.uniforms['time'] : undefined;
      // Drei's stars twinkle at `speed`; its sparkles carry their speed a mote.
      if (time !== undefined) time.value = look._tag === 'Stars' ? seconds * look.speed : seconds;
    },
    dispose: free,
  };
};
