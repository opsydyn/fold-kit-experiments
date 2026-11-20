import { updateEditor, type EditorEvent, type EditorState } from '@opsydyn/foldkit-zloz';
import { Effect, Schema, Stream } from 'effect';
import { Dom, Render, Runtime } from 'foldkit';
import * as Command from 'foldkit/command';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import * as Subscription from 'foldkit/subscription';
import type { Return } from 'foldkit/update';

import { boardView, fit, graphFor, boardEditor } from './board';
import { clientPaths } from './client-paths';
import {
  initialScene,
  mayMove,
  type BackdropJob,
  type PartyLedgerEntry,
  seatNames,
  type Participant,
  type RoomView,
} from './contracts';
import {
  initialLedger,
  LedgerMessage,
  ledgerView,
  loadLedger,
  settleLedger,
  updateLedger,
  type LedgerModel,
} from './ledger';
import { partyLedgerView } from './party-ledger';

const { authoringUrl, baseArt } = clientPaths();
const table = document.getElementById('questmancer');
const seat = table?.dataset.seat;
const participant: Participant =
  seat === 'mira' || seat === 'brasswick' || seat === 'wicket'
    ? { role: 'player', seat, joined: true }
    : { role: 'dm', joined: true };
const { role } = participant;
const Instructions =
  'Drag an available token, or focus it and use the arrow keys. Drag the scene to pan. Scroll to zoom.';

type StartRequest = { id: string; prompt: string };
type BackdropRequest = StartRequest & { kind: 'backdrop'; title: string };
type BackdropComposer = Readonly<{
  title: string;
  prompt: string;
  attempt: BackdropRequest | null;
  action: 'idle' | 'starting' | 'revealing';
  status: string;
}>;
type Model = Readonly<{
  editor: EditorState;
  room: RoomView | null;
  prompt: string;
  attempt: StartRequest | null;
  busy: boolean;
  status: string;
  backdropComposer: BackdropComposer;
  ledger: LedgerModel;
  partyEntries: readonly PartyLedgerEntry[] | null;
  partyRefreshFailed: boolean;
  dragVersion: number | null;
  movement: 'idle' | 'sending' | number;
}>;
// SAFETY: Runtime stores the in-memory Model supplied by this module. No wire data is treated as the full Model.
const ModelSchema = Schema.Unknown as Schema.Codec<Model>;
const Message = defineMessageUnion({
  ObservedBoardInput: { input: Schema.Unknown },
  ObservedRoom: { result: Schema.Unknown },
  ChangedPrompt: { prompt: Schema.String },
  ClickedGenerate: {},
  ClickedApply: { id: Schema.String },
  ChangedBackdropTitle: { title: Schema.String },
  ChangedBackdropPrompt: { prompt: Schema.String },
  ClickedGenerateBackdrop: {},
  ClickedReveal: { id: Schema.String, style: Schema.Literals(['plain', 'generated']) },
  ClickedFitScene: {},
  ObservedLedgerInput: { message: LedgerMessage },
  ObservedPartyLedger: { result: Schema.Unknown },
  CompletedLedgerFocus: {},
  SettledAction: { action: Schema.String, result: Schema.Unknown },
});
type Message = typeof Message.Type;

type ApiResult = { status: number; value: Schema.Json };
async function request(
  action: string,
  signal: AbortSignal,
  payload?: Schema.Json,
): Promise<ApiResult> {
  const base = { cache: 'no-store', signal } satisfies RequestInit;
  const options =
    payload === null || payload === undefined
      ? base
      : {
          ...base,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        };
  return fetch(authoringUrl + action, options)
    .then(async (response) => ({
      status: response.status,
      value: Schema.decodeUnknownSync(Schema.Json)(await response.json()),
    }))
    .catch(() => ({ status: 0, value: null }));
}

