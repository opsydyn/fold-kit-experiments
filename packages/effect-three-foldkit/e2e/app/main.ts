import { Command, UiSchema } from '@effect/ui';
import { BrowserHost, Html } from '@effect/ui/html';
import { orbit, overlay, type RendererFactory, SceneSchema } from '@opsydyn/effect-three';
import { Array as Arr, Effect, Layer, Option, Schema, Struct } from 'effect';

import * as EffectThreeUi from '../../src/index.ts';
/** A minimal Effect UI app exercising the adapter end to end (application boundary). */
import { checkerUrl } from './checker.ts';
import { probe } from './instrument.ts';
import { type Colour, homeCamera, type Motion, type Size, sceneFor } from './scene.ts';

// Wraps the WebGL renderer so the test can read three's `renderer.info.memory`, keeping
// its render kit.
const probedRenderer = (canvas: HTMLCanvasElement): RendererFactory => {
  const factory = EffectThreeUi.webglRendererFactory(canvas);
  return {
    ...factory,
    create: () => {
      const renderer = factory.create();
      probe.rendererMemory = renderer.memory;
      return renderer;
    },
  };
};

const environment = EffectThreeUi.makeEnvironment(window, { renderer: probedRenderer });
const sceneMount = EffectThreeUi.makeSceneMount(environment);
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
  /** The block font: how its load went. */
  font: Schema.Literals(['none', 'loading', 'ready', 'failed']),
});
type Model = typeof Model.Type;

const Message = UiSchema.TaggedEnum({
  ClickedToggleColour: {},
  ClickedToggleSize: {},
  ClickedToggleVisible: {},
  ClickedToggleStill: {},
  ClickedNode: { key: Schema.String },
  GotSceneEvent: { name: Schema.String },
  MovedOverNode: {},
  GotReconciled: { updated: Schema.Number },
  GotSceneLifecycle: { lifecycle: EffectThreeUi.SceneLifecycle },
  ClickedLoadModel: {},
  ClickedUnloadModel: {},
  ClickedLoadTexture: {},
  ClickedToggleGlow: {},
  ClickedToggleScreen: {},
  ClickedToggleOrbit: {},
  ClickedToggleLabel: {},
  ClickedLoadFont: {},
  SettledFont: { ready: Schema.Boolean },
  GotGesture: { gesture: SceneSchema.Gesture },
  SettledModel: { outcome: Schema.String },
  SettledTexture: { ready: Schema.Boolean },
});
type Message = typeof Message.Type;

/** Loads the block font for the title: settles as ready or not. */
const LoadFont = Command.make('LoadFont', { args: {} }, () =>
  environment.assets.loadFont('block', 'block.typeface.json').pipe(
    Effect.match({
      onSuccess: () => Message.SettledFont({ ready: true }),
      onFailure: () => Message.SettledFont({ ready: false }),
    }),
  ),
);

const fontOutcome = { true: 'ready', false: 'failed' } as const;

/** The title shows once the font has been asked for: empty until it arrives. */
const titleShown = { none: false, loading: true, ready: true, failed: true } as const;

/** Loads the robot: settles as `ready:<clips>` or `failed`. */
const LoadModel = Command.make('LoadModel', { args: {} }, () =>
  environment.assets.loadModel('robot', 'robot.glb').pipe(
    Effect.match({
      onSuccess: ({ clips }) => Message.SettledModel({ outcome: `ready:${clips.join(',')}` }),
      onFailure: () => Message.SettledModel({ outcome: 'failed' }),
    }),
  ),
);

const UnloadModel = Command.make('UnloadModel', { args: {} }, () =>
  environment.assets
    .unload('robot')
    .pipe(Effect.map(() => Message.SettledModel({ outcome: 'unloaded' }))),
);

const LoadTexture = Command.make('LoadTexture', { args: {} }, () =>
  Effect.suspend(() => environment.assets.loadTexture('checker', checkerUrl())).pipe(
    Effect.match({
      onSuccess: () => Message.SettledTexture({ ready: true }),
      onFailure: () => Message.SettledTexture({ ready: false }),
    }),
  ),
);

const otherColour: Record<Colour, Colour> = { red: 'blue', blue: 'red' };
const otherSize: Record<Size, Size> = { small: 'large', large: 'small' };
const otherMotion: Record<Motion, Motion> = { spin: 'still', still: 'spin' };

