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
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Array as Arr, Match, Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
import { type Addable, addables } from './document';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

type H = HtmlBuilder<Message>;

const button = (h: H, label: string, enabled: boolean, message: Message): Html =>
  h.button(
    [h.Class('e3-button'), h.Type('button'), h.Disabled(!enabled), h.OnClick(message)],
    [label],
  );

const toggle = (h: H, label: string, on: boolean, message: Message): Html =>
  h.button(
    [h.Class('e3-button'), h.Type('button'), h.AriaPressed(String(on)), h.OnClick(message)],
    [label],
  );

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
const staging = (model: Model, h: H): Html =>
  h.div(
    [h.Class('e3-controls')],
    [
      h.span([h.Class('e3-controls-label')], ['Shot']),
      ...shots.map(([angle, label]) =>
        button(h, label, true, Message.FramedShot({ subject: model.selected, angle })),
      ),
      h.span([h.Class('e3-controls-label')], ['Light']),
      ...moods.map((mood) =>
        toggle(h, moodLabel[mood], model.mood === mood, Message.ChoseMood({ mood })),
      ),
    ],
  );

/** The scene as an assistant reads it: the document, the camera and the mood's staging. */
const description = (model: Model, h: H): Html => {
  const mood = moodStaging(model.mood, 'editor');
  const shown = scene({
    camera: model.camera,
    environment: mood.environment,
    sky: mood.sky,
    resources: model.resources,
    children: model.nodes,
  });
  return panel(h, 'Describe', [
    h.pre([h.Class('e3-changes')], [formatSummary(describeScene(shown))]),
  ]);
};

/** Edits wait for a session: a tab still looking for others cannot make them yet. */
const canEdit = (model: Model): boolean => model.session._tag !== 'Joining';

const toolbar = (model: Model, h: H): Html =>
  h.div(
    [h.Class('e3-controls')],
    [
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
      h.label(
        [h.Class('e3-button e3-file')],
        [
          'Open…',
          h.input([
            h.Type('file'),
            h.Accept('.json,application/json'),
            h.OnFileChange((files) => Message.ChoseFiles({ files })),
          ]),
        ],
      ),
    ],
  );

const panel = (h: H, title: string, children: ReadonlyArray<Html>, className = ''): Html =>
  h.section(
    [h.Class(`e3-editor-panel ${className}`.trim()), h.AriaLabel(title)],
    [h.h3([], [title]), ...children],
  );

/** The document's nodes, one row each: what it is and its key; a click selects it. */
const outliner = (model: Model, h: H): Html =>
  panel(h, 'Scene', [
    h.ul(
      [h.Class('e3-outline')],
      model.nodes.map((node) =>
        h.keyed('li')(
          node.key,
          [],
          [
            h.button(
              [
                h.Class('e3-outline-row'),
                h.Type('button'),
                h.AriaPressed(String(model.selected.includes(node.key))),
                h.OnClick(Message.ClickedOutlined({ key: node.key })),
              ],
              [h.span([h.Class('e3-outline-kind')], [node._tag]), node.key],
            ),
          ],
        ),
      ),
    ),
  ]);

const inspectable = (node: SceneNode) =>
  Inspector.fields(SceneSchema.SceneNode, node).filter(
    (field) => field.path[0] !== 'key' && field.path[0] !== 'children',
  );

/** The one selected node's fields, from the scene's node schema. */
const inspector = (model: Model, h: H): Html => {
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
        onNone: () => [h.p([h.Class('e3-note')], ['Select one thing to inspect it.'])],
        onSome: (selected) => [
          h.p([h.Class('e3-inspector-title')], [selected.key]),
          EffectThreeFoldkit.inspectorView(h, inspectable(selected), (path, value) =>
            Message.EditedNode({ key: selected.key, path, value }),
          ),
        ],
      }),
      ...Option.match(model.issue, {
        onNone: () => [],
        onSome: (issue) => [h.p([h.Class('e3-inspector-issue'), h.Role('alert')], [issue])],
      }),
    ],
    'e3-editor-inspector',
  );
};