const Send = Command.define('Send', {
  args: { action: Schema.String, payload: Schema.Json },
  messages: [Message.SettledAction],
  execute: ({ action, payload }) =>
    Effect.promise((signal) =>
      request(action === 'backdropJobs' ? 'jobs' : action, signal, payload),
    ).pipe(Effect.map((result) => Message.SettledAction({ action, result }))),
});
const FocusLedger = Command.define('FocusLedger', {
  args: { selector: Schema.String },
  messages: [Message.CompletedLedgerFocus],
  execute: ({ selector }) =>
    Render.afterCommit.pipe(
      Effect.andThen(Dom.focus(selector, { makeFocusable: true })),
      Effect.catchTag('ElementNotFound', () => Effect.void),
      Effect.map(() => Message.CompletedLedgerFocus()),
    ),
});
const subscriptions = Subscription.make<Model, Message>()(() => {
  const board = Subscription.persistentEntry(
    Stream.tick(300).pipe(
      Stream.mapEffect(() => Effect.promise((signal) => request('room', signal))),
      Stream.map((result) => Message.ObservedRoom({ result })),
    ),
  );
  const partyLedger = Subscription.persistentEntry(
    Stream.tick(600).pipe(
      Stream.mapEffect(() => Effect.promise((signal) => request('party-ledger', signal))),
      Stream.map((result) => Message.ObservedPartyLedger({ result })),
    ),
  );
  return Object.assign({ board }, role === 'player' ? { partyLedger } : undefined);
});

const init = (): Return<Model, Message> => ({
  model: {
    editor: boardEditor(initialScene),
    room: null,
    prompt: '',
    attempt: null,
    busy: false,
    status: '',
    backdropComposer: { title: '', prompt: '', attempt: null, action: 'idle', status: '' },
    ledger: initialLedger,
    partyEntries: null,
    partyRefreshFailed: false,
    dragVersion: null,
    movement: 'idle',
  },
  commands: role === 'dm' ? [Send(loadLedger)] : [],
});

function reconcile(model: Model): Model {
  const { room, editor, movement } = model;
  if (
    !room ||
    editor.gesture.type !== 'idle' ||
    movement === 'sending' ||
    (movement !== 'idle' && room.version < movement)
  )
    return model;
  const stillSame = editor.graph.nodes.every((node) => {
    const token = room.tokens.find(({ id }) => id === node.id);
    return token?.x === node.position.x && token?.y === node.position.y;
  });
  return {
    ...model,
    movement: 'idle',
    editor: stillSame ? editor : { ...editor, graph: graphFor(room) },
  };
}

const ErrorResponse = Schema.Struct({ error: Schema.String });
const resultError = (value: Schema.Json) =>
  Schema.is(ErrorResponse)(value) ? value.error : 'Connection interrupted. Try again.';

