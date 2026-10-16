import { expect, test } from 'bun:test';

import { type Material, Mesh, MeshBasicMaterial, MeshDepthMaterial, ShaderLib } from 'three';

import {
  box,
  type ContactShadows,
  contactShadows,
  createSceneGraph,
  createSceneLoop,
  mesh,
  recordingRendererFactory,
  scene,
  standard,
} from '../src/kernel/index.ts';

/** A loop whose renderer records each pass into a target and the targets it makes. */
const harness = () => {
  const graph = createSceneGraph();
  const recorded = recordingRendererFactory().create();
  const passes: Array<{
    readonly into: string;
    readonly override: Material | null;
    readonly planeShown: boolean;
    readonly background: unknown;
  }> = [];
  const targets: Array<{ disposed: boolean }> = [];
  const shadowPlane = () =>
    graph.scene.children.find(
      (child): child is Mesh =>
        child instanceof Mesh && child.material instanceof MeshBasicMaterial,
    );
  const renderer = {
    ...recorded,
    render: (...args: Parameters<typeof recorded.render>) => {
      const [drawn, , , target] = args;
      if (target !== undefined) {
        passes.push({
          into: drawn === graph.scene ? 'depth' : 'blur',
          override: drawn.overrideMaterial,
          planeShown: shadowPlane()?.visible ?? false,
          background: drawn.background,
        });
      }
      recorded.render(...args);
    },
    createTarget: (width: number, height: number) => {
      const target = recorded.createTarget(width, height);
      const record = { disposed: false };
      targets.push(record);
      return { texture: target.texture, dispose: () => (record.disposed = true) };
    },
  };
  const loop = createSceneLoop({ graph, renderer, elapsedSeconds: () => 0, emit: () => undefined });
  const show = (shadows: ContactShadows | undefined) => {
    graph.reconcile(
      scene({
        ...(shadows === undefined ? {} : { contactShadows: shadows }),
        children: [mesh({ key: 'cube', geometry: box(), material: standard() })],
      }),
    );
    loop.frame();
  };
  return { graph, loop, passes, targets, shadowPlane, show };
};

test('three’s depth shader still has the line the shadow pass recolours', () => {
  expect(ShaderLib.depth.fragmentShader).toContain(
    'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
  );
});

test('each frame renders depth from below, then blurs twice with smooth; the plane shows it', () => {
  const { graph, passes, shadowPlane, show } = harness();
  show(contactShadows({ position: [0, -1, 0], opacity: 0.6 }));
  // Depth with the plane hidden, no background and the depth material; then two blurs of
  // two passes each (horizontal into the spare target, vertical back).
  expect(passes.map((pass) => pass.into)).toEqual(['depth', 'blur', 'blur', 'blur', 'blur']);
  expect(passes[0]?.override).toBeInstanceOf(MeshDepthMaterial);
  expect(passes[0]?.planeShown).toBe(false);
  expect(passes[0]?.background).toBeNull();
  expect(graph.scene.overrideMaterial).toBeNull();

  const plane = shadowPlane();
  expect(plane?.visible).toBe(true);
  expect(plane?.position.toArray()).toEqual([0, -1, 0]);
  const material = plane?.material;
  expect(material instanceof MeshBasicMaterial && material.opacity).toBe(0.6);
  // Never in the way of a pick.
  expect(plane?.raycast.length).toBe(0);
});

test('without smooth one blur; a new size remakes the targets; removing frees everything', () => {
  const { graph, passes, targets, shadowPlane, show } = harness();
  show(contactShadows({ smooth: false }));
  expect(passes).toHaveLength(3);
  expect(targets).toEqual([{ disposed: false }, { disposed: false }]);

  show(contactShadows({ smooth: false, opacity: 0.5 }));
  expect(targets).toHaveLength(2);

  show(contactShadows({ smooth: false, size: 4 }));
  expect(targets.map((target) => target.disposed)).toEqual([true, true, false, false]);

  show(undefined);
  expect(targets.every((target) => target.disposed)).toBe(true);
  expect(shadowPlane()).toBeUndefined();
  expect(graph.needsFrame()).toBe(false);
});