/** Every step, oldest first; steps off the present's line are other branches. */
const history = (model: Model, h: H): Html => {
  const line = new Set(
    History.pathTo(model.history, model.history.current).map((entry) => entry.id),
  );
  return panel(h, 'History', [
    h.ol(
      [h.Class('e3-history')],
      model.history.entries.map((entry) =>
        h.keyed('li')(
          String(entry.id),
          [],
          [
            h.button(
              [
                h.Class(line.has(entry.id) ? 'e3-step' : 'e3-step e3-step-branch'),
                h.Type('button'),
                h.AriaCurrent(entry.id === model.history.current ? 'step' : 'false'),
                h.OnClick(Message.ClickedStep({ id: entry.id })),
              ],
              [entry.label],
            ),
          ],
        ),
      ),
    ),
  ]);
};

/** What changed since the document was last saved or opened, a line each. */
const changes = (model: Model, h: H): Html => {
  const result = sceneChanges(
    scene({ resources: model.resources, children: model.saved }),
    scene({ resources: model.resources, children: model.nodes }),
  );
  const text =
    result._tag === 'Changes'
      ? formatChanges(result.changes)
      : `Not a valid scene: ${result.error._tag}`;
  return panel(h, 'Since saved', [h.pre([h.Class('e3-changes')], [text])]);
};

/** Who this tab is editing with: the tabs in its session now. */
const others = (lockstep: Lockstep.Lockstep<unknown>): number =>
  Lockstep.membersAt(lockstep, lockstep.turn).length - 1;

const withOthers = (count: number): string =>
  count === 0
    ? 'Editing alone. Open this page in another tab to edit together.'
    : `Editing with ${count} other ${count === 1 ? 'tab' : 'tabs'}.`;

const together = (model: Model): string =>
  Match.valueTags(model.session, {
    Offline: () => 'Editing here only.',
    Joining: () => 'Looking for other editor tabs…',
    Live: ({ lockstep }) => withOthers(others(lockstep)),
  });

const selection = (model: Model): string =>
  model.selected.length === 0
    ? 'Click something, or shift-drag to box several. Drag empty space to orbit.'
    : `${model.selected.join(', ')} selected. ${History.depth(model.history)} steps to undo.`;

const boxOutline = (model: Model, h: H): ReadonlyArray<Html> =>
  Option.match(EffectThreeFoldkit.BoxSelect.rectangle(model.box), {
    onNone: () => [],
    onSome: ({ left, top, width, height }) => [
      h.div(
        [
          h.Class('e3-select-box'),
          h.AriaHidden(true),
          h.Style({
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
          }),
        ],
        [],
      ),
    ],
  });

export const view = (model: Model, h: H): Document => ({
  title: 'Editor — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      h.div(
        [h.Class('e3-select-area')],
        [
          EffectThreeFoldkit.view(
            {
              scene: sceneFor(model),
              mount: sceneMount,
              className: 'e3-stage e3-stage-tall',
              onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
              onPointerDown: ({ key, path, ray }) =>
                Message.PressedScene({ key, path, origin: ray.origin, direction: ray.direction }),
              onDrag: ({ ray }) =>
                Message.DraggedScene({ origin: ray.origin, direction: ray.direction }),
              onDragEnd: () => Message.ReleasedScene(),
              onClick: ({ key, path }) => Message.ClickedScene({ key, path }),
              onPointerMissed: () => Message.ClickedNothing(),
              onPointerEnter: ({ key }) => Message.HoveredScene({ key }),
              onPointerLeave: ({ key }) => Message.LeftScene({ key }),
              onGesture: (gesture) => Message.MadeGesture({ gesture }),
              onGestureEnd: () => Message.EndedGesture(),
            },
            h,
          ),
          ...boxOutline(model, h),
        ],
      ),
      h.p([h.Class('e3-readout'), h.AriaLive('polite')], [selection(model)]),
      h.p([h.Class('e3-note e3-together'), h.AriaLive('polite')], [together(model)]),
      toolbar(model, h),
      staging(model, h),
      h.div(
        [h.Class('e3-editor-panels')],
        [
          outliner(model, h),
          inspector(model, h),
          history(model, h),
          changes(model, h),
          description(model, h),
        ],
      ),
    ],
  ),
});
