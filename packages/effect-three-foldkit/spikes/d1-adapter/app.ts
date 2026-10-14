// Spike D1: hybrid adapter = CustomElement (typed props + Schema-decoded events) + Mount (lifecycle in Foldkit's runtime).
import { Effect, Schema } from 'effect';
import { CustomElement, Mount, Runtime } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';

const log: Array<string> = [];
Object.assign(globalThis, { __log: log });

const SceneDescription = Schema.Struct({ color: Schema.String });
type SceneDescription = typeof SceneDescription.Type;

const sceneElement = CustomElement.define({
  tag: 'spike-scene',
  properties: { scene: SceneDescription },
  events: { 'scene-pointer': Schema.Struct({ nodeKey: Schema.String }) },
});

const Message = defineMessageUnion({
  ClickedToggleColor: {},
  ClickedToggleVisible: {},
  ClickedNode: { nodeKey: Schema.String },
  SceneMounted: {},
});
type Message = typeof Message.Type;

const Model = Schema.Struct({
  color: Schema.String,
  visible: Schema.Boolean,
  nodeClicks: Schema.Number,
});
type Model = typeof Model.Type;

// The Mount intercepts the `scene` property the CustomElement factory sets on every changed render.
const SceneLifecycle = Mount.define('SpikeSceneLifecycle', {
  messages: [Message.SceneMounted],
  execute: ({ element }) =>
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const initial: unknown = Reflect.get(element, 'scene');
          log.push(`mount:${JSON.stringify(initial)}`);
          let current = initial;
          Object.defineProperty(element, 'scene', {
            configurable: true,
            get: () => current,
            set: (next: SceneDescription) => {
              current = next;
              log.push(`update:${next.color}`);
            },
          });
          const onClick = (): void => {
            element.dispatchEvent(
              new CustomEvent('scene-pointer', { detail: { nodeKey: 'cube-a' } }),
            );
          };
          element.addEventListener('click', onClick);
          return onClick;
        }),
        (onClick) =>
          Effect.sync(() => {
            element.removeEventListener('click', onClick);
            log.push('release');
          }),
      );
      return Message.SceneMounted();
    }),
});

const update = (model: Model, message: Message) =>
  Message.match(message, {
    ClickedToggleColor: () => ({
      model: { ...model, color: model.color === 'red' ? 'blue' : 'red' },
    }),
    ClickedToggleVisible: () => ({ model: { ...model, visible: !model.visible } }),
    ClickedNode: () => ({ model: { ...model, nodeClicks: model.nodeClicks + 1 } }),
    SceneMounted: () => ({ model }),
  });

const view = (model: Model, h: HtmlBuilder<Message>): Html => {
  const scene = sceneElement.withMessage(h);
  return h.div(
    [],
    [
      h.button([h.Id('color'), h.OnClick(Message.ClickedToggleColor())], ['color']),
      h.button([h.Id('visible'), h.OnClick(Message.ClickedToggleVisible())], ['visible']),
      h.p([h.Id('clicks')], [String(model.nodeClicks)]),
      ...(model.visible
        ? [
            scene(
              [
                h.Id('scene'),
                scene.Scene({ color: model.color }),
                scene.OnScenePointer((detail) => Message.ClickedNode({ nodeKey: detail.nodeKey })),
                h.OnMount(SceneLifecycle()),
              ],
              [],
            ),
          ]
        : []),
    ],
  );
};

Runtime.run(
  Runtime.makeElement({
    Model,
    init: () => ({ model: { color: 'red', visible: true, nodeClicks: 0 } }),
    update,
    view,
    container: document.getElementById('root'),
  }),
);