const lifecycleUpdate = (model: Model, lifecycle: EffectThreeUi.SceneLifecycle) =>
  EffectThreeUi.SceneLifecycle.match(lifecycle, {
    StartedScene: () => Struct.evolve(model, { started: (count) => count + 1 }),
    FailedScene: () => Struct.evolve(model, { failed: (count) => count + 1 }),
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

type Update = {
  readonly model: Model;
  readonly commands?: ReadonlyArray<Command.Issued<Message, never, never, 'Effect'>>;
};

const pureUpdate = (model: Model, message: Message): Update =>
  Message.match(message, {
    ClickedToggleColour: () => ({
      model: Struct.evolve(model, { colour: (colour) => otherColour[colour] }),
    }),
    ClickedToggleSize: () => ({ model: Struct.evolve(model, { size: (size) => otherSize[size] }) }),
    ClickedToggleVisible: () => ({
      model: Struct.evolve(model, { visible: (visible) => !visible }),
    }),
    ClickedToggleStill: () => ({
      model: Struct.evolve(model, { motion: (motion) => otherMotion[motion] }),
    }),
    ClickedNode: ({ key }) => ({
      model: Struct.evolve(model, { clicks: (count) => count + 1, lastKey: () => key }),
    }),
    GotSceneEvent: ({ name }) => ({
      model: Struct.evolve(model, { events: (events) => [...events, name] }),
    }),
    MovedOverNode: () => ({ model: Struct.evolve(model, { moves: (count) => count + 1 }) }),
    ClickedLoadModel: () => ({
      model: Struct.evolve(model, { robot: () => 'loading' }),
      commands: [LoadModel.make()],
    }),
    ClickedUnloadModel: () => ({ model, commands: [UnloadModel.make()] }),
    ClickedLoadTexture: () => ({ model, commands: [LoadTexture.make()] }),
    ClickedToggleGlow: () => ({ model: Struct.evolve(model, { glow: (glow) => !glow }) }),
    ClickedToggleScreen: () => ({
      model: Struct.evolve(model, { screen: (screen) => !screen }),
    }),
    ClickedToggleOrbit: () => ({ model: Struct.evolve(model, { orbit: toggledOrbit }) }),
    ClickedToggleLabel: () => ({ model: Struct.evolve(model, { label: (label) => !label }) }),
    ClickedLoadFont: () => ({
      model: Struct.evolve(model, { font: () => 'loading' as const }),
      commands: [LoadFont.make()],
    }),
    SettledFont: ({ ready }) => ({
      model: Struct.evolve(model, { font: () => fontOutcome[`${ready}`] }),
    }),
    GotGesture: ({ gesture }) => ({
      model: Struct.evolve(model, { orbit: orbitedBy(gesture) }),
    }),
    SettledModel: ({ outcome }) => ({ model: Struct.evolve(model, { robot: () => outcome }) }),
    SettledTexture: ({ ready }) => ({ model: Struct.evolve(model, { textured: () => ready }) }),
    GotSceneLifecycle: ({ lifecycle }) => ({ model: lifecycleUpdate(model, lifecycle) }),
    GotReconciled: ({ updated }) => ({
      model: Struct.evolve(model, { lastUpdated: () => updated }),
    }),
  });

function update(model: Model, message: Message) {
  probe.updates++;
  return pureUpdate(model, message);
}

const cubeLabel = (model: Model, h: Html.H<Message>) => ({
  overlay: overlay({ key: 'cube-label', node: 'cube', position: [0, 1, 0], center: true }),
  content: h.span.attr('id', 'cube-label').children(model.colour),
});

/** A label above the cube, centred, in the cube's colour name, while switched on. */
const labelsFor = (model: Model, h: Html.H<Message>) =>
  Option.liftPredicate(model, (shown) => shown.label).pipe(
    Option.map((shown) => cubeLabel(shown, h)),
    Option.toArray,
  );

const sceneView = (model: Model, h: Html.H<Message>) =>
  EffectThreeUi.view(
    {
      scene: sceneFor(model.colour, model.size, model.motion, {
        robot: model.robot.startsWith('ready'),
        textured: model.textured,
        glow: model.glow,
        screen: model.screen,
        title: titleShown[model.font],
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

const buttons = (h: Html.H<Message>) =>
  [
    h.button.attr('id', 'colour').on('click', Message.ClickedToggleColour()).children('colour'),
    h.button.attr('id', 'visible').on('click', Message.ClickedToggleVisible()).children('visible'),
    h.button.attr('id', 'size').on('click', Message.ClickedToggleSize()).children('size'),
    h.button.attr('id', 'still').on('click', Message.ClickedToggleStill()).children('still'),
    h.button
      .attr('id', 'load-model')
      .on('click', Message.ClickedLoadModel())
      .children('load model'),
    h.button
      .attr('id', 'unload-model')
      .on('click', Message.ClickedUnloadModel())
      .children('unload'),
    h.button
      .attr('id', 'load-texture')
      .on('click', Message.ClickedLoadTexture())
      .children('texture'),
    h.button.attr('id', 'glow').on('click', Message.ClickedToggleGlow()).children('glow'),
    h.button.attr('id', 'screen').on('click', Message.ClickedToggleScreen()).children('screen'),
    h.button.attr('id', 'orbit').on('click', Message.ClickedToggleOrbit()).children('orbit'),
    h.button.attr('id', 'label').on('click', Message.ClickedToggleLabel()).children('label'),
    h.button.attr('id', 'load-font').on('click', Message.ClickedLoadFont()).children('font'),
  ] as const;

const diagnostics = (h: Html.H<Message>, model: Model) =>
  [
    h.p.attr('id', 'font').children(model.font),
    h.p.attr('id', 'camera').children(cameraReadout(model.orbit)),
    h.p.attr('id', 'robot').children(model.robot),
    h.p.attr('id', 'clicks').children(String(model.clicks)),
    h.p.attr('id', 'last-key').children(model.lastKey),
    h.p.attr('id', 'events').children(model.events.join(' ')),
    h.p.attr('id', 'moves').children(String(model.moves)),
    h.p.attr('id', 'started').children(String(model.started)),
    h.p.attr('id', 'failed').children(String(model.failed)),
    h.p.attr('id', 'last-updated').children(String(model.lastUpdated)),
  ] as const;

const view = (h: Html.H<Message>, model: Model) => {
  const scene = Option.liftPredicate(model, isVisible).pipe(
    Option.map((visible) => sceneView(visible, h)),
    Option.getOrNull,
  );
  return h.div.children(...buttons(h), ...diagnostics(h, model), scene);
};

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
  font: 'none',
};

const Fixture = Html.component({ name: 'SceneFixture', model: Model, message: Message }).make({
  init: () => initialModel,
  update: ($, message) => {
    const next = update($.model, message);
    return $.set(next.model).run(...(next.commands ?? []));
  },
  view,
});

const root = document.getElementById('root') ?? document.body;
const browser = BrowserHost.mount(Fixture, {}, root);
Effect.runFork(Layer.launch(browser));
