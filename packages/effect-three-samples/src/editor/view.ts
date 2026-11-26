import { Mount, type View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import {
  describeScene,
  Lockstep,
  formatChanges,
  formatSummary,
  moodStaging,
  moods,
  History,
  Inspector,
  scene,
  sceneChanges,
  type SceneNode,
  SceneSchema,
} from '@opsydyn/effect-three';
import { BoxSelect } from '@opsydyn/effect-three-foldkit/browser';
import { Array as Arr, Effect, Match, Option } from 'effect';

import { inspectorView } from '../effect-ui-inspector';
import { EffectThreeStage, unlabelledSceneMount } from '../effect-ui-scene';
import { type Addable, addables } from './document';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';
import type { Relay } from './wire';

type H = Html.H<Message>;

const editorMount = Mount.make('ThreeEditorReady', { args: {} }, () =>
  Effect.succeed(Message.MountedEditor()),
);

const button = (h: H, label: string, enabled: boolean, message: Message) =>
  h.button
    .class('e3-button')
    .attr('type', 'button')
    .disabled(!enabled)
    .on('click', message)
    .children(label);

const toggle = (h: H, label: string, on: boolean, message: Message) =>
  button(h, label, true, message).attr('aria-pressed', String(on));

const addLabel = {
  crate: '+ Crate',
  box: '+ Box',
  ball: '+ Ball',
  cone: '+ Cone',
  ring: '+ Ring',
  light: '+ Light',
} as const satisfies Record<Addable, string>;

const modes = [
  ['translate', 'Move'],
  ['rotate', 'Turn'],
  ['scale', 'Scale'],
] as const;

const shots = [
  ['front', 'Front'],
  ['three-quarter', 'Three-quarter'],
  ['top', 'Top'],
  ['low', 'Low'],
] as const;

const moodLabel = {
  studio: 'Studio',
  daylight: 'Daylight',
  sunset: 'Sunset',
  night: 'Night',
} as const;

/** Shots of the selection (or everything) and lighting moods: the vocabulary agents use. */
const staging = (model: Model, h: H) =>
  h.div
    .class('e3-controls')
    .children(
      h.span.class('e3-controls-label').children('Shot'),
      ...shots.map(([angle, label]) =>
        button(h, label, true, Message.FramedShot({ subject: model.selected, angle })),
      ),
      h.span.class('e3-controls-label').children('Light'),
      ...moods.map((mood) =>
        toggle(h, moodLabel[mood], model.mood === mood, Message.ChoseMood({ mood })),
      ),
    );

/** The scene as an assistant reads it: the document, the camera and the mood's staging. */
const description = (model: Model, h: H) => {
  const mood = moodStaging(model.mood, 'editor');
  const shown = scene({
    camera: model.camera,
    environment: mood.environment,
    sky: mood.sky,
    resources: model.resources,
    children: model.nodes,
  });
  return panel(h, 'Describe', [
    h.pre.class('e3-changes').children(formatSummary(describeScene(shown))),
  ]);
};

/** Edits wait for a session: a tab still looking for others cannot make them yet. */
const canEdit = (model: Model): boolean => model.session._tag !== 'Joining';

const toolbar = (model: Model, h: H) =>
  h.div.class('e3-controls').children(
    ...addables.map((kind) =>
      button(h, addLabel[kind], canEdit(model), Message.ClickedAdd({ kind })),
    ),
    button(h, 'Duplicate', model.selected.length > 0, Message.ClickedDuplicate()),
    button(h, 'Delete', model.selected.length > 0, Message.ClickedDelete()),
    ...modes.map(([mode, label]) =>
      toggle(h, label, model.gizmo.gizmo.mode === mode, Message.ChoseMode({ mode })),
    ),
    toggle(h, 'Snap', model.snapping, Message.ClickedSnapping()),
    button(h, 'Undo', History.canUndo(model.history), Message.ClickedUndo()),
    button(h, 'Redo', History.canRedo(model.history), Message.ClickedRedo()),
    button(h, 'Save', true, Message.ClickedSave()),
    h.label.class('e3-button', 'e3-file').children(
      'Open…',
      h.input
        .attr('type', 'file')
        .attr('accept', '.json,application/json')
        .on('change', ({ files }) => Message.ChoseFiles({ files })),
    ),
  );

const panel = (h: H, title: string, children: View.Children<Message>, className = '') =>
  h.section
    .class(`e3-editor-panel ${className}`.trim())
    .attr('aria-label', title)
    .children(h.h3(title), ...children);

/** The document's nodes, one row each: what it is and its key; a click selects it. */
const outliner = (model: Model, h: H) =>
  panel(h, 'Scene', [
    h.ul.class('e3-outline').children(
      ...model.nodes.map((node) =>
        h.li.key(node.key).children(
          h.button
            .class('e3-outline-row')
            .attr('type', 'button')
            .attr('aria-pressed', String(model.selected.includes(node.key)))
            .on('click', Message.ClickedOutlined({ key: node.key }))
            .children(h.span.class('e3-outline-kind').children(node._tag), node.key),
        ),
      ),
    ),
  ]);

const inspectable = (node: SceneNode) =>
  Inspector.fields(SceneSchema.SceneNode, node).filter(
    (field) => field.path[0] !== 'key' && field.path[0] !== 'children',
  );

/** The one selected node's fields, from the scene's node schema. */
const inspector = (model: Model, h: H) => {
  const node =
    model.selected.length === 1
      ? Option.flatMap(Arr.head(model.selected), (key) =>
          Arr.findFirst(model.nodes, (each) => each.key === key),
        )
      : Option.none();
  return panel(
    h,
    'Inspector',
    [
      ...Option.match(node, {
        onNone: () => [h.p.class('e3-note').children('Select one thing to inspect it.')],
        onSome: (selected) => [
          h.p.class('e3-inspector-title').children(selected.key),
          inspectorView(h, inspectable(selected), (path, value) =>
            Message.EditedNode({ key: selected.key, path, value }),
          ),
        ],
      }),
      ...Option.match(model.issue, {
        onNone: () => [],
        onSome: (issue) => [h.p.class('e3-inspector-issue').attr('role', 'alert').children(issue)],
      }),
    ],
    'e3-editor-inspector',
  );
};

/** Every step, oldest first; steps off the present's line are other branches. */
const history = (model: Model, h: H) => {
  const line = new Set(
    History.pathTo(model.history, model.history.current).map((entry) => entry.id),
  );
  return panel(h, 'History', [
    h.ol.class('e3-history').children(
      ...model.history.entries.map((entry) =>
        h.li.key(String(entry.id)).children(
          h.button
            .class(line.has(entry.id) ? 'e3-step' : 'e3-step e3-step-branch')
            .attr('type', 'button')
            .attr('aria-current', entry.id === model.history.current ? 'step' : 'false')
            .on('click', Message.ClickedStep({ id: entry.id }))
            .children(entry.label),
        ),
      ),
    ),
  ]);
};

/** What changed since the document was last saved or opened, a line each. */
const changes = (model: Model, h: H) => {
  const result = sceneChanges(
    scene({ resources: model.resources, children: model.saved }),
    scene({ resources: model.resources, children: model.nodes }),
  );
  const text =
    result._tag === 'Changes'
      ? formatChanges(result.changes)
      : `Not a valid scene: ${result.error._tag}`;
  return panel(h, 'Since saved', [h.pre.class('e3-changes').children(text)]);
};

/** Who this tab is editing with: the tabs in its session now. */
const others = (lockstep: Lockstep.Lockstep<unknown>): number =>
  Lockstep.membersAt(lockstep, lockstep.turn).length - 1;

const withTabs = (count: number): string =>
  count === 0
    ? 'Editing alone. Open this page in another tab to edit together.'
    : `Editing with ${count} other ${count === 1 ? 'tab' : 'tabs'}.`;

const overRelay = (count: number, url: string): string =>
  count === 0
    ? `Editing alone, through the relay at ${url}. Open this address elsewhere to edit together.`
    : `Editing with ${count} other ${count === 1 ? 'editor' : 'editors'}, through the relay at ${url}.`;

const overTabs = (model: Model): string =>
  Match.valueTags(model.session, {
    Offline: () => 'Editing here only.',
    Joining: () => 'Looking for other editor tabs…',
    Live: ({ lockstep }) => withTabs(others(lockstep)),
  });

const throughRelay = (model: Model, relay: Relay): string => {
  if (relay.link === 'Lost') return `Not connected to the relay at ${relay.url}: editing alone.`;
  if (relay.link === 'Connecting') return `Connecting to the relay at ${relay.url}…`;
  return Match.valueTags(model.session, {
    Offline: () => 'Editing here only.',
    Joining: () => `Looking for other editors at ${relay.url}…`,
    Live: ({ lockstep }) => overRelay(others(lockstep), relay.url),
  });
};

const together = (model: Model): string =>
  Option.match(model.relay, {
    onNone: () => overTabs(model),
    onSome: (relay) => throughRelay(model, relay),
  });

/** Who this tab edits with, and a way back to the relay once it has lost it. */
const session = (model: Model, h: H) =>
  h.p
    .class('e3-note', 'e3-together')
    .attr('aria-live', 'polite')
    .children(
      together(model),
      ...(Option.exists(model.relay, (relay) => relay.link === 'Lost')
        ? [' ', button(h, 'Reconnect', true, Message.ClickedReconnect())]
        : []),
    );

const selection = (model: Model): string =>
  model.selected.length === 0
    ? 'Click something, or shift-drag to box several. Drag empty space to orbit.'
    : `${model.selected.join(', ')} selected. ${History.depth(model.history)} steps to undo.`;

const boxOutline = (model: Model, h: H) =>
  Option.match(BoxSelect.rectangle(model.box), {
    onNone: () => null,
    onSome: ({ left, top, width, height }) =>
      h.div
        .class('e3-select-box')
        .attr('aria-hidden', 'true')
        .style({ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` })
        .children(),
  });

export const view = (h: H, model: Model) =>
  h.div
    .class('e3-sample')
    .onMount(editorMount())
    .children(
      h.div.class('e3-select-area').children(
        EffectThreeStage(h)
          .class('e3-stage', 'e3-stage-tall')
          .on('scene-pointer-down', ({ key, path, ray }) =>
            Message.PressedScene({ key, path, origin: ray.origin, direction: ray.direction }),
          )
          .on('scene-drag', ({ ray }) =>
            Message.DraggedScene({ origin: ray.origin, direction: ray.direction }),
          )
          .on('scene-drag-end', Message.ReleasedScene())
          .on('scene-click', ({ key, path }) => Message.ClickedScene({ key, path }))
          .on('scene-pointer-missed', Message.ClickedNothing())
          .on('scene-pointer-enter', ({ key }) => Message.HoveredScene({ key }))
          .on('scene-pointer-leave', ({ key }) => Message.LeftScene({ key }))
          .on('scene-gesture', ({ gesture }) => Message.MadeGesture({ gesture }))
          .on('scene-gesture-end', Message.EndedGesture())
          .onMount(
            Mount.map(unlabelledSceneMount({ scene: sceneFor(model) }), (lifecycle) =>
              Message.ReceivedSceneLifecycle({ lifecycle }),
            ),
          )
          .children(),
        boxOutline(model, h),
      ),
      h.p.class('e3-readout').attr('aria-live', 'polite').children(selection(model)),
      session(model, h),
      toolbar(model, h),
      staging(model, h),
      h.div
        .class('e3-editor-panels')
        .children(
          outliner(model, h),
          inspector(model, h),
          history(model, h),
          changes(model, h),
          description(model, h),
        ),
    );
