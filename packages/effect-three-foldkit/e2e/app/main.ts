import { orbit, overlay, type RendererFactory, SceneSchema } from '@opsydyn/effect-three';
import { Array as Arr, Effect, Option, Schema } from 'effect';
import { Command, Runtime } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { modifyFields } from 'foldkit/struct';

import * as EffectThreeFoldkit from '../../src/index.ts';
/** A minimal Foldkit app exercising the adapter end to end (application boundary). */
import { checkerUrl } from './checker.ts';
import { probe } from './instrument.ts';
import { type Colour, homeCamera, type Motion, type Size, sceneFor } from './scene.ts';

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
  motion: Schema.Literals(['spin', 'still']),
  clicks: Schema.Number,
  lastKey: Schema.String,
  events: Schema.Array(Schema.String),
  moves: Schema.Number,
  started: Schema.Number,
  lastUpdated: Schema.Number,
  failed: Schema.Number,
  /** The robot model: how its load went, and the clips it reported. */
  robot: Schema.String,
  textured: Schema.Boolean,
  glow: Schema.Boolean,
  screen: Schema.Boolean,
  /** The orbiting camera, when the orbit test has switched it on. */
  orbit: Schema.Option(SceneSchema.Camera),
  label: Schema.Boolean,
});
type Model = typeof Model.Type;

const Message = defineMessageUnion({
  ClickedToggleColour: {},
  ClickedToggleSize: {},
  ClickedToggleVisible: {},
  ClickedToggleStill: {},
  ClickedNode: { key: Schema.String },
  GotSceneEvent: { name: Schema.String },
  MovedOverNode: {},
  GotReconciled: { updated: Schema.Number },
  GotSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
  ClickedLoadModel: {},
  ClickedUnloadModel: {},
  ClickedLoadTexture: {},
  ClickedToggleGlow: {},
  ClickedToggleScreen: {},
  ClickedToggleOrbit: {},
  ClickedToggleLabel: {},
  GotGesture: { gesture: SceneSchema.Gesture },
  SettledModel: { outcome: Schema.String },
  SettledTexture: { ready: Schema.Boolean },
});
type Message = typeof Message.Type;

/** Loads the robot: settles as `ready:<clips>` or `failed`. */
const LoadModel = Command.define('LoadModel', {
  messages: [Message.SettledModel],
  execute: environment.assets.loadModel('robot', 'robot.glb').pipe(
    Effect.match({
      onSuccess: ({ clips }) => Message.SettledModel({ outcome: `ready:${clips.join(',')}` }),
      onFailure: () => Message.SettledModel({ outcome: 'failed' }),
    }),
  ),
});

const UnloadModel = Command.define('UnloadModel', {
  messages: [Message.SettledModel],
  execute: environment.assets
    .unload('robot')
    .pipe(Effect.map(() => Message.SettledModel({ outcome: 'unloaded' }))),
});

const LoadTexture = Command.define('LoadTexture', {
  messages: [Message.SettledTexture],
  execute: Effect.suspend(() => environment.assets.loadTexture('checker', checkerUrl())).pipe(
    Effect.match({
      onSuccess: () => Message.SettledTexture({ ready: true }),
      onFailure: () => Message.SettledTexture({ ready: false }),
    }),
  ),
});

const otherColour: Record<Colour, Colour> = { red: 'blue', blue: 'red' };
const otherSize: Record<Size, Size> = { small: 'large', large: 'small' };
const otherMotion: Record<Motion, Motion> = { spin: 'still', still: 'spin' };

const lifecycleUpdate = (model: Model, lifecycle: EffectThreeFoldkit.SceneLifecycle) =>
  EffectThreeFoldkit.SceneLifecycle.match(lifecycle, {
    StartedScene: () => modifyFields(model, { started: (count) => count + 1 }),
    FailedScene: () => modifyFields(model, { failed: (count) => count + 1 }),
  });

type OrbitCamera = Model['orbit'];

/** Orbiting starts from the home camera, and stops. */
const toggledOrbit = (camera: OrbitCamera): OrbitCamera =>
  Option.match(camera, { onNone: () => Option.some(homeCamera), onSome: Option.none });

const orbitedBy =
  (gesture: typeof SceneSchema.Gesture.Type) =>
  (camera: OrbitCamera): OrbitCamera =>
    Option.map(camera, (current) => orbit(current, gesture));

/** The orbiting camera as a scene extra, when there is one. */
const orbitExtra = (camera: OrbitCamera) =>
  Option.match(camera, { onNone: () => ({}), onSome: (current) => ({ orbit: current }) });