function update(model: Model, message: Message): Return<Model, Message> {
  return Message.match(message, {
    ObservedRoom: ({ result }) => {
      // SAFETY: Only the local request command or subscription constructs this result.
      const reply = result as ApiResult;
      if (reply.status !== 200)
        return {
          model: reply.status === 401 ? { ...model, status: 'Join the room again.' } : model,
        };
      // SAFETY: The successful room endpoint returns the room projection.
      const room = reply.value as RoomView;
      if (room.version < (model.room?.version ?? -1)) return { model };
      return { model: reconcile({ ...model, room }) };
    },
    ObservedBoardInput: ({ input }) => {
      // SAFETY: The Zloz onEvent callback sends its EditorEvent directly to this message.
      const observed = input as EditorEvent;
      const event = observed.type === 'NodeSelected' ? { ...observed, additive: false } : observed;
      const start =
        event.type === 'NodeDragStarted' && model.editor.selectedNodes.length > 1
          ? updateEditor(model.editor, { type: 'NodeSelected', id: event.id, additive: false })
          : model.editor;
      const editor = updateEditor(start, event, {
        canMoveNode: (node) =>
          !model.room || model.movement !== 'idle' || !mayMove(participant, node.id)
            ? 'You cannot move this token right now.'
            : null,
      });
      const measured =
        event.type === 'SurfaceMeasured' &&
        (event.size.width !== model.editor.surface?.width ||
          event.size.height !== model.editor.surface?.height);
      if (measured) return { model: { ...model, editor: fit(editor, event.size) } };
      if (event.type === 'NodeDragStarted') {
        const token = model.room?.tokens.find(({ id }) => id === event.id);
        return { model: { ...model, editor, dragVersion: token?.positionVersion ?? null } };
      }
      if (
        event.type !== 'PointerReleased' &&
        event.type !== 'SelectionNudged' &&
        event.type !== 'GestureCancelled'
      ) {
        return { model: { ...model, editor } };
      }
      const started = model.editor.gesture;
      const id =
        event.type === 'SelectionNudged'
          ? (event.id ?? editor.selectedNodes[0])
          : event.type === 'PointerReleased' && started.type === 'node-drag'
            ? started.ids[0]
            : undefined;
      const token = model.room?.tokens.find((entry) => entry.id === id);
      const next = editor.graph.nodes.find((node) => node.id === id);
      const updated = { ...model, editor, dragVersion: null };
      if (
        !token ||
        !next ||
        editor.gesture.type !== 'idle' ||
        !mayMove(participant, token.id) ||
        (token.x === next.position.x && token.y === next.position.y)
      ) {
        return { model: reconcile(updated) };
      }
      return {
        model: { ...updated, movement: 'sending' as const },
        commands: [
          Send({
            action: 'move',
            payload: {
              id: token.id,
              x: Math.max(0, Math.min(1440, next.position.x)),
              y: Math.max(0, Math.min(746, next.position.y)),
              expected:
                event.type === 'PointerReleased'
                  ? (model.dragVersion ?? token.positionVersion)
                  : token.positionVersion,
            },
          }),
        ],
      };
    },
    ChangedPrompt: ({ prompt }) => ({ model: { ...model, prompt, attempt: null } }),
    ClickedGenerate: () => {
      if (
        role !== 'dm' ||
        model.busy ||
        awaitingGeneration(model) ||
        model.prompt.trim().length < 3
      ) {
        return { model };
      }
      const attempt = model.attempt ?? { id: crypto.randomUUID(), prompt: model.prompt.trim() };
      return {
        model: { ...model, busy: true, attempt, status: 'Starting generation…' },
        commands: [Send({ action: 'jobs', payload: attempt })],
      };
    },
    ClickedApply: ({ id }) => ({
      model: { ...model, busy: true, status: 'Applying sprite…' },
      commands: [Send({ action: 'apply', payload: { id } })],
    }),
    ChangedBackdropTitle: ({ title }) => ({
      model: { ...model, backdropComposer: { ...model.backdropComposer, title, attempt: null } },
    }),
    ChangedBackdropPrompt: ({ prompt }) => ({
      model: { ...model, backdropComposer: { ...model.backdropComposer, prompt, attempt: null } },
    }),
    ClickedGenerateBackdrop: () => {
      if (role !== 'dm' || !canGenerateBackdrop(model)) return { model };
      const composer = model.backdropComposer;
      const attempt = composer.attempt ?? {
        id: crypto.randomUUID(),
        kind: 'backdrop',
        title: composer.title.trim(),
        prompt: composer.prompt.trim(),
      };
      return {
        model: {
          ...model,
          backdropComposer: { ...composer, attempt, action: 'starting' as const, status: '' },
        },
        commands: [Send({ action: 'backdropJobs', payload: attempt })],
      };
    },
    ClickedReveal: ({ id, style }) => {
      const room = model.room;
      const job = room?.backdropJob;
      const composer = model.backdropComposer;
      if (
        role !== 'dm' ||
        !room ||
        !job ||
        job.id !== id ||
        composer.action !== 'idle' ||
        !targetsCurrentRoom(room, job)
      )
        return { model };
      if (
        (style === 'generated' && job.status !== 'ready') ||
        (style === 'plain' && (job.plainVersion !== undefined || job.status === 'applied'))
      )
        return { model };
      return {
        model: {
          ...model,
          backdropComposer: { ...composer, action: 'revealing' as const, status: '' },
        },
        commands: [Send({ action: 'reveal', payload: { id, style } })],
      };
    },
    ClickedFitScene: () => ({
      model: { ...model, editor: fit(model.editor, model.editor.surface) },
    }),
    ObservedLedgerInput: ({ message }) => {
      if (role !== 'dm') return { model };
      const ledger = updateLedger(model.ledger, message);
      const focus =
        ledger.model.partyDraft?.stage !== model.ledger.partyDraft?.stage
          ? ledger.model.partyDraft?.stage === 'previewing'
            ? '#party-preview-heading'
            : ledger.model.partyDraft
              ? '#party-entry-title'
              : '#party-publication-heading'
          : null;
      return {
        model: { ...model, ledger: ledger.model },
        ...(ledger.request
          ? { commands: [Send(ledger.request)] }
          : focus
            ? { commands: [FocusLedger({ selector: focus })] }
            : {}),
      };
    },
    ObservedPartyLedger: ({ result }) => {
      // SAFETY: Only the local request command or subscription constructs this result.
      const reply = result as ApiResult;
      return reply.status === 200
        ? {
            model: {
              ...model,
              // SAFETY: The successful party endpoint returns the array of published entries.
              partyEntries: reply.value as PartyLedgerEntry[],
              partyRefreshFailed: false,
            },
          }
        : { model: { ...model, partyRefreshFailed: true } };
    },
    CompletedLedgerFocus: () => ({ model }),
    SettledAction: ({ action, result }) => {
      // SAFETY: Only the local request command or subscription constructs this result.
      const reply = result as ApiResult;
      if (
        action === 'ledger' ||
        action === 'ledger-capture' ||
        action === 'ledger-edit' ||
        action === 'ledger-publish'
      )
        return {
          model: { ...model, ledger: settleLedger(model.ledger, action, reply, resultError) },
        };
      if (action === 'backdropJobs' || action === 'reveal') {
        const composer = model.backdropComposer;
        const accepted = reply.status >= 200 && reply.status < 300;
        return {
          model: {
            ...model,
            backdropComposer: {
              ...(accepted && action === 'backdropJobs'
                ? { title: '', prompt: '', attempt: null }
                : composer),
              action: 'idle' as const,
              status: accepted ? '' : resultError(reply.value),
            },
          },
        };
      }
      if (action === 'move') {
        // SAFETY: The successful move endpoint returns a version receipt.
        const movement =
          reply.status === 200 ? (reply.value as { version: number }).version : 'idle';
        return {
          model: reconcile({
            ...model,
            movement,
            status: reply.status === 200 ? model.status : resultError(reply.value),
          }),
        };
      }
      if (reply.status >= 200 && reply.status < 300) {
        if (action === 'jobs')
          // SAFETY: A successful sprite job submission returns a sprite job.
          return {
            model: {
              ...model,
              busy: false,
              status: '',
              prompt: '',
              attempt: null,
              room: model.room ? { ...model.room, job: reply.value as RoomView['job'] } : null,
            },
          };
        return { model: { ...model, busy: false, status: 'Sprite applied.' } };
      }
      return { model: { ...model, busy: false, status: resultError(reply.value) } };
    },
  });
}

