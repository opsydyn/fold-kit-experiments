/* oxlint-disable linteffect/no-try-catch -- Restore the DOM globals and release test resources in finally. */
import { expect, test } from 'bun:test';

import { Mount, UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Schema } from 'effect';
import { Window as TestWindow } from 'happy-dom';

import renderer from '../../../packages/astro-effect-ui/src/client.ts';
import {
  makeEnvironment,
  type EnvironmentHost,
} from '../../../packages/effect-three-foldkit/src/environment.ts';
import { ReconciledDetail } from '../../../packages/effect-three-foldkit/src/sceneEvents.ts';
import { defineEffectThreeMount } from '../../../packages/effect-three-samples/src/effect-ui-scene.ts';
import {
  box,
  mesh,
  recordingRendererFactory,
  scene,
  standard,
} from '../../../packages/effect-three/src/index.ts';

const Message = UiSchema.TaggedEnum({
  ClickedSceneUpdate: {},
  RecordedSceneStart: { status: Schema.String },
});

const cubeScene = (x: number) =>
  scene({
    children: [
      mesh({ key: 'cube', position: [x, 0, 0], geometry: box(), material: standard({ color: 1 }) }),
    ],
  });

async function until(check: () => boolean) {
  const deadline = Date.now() + 1000;
  while (!check() && Date.now() < deadline) await Bun.sleep(5);
  expect(check()).toBe(true);
}

test('Effect UI updates the mounted scene and releases its canvas, renderer, and resources', async () => {
  const dom = new TestWindow();
  const globals = {
    window: dom,
    CustomEvent: dom.CustomEvent,
    HTMLElement: dom.HTMLElement,
    getComputedStyle: dom.getComputedStyle.bind(dom),
    ResizeObserver: dom.ResizeObserver,
    IntersectionObserver: dom.IntersectionObserver,
  };
  const descriptors = Object.getOwnPropertyDescriptors(globalThis);
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const renderers = recordingRendererFactory();
  // SAFETY: Happy DOM implements the required APIs with incompatible declaration types.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- The declarations differ from lib.dom.
  const environment = makeEnvironment(dom as unknown as EnvironmentHost, {
    renderer: () => renderers,
  });
  const SceneMount = defineEffectThreeMount(() => environment);
  const Scene = Html.component({
    name: 'SceneFixture',
    model: Schema.Struct({ x: Schema.Number, status: Schema.String }),
    message: Message,
  }).make({
    init: () => ({ x: 0, status: 'starting' }),
    update: {
      ClickedSceneUpdate: ({ model }) => ({ ...model, x: model.x + 1 }),
      RecordedSceneStart: ({ model }, { status }) => ({ ...model, status }),
    },
    view: (h, model) =>
      h.section(
        h.div
          .id('scene')
          .onMount(
            Mount.map(SceneMount({ scene: cubeScene(model.x) }), (status) =>
              Message.RecordedSceneStart({ status: status._tag }),
            ),
          )
          .children(),
        h.output(model.status),
        h.button.on('click', Message.ClickedSceneUpdate()).children('Update scene'),
      ),
  });

  const island = dom.document.createElement('astro-island');
  dom.document.body.append(island);
  const reconciliations: Array<number> = [];
  const isReconciledDetail = Schema.is(ReconciledDetail);
  island.addEventListener(
    'scene-reconciled',
    (event) => {
      if (event instanceof dom.CustomEvent && isReconciledDetail(event.detail)) {
        reconciliations.push(event.detail.ops.updated);
      }
    },
    { capture: true },
  );
  try {
    // SAFETY: The Happy DOM element provides the methods used by the client renderer.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- The declarations differ from lib.dom.
    await renderer(island as unknown as HTMLElement)(Scene, {}, {}, { client: 'only' });
    await until(() => island.querySelector('output')?.textContent === 'StartedScene');
    expect(reconciliations).toEqual([0]);
    expect(environment.store.stats().geometries.live).toBe(1);
    const canvas = island.querySelector('canvas');
    expect(canvas).not.toBeNull();

    island.querySelector('button')?.click();
    await until(() => reconciliations.length === 2);
    expect(reconciliations).toEqual([0, 1]);
    expect(renderers.created()).toHaveLength(1);
    expect(island.querySelector('canvas')).toBe(canvas);

    island.dispatchEvent(new dom.Event('astro:unmount'));
    await until(() => renderers.created()[0]?.disposed() === true && canvas?.isConnected === false);
    expect(environment.store.stats().geometries.live).toBe(0);
    expect(environment.store.stats().materials.live).toBe(0);
  } finally {
    island.dispatchEvent(new dom.Event('astro:unmount'));
    environment.dispose();
    await dom.close();
    for (const key of Object.keys(globals)) {
      const descriptor = descriptors[key];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