/** The orbiting camera's position, for the test to read. */
const cameraReadout = (camera: OrbitCamera): string =>
  Option.match(camera, {
    onNone: () => '',
    onSome: (current) => current.position.map((value) => value.toFixed(3)).join(','),
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
    ClickedToggleStill: () => ({
      model: modifyFields(model, { motion: (motion) => otherMotion[motion] }),
    }),
    ClickedNode: ({ key }) => ({
      model: modifyFields(model, { clicks: (count) => count + 1, lastKey: () => key }),
    }),
    GotSceneEvent: ({ name }) => ({
      model: modifyFields(model, { events: (events) => [...events, name] }),
    }),
    MovedOverNode: () => ({ model: modifyFields(model, { moves: (count) => count + 1 }) }),
    ClickedLoadModel: () => ({
      model: modifyFields(model, { robot: () => 'loading' }),
      commands: [LoadModel()],
    }),
    ClickedUnloadModel: () => ({ model, commands: [UnloadModel()] }),
    ClickedLoadTexture: () => ({ model, commands: [LoadTexture()] }),
    ClickedToggleGlow: () => ({ model: modifyFields(model, { glow: (glow) => !glow }) }),
    ClickedToggleScreen: () => ({
      model: modifyFields(model, { screen: (screen) => !screen }),
    }),
    ClickedToggleOrbit: () => ({ model: modifyFields(model, { orbit: toggledOrbit }) }),
    ClickedToggleLabel: () => ({ model: modifyFields(model, { label: (label) => !label }) }),
    GotGesture: ({ gesture }) => ({
      model: modifyFields(model, { orbit: orbitedBy(gesture) }),
    }),
    SettledModel: ({ outcome }) => ({ model: modifyFields(model, { robot: () => outcome }) }),
    SettledTexture: ({ ready }) => ({ model: modifyFields(model, { textured: () => ready }) }),
    GotSceneLifecycle: ({ lifecycle }) => ({ model: lifecycleUpdate(model, lifecycle) }),
    GotReconciled: ({ updated }) => ({
      model: modifyFields(model, { lastUpdated: () => updated }),
    }),
  });

function update(model: Model, message: Message) {
  probe.updates++;
  return pureUpdate(model, message);
}

const cubeLabel = (model: Model, h: HtmlBuilder<Message>) => ({
  overlay: overlay({ key: 'cube-label', node: 'cube', position: [0, 1, 0], center: true }),
  content: h.span([h.Id('cube-label')], [model.colour]),
});

/** A label above the cube, centred, in the cube's colour name, while switched on. */
const labelsFor = (model: Model, h: HtmlBuilder<Message>) =>
  Option.liftPredicate(model, (shown) => shown.label).pipe(
    Option.map((shown) => cubeLabel(shown, h)),
    Option.toArray,
  );

const sceneView = (model: Model, h: HtmlBuilder<Message>): Html =>
  EffectThreeFoldkit.view(
    {
      scene: sceneFor(model.colour, model.size, model.motion, {
        robot: model.robot.startsWith('ready'),
        textured: model.textured,
        glow: model.glow,
        screen: model.screen,
        ...orbitExtra(model.orbit),
      }),
      mount: sceneMount,
      className: 'scene',
      onLifecycle: (lifecycle) => Message.GotSceneLifecycle({ lifecycle }),
      onClick: ({ key, part }) =>
        Message.ClickedNode({
          key: Arr.getSomes([Option.some(key), Option.fromNullishOr(part)]).join('/'),
        }),
      onDoubleClick: ({ key }) => Message.GotSceneEvent({ name: `DoubleClick:${key}` }),
      onContextMenu: ({ key }) => Message.GotSceneEvent({ name: `ContextMenu:${key}` }),
      onWheel: ({ key, deltaY }) =>
        Message.GotSceneEvent({ name: `Wheel:${key}:${Math.sign(deltaY)}` }),
      onPointerMissed: ({ button }) => Message.GotSceneEvent({ name: `Missed:${button}` }),
      onPointerMove: () => Message.MovedOverNode(),
      onDragEnd: ({ key, ray }) =>
        Message.GotSceneEvent({ name: `DragEnd:${key}:${Math.sign(ray.direction[2])}` }),
      onReconciled: ({ ops }) => Message.GotReconciled({ updated: ops.updated }),
      onGesture: (gesture) => Message.GotGesture({ gesture }),
      overlays: labelsFor(model, h),
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
      h.button([h.Id('still'), h.OnClick(Message.ClickedToggleStill())], ['still']),
      h.button([h.Id('load-model'), h.OnClick(Message.ClickedLoadModel())], ['load model']),
      h.button([h.Id('unload-model'), h.OnClick(Message.ClickedUnloadModel())], ['unload']),
      h.button([h.Id('load-texture'), h.OnClick(Message.ClickedLoadTexture())], ['texture']),
      h.button([h.Id('glow'), h.OnClick(Message.ClickedToggleGlow())], ['glow']),
      h.button([h.Id('screen'), h.OnClick(Message.ClickedToggleScreen())], ['screen']),
      h.button([h.Id('orbit'), h.OnClick(Message.ClickedToggleOrbit())], ['orbit']),
      h.button([h.Id('label'), h.OnClick(Message.ClickedToggleLabel())], ['label']),
      h.p([h.Id('camera')], [cameraReadout(model.orbit)]),
      h.p([h.Id('robot')], [model.robot]),
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
  motion: 'spin',
  clicks: 0,
  lastKey: '',
  events: [],
  moves: 0,
  started: 0,
  lastUpdated: -1,
  failed: 0,
  robot: 'none',
  textured: false,
  glow: false,
  screen: false,
  orbit: Option.none(),
  label: false,
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