function awaitingGeneration(model: Model) {
  return model.room?.job?.status === 'pending' && model.room.job.id !== model.attempt?.id;
}

function targetsCurrentRoom(room: RoomView, job: BackdropJob) {
  return room.backdrop.revision === job.artVersion || room.backdrop.revision === job.plainVersion;
}

function canGenerateBackdrop(model: Model) {
  const composer = model.backdropComposer;
  const job = model.room?.backdropJob;
  return (
    composer.action === 'idle' &&
    composer.title.trim().length > 0 &&
    composer.prompt.trim().length >= 3 &&
    (job?.status !== 'pending' || job.id === composer.attempt?.id)
  );
}

function backdropPanel(model: Model, room: RoomView, h: HtmlBuilder<Message>) {
  const composer = model.backdropComposer;
  const job = room.backdropJob;
  const current = job && targetsCurrentRoom(room, job);
  const plain = current && job.plainVersion !== undefined && room.backdrop.style === 'plain';
  const canRevealPlain = current && job.status !== 'applied' && job.plainVersion === undefined;
  const canRevealArt = current && job.status === 'ready';
  const busy = composer.action !== 'idle';
  const preview = job?.status === 'ready' ? authoringUrl + 'preview/' + job.id : null;
  return h.section(
    [h.Class('sprite-panel backdrop-panel'), h.AriaLabelledBy('backdrop-heading')],
    [
      h.h2([h.Id('backdrop-heading')], ['Next room']),
      h.label([h.For('backdrop-title')], ['Room name']),
      h.input([
        h.Id('backdrop-title'),
        h.Type('text'),
        h.Maxlength(72),
        h.Placeholder('The Lantern Vault'),
        h.Value(composer.title),
        h.Disabled(busy),
        h.OnInput((title) => Message.ChangedBackdropTitle({ title })),
      ]),
      h.label([h.For('backdrop-prompt')], ['Describe the backdrop']),
      h.textarea([
        h.Id('backdrop-prompt'),
        h.Rows(3),
        h.Maxlength(400),
        h.Placeholder('An underground vault with floating lanterns and violet stone'),
        h.Value(composer.prompt),
        h.Disabled(busy),
        h.OnInput((prompt) => Message.ChangedBackdropPrompt({ prompt })),
      ]),
      h.button(
        [
          h.Type('button'),
          h.Class('primary'),
          h.Disabled(!canGenerateBackdrop(model)),
          h.OnClick(Message.ClickedGenerateBackdrop()),
        ],
        ['Prepare sample backdrop'],
      ),

      h.p(
        [h.Role('status'), h.Class('backdrop-status')],
        [
          composer.action === 'starting'
            ? 'Starting backdrop generation…'
            : composer.action === 'revealing'
              ? 'Updating the board…'
              : job?.status === 'pending'
                ? 'Generating backdrop… You can keep playing.'
                : job?.status === 'applied' && room.backdrop.revision === job.version
                  ? 'The backdrop is visible to the party.'
                  : '',
        ],
      ),
      ...(composer.status ? [h.p([h.Role('alert')], [composer.status])] : []),
      ...(job && job.status !== 'applied'
        ? [
            h.div(
              [h.Class('draft backdrop-draft')],
              [
                h.strong([], [plain ? job.title : 'Private draft · ' + job.title]),
                ...(preview
                  ? [
                      h.img([h.Src(preview), h.Alt('Draft backdrop for ' + job.title)]),
                      h.a(
                        [h.Href(preview), h.Target('_blank'), h.Rel('noopener')],
                        ['Open full image (new tab)'],
                      ),
                    ]
                  : []),
                ...(job.status === 'failed'
                  ? [
                      h.p(
                        [h.Role('alert')],
                        [
                          'Backdrop generation failed. You can use a plain board or try another description.',
                        ],
                      ),
                    ]
                  : []),
                ...(!current
                  ? [
                      h.p(
                        [],
                        ['The party has moved on. Generate a new backdrop to reveal another room.'],
                      ),
                    ]
                  : []),
              ],
            ),
          ]
        : []),
      ...(canRevealArt
        ? [
            h.button(
              [
                h.Type('button'),
                h.Class('primary'),
                h.Disabled(busy),
                h.OnClick(Message.ClickedReveal({ id: job.id, style: 'generated' })),
              ],
              [plain ? 'Add backdrop to room' : 'Reveal room'],
            ),
          ]
        : []),
      ...(canRevealPlain
        ? [
            h.button(
              [
                h.Type('button'),
                h.Class('secondary'),
                h.Disabled(busy),
                h.OnClick(Message.ClickedReveal({ id: job.id, style: 'plain' })),
              ],
              ['Reveal without art'],
            ),
          ]
        : []),
    ],
  );
}

