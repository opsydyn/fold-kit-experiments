import type { RendererFactory } from '@opsydyn/effect-three';
import { Option, Schema } from 'effect';
import { Runtime } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { modifyFields } from 'foldkit/struct';

import * as EffectThreeFoldkit from '../../src/index.ts';
/** A minimal Foldkit app exercising the adapter end to end (application boundary). */
import { probe } from './instrument.ts';
import { type Colour, type Size, sceneFor } from './scene.ts';

// Wraps the WebGL renderer so the test can read three's `renderer.info.memory`.
const probedRenderer = (canvas: HTMLCanvasElement): RendererFactory => ({
  create: () => {
    const renderer = EffectThreeFoldkit.webglRendererFactory(canvas).create();
    probe.rendererMemory = renderer.memory;
    return renderer;
  },
});

const environment = EffectThreeFoldkit.makeEnvironment(window, { renderer: probedRenderer });
const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);
probe.stats = environment.store.stats;

const Model = Schema.Struct({
  colour: Schema.Literals(['red', 'blue']),
  size: Schema.Literals(['small', 'large']),
  visible: Schema.Boolean,
  clicks: Schema.Number,
  lastKey: Schema.String,
  events: Schema.Array(Schema.String),
  moves: Schema.Number,
  started: Schema.Number,
  lastUpdated: Schema.Number,
  failed: Schema.Number,
});
type Model = typeof Model.Type;

const Message = defineMessageUnion({
  ClickedToggleColour: {},
  ClickedToggleSize: {},
  ClickedToggleVisible: {},
  ClickedNode: { key: Schema.String },
  GotSceneEvent: { name: Schema.String },
  MovedOverNode: {},
  GotReconciled: { updated: Schema.Number },
  GotSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
type Message = typeof Message.Type;

const otherColour: Record<Colour, Colour> = { red: 'blue', blue: 'red' };
const otherSize: Record<Size, Size> = { small: 'large', large: 'small' };

const lifecycleUpdate = (model: Model, lifecycle: EffectThreeFoldkit.SceneLifecycle) =>
  EffectThreeFoldkit.SceneLifecycle.match(lifecycle, {
    StartedScene: () => modifyFields(model, { started: (count) => count + 1 }),
    FailedScene: () => modifyFields(model, { failed: (count) => count + 1 }),
  });

const pureUpdate = (model: Model, message: Message) =>
  Message.match(message, {
    ClickedToggleColour: () => ({
      model: modifyFields(model, { colour: (colour) => otherColour[colour] }),
    }),
    ClickedToggleSize: () => ({ model: modifyFields(model, { size: (size) => otherSize[size] }) }),
    ClickedToggleVisible: () => ({
      model: modifyFields(model, { visible: (visible) => !visible }),
    }),
    ClickedNode: ({ key }) => ({
      model: modifyFields(model, { clicks: (count) => count + 1, lastKey: () => key }),
    }),
    GotSceneEvent: ({ name }) => ({
      model: modifyFields(model, { events: (events) => [...events, name] }),
    }),
    MovedOverNode: () => ({ model: modifyFields(model, { moves: (count) => count + 1 }) }),
    GotSceneLifecycle: ({ lifecycle }) => ({ model: lifecycleUpdate(model, lifecycle) }),
    GotReconciled: ({ updated }) => ({
      model: modifyFields(model, { lastUpdated: () => updated }),
    }),
  });

function update(model: Model, message: Message) {
  probe.updates++;
  return pureUpdate(model, message);
}

const sceneView = (model: Model, h: HtmlBuilder<Message>): Html =>
  EffectThreeFoldkit.view(
    {
      scene: sceneFor(model.colour, model.size),
      mount: sceneMount,
      className: 'scene',
      onLifecycle: (lifecycle) => Message.GotSceneLifecycle({ lifecycle }),
      onClick: ({ key }) => Message.ClickedNode({ key }),
      onDoubleClick: ({ key }) => Message.GotSceneEvent({ name: `DoubleClick:${key}` }),
      onContextMenu: ({ key }) => Message.GotSceneEvent({ name: `ContextMenu:${key}` }),
      onWheel: ({ key, deltaY }) =>
        Message.GotSceneEvent({ name: `Wheel:${key}:${Math.sign(deltaY)}` }),
      onPointerMissed: ({ button }) => Message.GotSceneEvent({ name: `Missed:${button}` }),
      onPointerMove: () => Message.MovedOverNode(),
      onReconciled: ({ ops }) => Message.GotReconciled({ updated: ops.updated }),
    },
    h,
  );

const isVisible = (model: Model): boolean => model.visible;

const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      h.button([h.Id('colour'), h.OnClick(Message.ClickedToggleColour())], ['colour']),
      h.button([h.Id('visible'), h.OnClick(Message.ClickedToggleVisible())], ['visible']),
      h.button([h.Id('size'), h.OnClick(Message.ClickedToggleSize())], ['size']),
      h.p([h.Id('clicks')], [String(model.clicks)]),
      h.p([h.Id('last-key')], [model.lastKey]),
      h.p([h.Id('events')], [model.events.join(' ')]),
      h.p([h.Id('moves')], [String(model.moves)]),
      h.p([h.Id('started')], [String(model.started)]),
      h.p([h.Id('failed')], [String(model.failed)]),
      h.p([h.Id('last-updated')], [String(model.lastUpdated)]),
      ...Option.liftPredicate(model, isVisible).pipe(
        Option.map((visible) => sceneView(visible, h)),
        Option.toArray,
      ),
    ],
  );

const initialModel: Model = {
  colour: 'red',
  size: 'small',
  visible: true,
  clicks: 0,
  lastKey: '',
  events: [],
  moves: 0,
  started: 0,
  lastUpdated: -1,
  failed: 0,
};

Runtime.run(
  Runtime.makeElement({
    Model,
    init: () => ({ model: initialModel }),
    update,
    view,
    container: document.getElementById('root'),
  }),
);