function spritePanel(model: Model, h: HtmlBuilder<Message>) {
  const job = model.room?.job;
  return h.aside(
    [h.Class('sprite-panel')],
    [
      h.h2([], ['Pip’s artwork']),
      h.label([h.For('sprite-prompt')], ['Describe the sprite']),
      h.textarea([
        h.Id('sprite-prompt'),
        h.Rows(3),
        h.Maxlength(400),
        h.Placeholder('A rat courier in a plum coat carrying a brass lantern'),
        h.Value(model.prompt),
        h.Disabled(model.busy),
        h.OnInput((prompt) => Message.ChangedPrompt({ prompt })),
      ]),
      h.button(
        [
          h.Type('button'),
          h.Class('primary'),
          h.Disabled(model.busy || awaitingGeneration(model) || model.prompt.trim().length < 3),
          h.OnClick(Message.ClickedGenerate()),
        ],
        ['Prepare sample sprite'],
      ),
      ...(job?.status === 'pending'
        ? [h.p([h.Role('status')], ['Generating… You can keep playing.'])]
        : []),
      ...(job?.status === 'failed'
        ? [
            h.p(
              [h.Role('alert')],
              ['Generation failed. Pip’s current artwork is still on the board.'],
            ),
          ]
        : []),
      ...(job?.status === 'ready'
        ? [
            h.div(
              [h.Class('draft')],
              [
                h.img([h.Src(authoringUrl + 'preview/' + job.id), h.Alt('Draft sprite of Pip')]),
                h.div([], [h.strong([], ['Private draft']), h.p([], [job.prompt])]),
              ],
            ),
            h.button(
              [
                h.Type('button'),
                h.Class('primary'),
                h.Disabled(model.busy),
                h.OnClick(Message.ClickedApply({ id: job.id })),
              ],
              ['Apply to Pip'],
            ),
          ]
        : []),
      ...(job?.status === 'applied'
        ? [h.p([h.Role('status')], ['Pip’s artwork is visible to the party.'])]
        : []),
    ],
  );
}

function view(model: Model, h: HtmlBuilder<Message>): Document {
  const backdrop = model.room?.backdrop ?? initialScene.backdrop;
  const backdropUrl =
    backdrop.style === 'generated'
      ? authoringUrl + 'assets/' + backdrop.assetId
      : baseArt + 'aurora-gate.jpg';
  return {
    title: backdrop.title + ' · Questmancer',
    body: h.main(
      [h.Class('tabletop live')],
      [
        h.header(
          [h.Class('scene-header')],
          [
            h.div(
              [h.Class('scene-heading')],
              [
                h.p([h.Class('brand')], ['Questmancer · ' + (role === 'dm' ? 'DM' : 'Player')]),
                h.h1([], [backdrop.title]),
                h.p(
                  [h.Role('status'), h.Class('scene-announcement')],
                  [
                    backdrop.style === 'generated'
                      ? backdrop.title + ' backdrop revealed.'
                      : backdrop.style === 'plain'
                        ? backdrop.title + ' revealed on a plain board.'
                        : '',
                  ],
                ),
              ],
            ),
            h.div(
              [h.Class('scene-actions')],
              [
                ...(model.room ? [h.a([h.Href('#librarians-ledger')], ['Ledger'])] : []),
                h.button([h.Type('button'), h.OnClick(Message.ClickedFitScene())], ['Fit scene']),
              ],
            ),
          ],
        ),
        h.div(
          [h.Class('live-layout')],
          [
            h.div(
              [],
              [
                boardView(h, model.editor, {
                  id: 'aurora-gate-live',
                  title: backdrop.title,
                  backdrop: backdrop.style === 'plain' ? null : backdropUrl,
                  instructions: Instructions,
                  onEvent: (input) => Message.ObservedBoardInput({ input }),
                  canMoveNode: (node) =>
                    !model.room || model.movement !== 'idle' || !mayMove(participant, node.id)
                      ? 'You cannot move this token right now.'
                      : null,
                  artFor: (id) => {
                    const token = model.room?.tokens.find((entry) => entry.id === id);
                    return token?.assetId
                      ? authoringUrl + 'assets/' + token.assetId
                      : baseArt + id + '.png';
                  },
                }),
                h.footer(
                  [h.Class('scene-footer')],
                  [
                    h.p(
                      [],
                      [
                        participant.role === 'player'
                          ? 'You control ' + seatNames[participant.seat] + '. ' + Instructions
                          : Instructions,
                      ],
                    ),
                  ],
                ),
                h.p([h.Role('status'), h.Class('room-status')], [model.status]),
                ...(role === 'dm' && model.room
                  ? [
                      ledgerView(h, model.ledger, backdrop, (message) =>
                        Message.ObservedLedgerInput({ message }),
                      ),
                    ]
                  : []),
                ...(role === 'player' && model.room
                  ? [partyLedgerView(h, model.partyEntries, model.partyRefreshFailed)]
                  : []),
              ],
            ),
            ...(role === 'dm' && model.room
              ? [
                  h.div(
                    [h.Class('authoring-panel')],
                    [backdropPanel(model, model.room, h), spritePanel(model, h)],
                  ),
                ]
              : []),
          ],
        ),
      ],
    ),
  };
}

const container = document.getElementById('questmancer');
if (container)
  Runtime.run(
    Runtime.makeApplication({ container, Model: ModelSchema, init, update, view, subscriptions }),
  );
