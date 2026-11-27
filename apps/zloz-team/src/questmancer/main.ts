import { Command, Subscription, UiSchema } from '@effect/ui';
import { Html, HtmlCommand } from '@effect/ui/html';
import { updateEditor, type EditorState } from '@opsydyn/foldkit-zloz';
import { BrowserInput } from '@opsydyn/foldkit-zloz/effect-ui';
import { Effect, Schedule, Schema, Stream } from 'effect';

import { boardView } from './board';
import { boardEditor, fit, graphFor } from './board-state';
import { baseArt } from './client-paths';
import {
  initialScene,
  mayMove,
  type BackdropJob,
  type PartyLedgerEntry,
  seatNames,
  seats,
  type Participant,
  type RoomView,
  type RoomNotice,
} from './contracts';
import {
  initialLedger,
  partyPublicationHeading,
  partyPreviewHeading,
  partyTitleInput,
  LedgerMessage,
  ledgerView,
  loadLedger,
  settleLedger,
  updateLedger,
  type LedgerModel,
} from './ledger';
import { partyLedgerView } from './party-ledger';
import { roomSocket } from './room-socket';

const Props = Schema.Struct({
  authoringUrl: Schema.String,
  seat: Schema.NullOr(Schema.Literals(seats)),
});
type Props = typeof Props.Type;

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
  authoringUrl: string;
  participant: Participant;
  room: RoomView | null;
  connection: 'connecting' | 'live' | 'reconnecting' | 'denied';
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
// SAFETY: Astro hydration restores the JSON snapshot this component produced in init.
const ModelSchema = Schema.fromJsonString(Schema.Unknown) as Schema.Codec<Model, string>;
type Update = Readonly<{ model: Model; commands?: readonly Command.Command<Message>[] }>;
const Message = UiSchema.TaggedEnum({
  ObservedBoardInput: { input: BrowserInput },
  ObservedRoom: { result: Schema.Unknown },
  InterruptedRoomConnection: {},
  LostRoomAccess: {},
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
  ReflectedRoomTitle: {},
  SettledAction: { action: Schema.String, result: Schema.Unknown },
});
type Message = typeof Message.Type;

type ApiResult = { status: number; value: Schema.Json };
async function request(
  authoringUrl: string,
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

const Send = Command.make(
  'QuestmancerSend',
  { args: { authoringUrl: Schema.String, action: Schema.String, payload: Schema.Json } },
  ({ authoringUrl, action, payload }) =>
    Effect.promise((signal) =>
      request(authoringUrl, action === 'backdropJobs' ? 'jobs' : action, signal, payload),
    ).pipe(Effect.map((result) => Message.SettledAction({ action, result }))),
);
const ReflectRoomTitle = Command.make(
  'QuestmancerReflectRoomTitle',
  { args: { title: Schema.String } },
  ({ title }) =>
    Effect.sync(() => {
      document.title = title + ' · Questmancer';
      return Message.ReflectedRoomTitle();
    }),
);
const denied = ({ status }: ApiResult) => status === 401 || status === 403 || status === 404;
function readRoomUpdate(authoringUrl: string, view: RoomNotice | 'access') {
  const path = view === 'access' ? 'room' : view;
  const read = Effect.promise((signal) => request(authoringUrl, path, signal));
  return Stream.flatMap(Stream.fromEffect(read), (result): Stream.Stream<Message, number> => {
    if (denied(result)) return Stream.make(Message.LostRoomAccess());
    if (view === 'access') return Stream.empty;
    if (result.status !== 200) return Stream.fail(result.status);
    return Stream.make(
      view === 'room' ? Message.ObservedRoom({ result }) : Message.ObservedPartyLedger({ result }),
    );
  });
}

const roomUpdates = (authoringUrl: string, role: Participant['role']) => {
  const read = (view: RoomNotice | 'access') => readRoomUpdate(authoringUrl, view);
  return roomSocket(authoringUrl).pipe(
    Stream.flatMap((notice) => {
      if (notice !== 'connected') return read(notice);
      return role === 'player' ? Stream.concat(read('room'), read('party-ledger')) : read('room');
    }),
    Stream.catch(() => Stream.empty),
    Stream.concat(Stream.make(Message.InterruptedRoomConnection())),
    // Failed browser upgrades do not expose their HTTP status. Check access before retrying.
    Stream.concat(Stream.catch(read('access'), () => Stream.empty)),
    Stream.repeat(Schedule.spaced('1 second')),
    Stream.takeUntil(({ _tag }) => _tag === 'LostRoomAccess'),
  );
};

function init({ authoringUrl, seat }: Props): Update {
  const participant: Participant =
    seat === null ? { role: 'dm', joined: true } : { role: 'player', seat, joined: true };
  return {
    model: {
      authoringUrl,
      participant,
      editor: boardEditor(initialScene),
      room: null,
      connection: 'connecting',
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
    commands: participant.role === 'dm' ? [Send.make({ authoringUrl, ...loadLedger })] : [],
  };
}

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

function update(model: Model, message: Message): Update {
  const { participant, authoringUrl } = model;
  const { role } = participant;
  const send = (request: { action: string; payload: Schema.Json }) =>
    Send.make({ authoringUrl, ...request });
  return Message.match(message, {
    ObservedRoom: ({ result }) => {
      // SAFETY: The subscription emits this message only with a successful room response.
      const reply = result as ApiResult;
      // SAFETY: The successful room endpoint returns the room projection.
      const room = reply.value as RoomView;
      if (room.version < (model.room?.version ?? -1)) return { model };
      return { model: reconcile({ ...model, room, connection: 'live' }) };
    },
    InterruptedRoomConnection: (): Update => ({
      model: { ...model, connection: 'reconnecting', partyRefreshFailed: true },
    }),
    LostRoomAccess: (): Update => ({
      model: {
        ...model,
        connection: 'denied',
        room: null,
        editor: boardEditor(initialScene),
        partyEntries: null,
        ledger: initialLedger,
      },
    }),
    ObservedBoardInput: ({ input }) => {
      const observed = input;
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
          send({
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
        commands: [send({ action: 'jobs', payload: attempt })],
      };
    },
    ClickedApply: ({ id }) => ({
      model: { ...model, busy: true, status: 'Applying sprite…' },
      commands: [send({ action: 'apply', payload: { id } })],
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
        commands: [send({ action: 'backdropJobs', payload: attempt })],
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
        commands: [send({ action: 'reveal', payload: { id, style } })],
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
            ? HtmlCommand.focus(partyPreviewHeading, () => Message.CompletedLedgerFocus())
            : ledger.model.partyDraft
              ? HtmlCommand.focus(partyTitleInput, () => Message.CompletedLedgerFocus())
              : HtmlCommand.focus(partyPublicationHeading, () => Message.CompletedLedgerFocus())
          : null;
      return {
        model: { ...model, ledger: ledger.model },
        ...(ledger.request
          ? { commands: [send(ledger.request)] }
          : focus
            ? { commands: [focus] }
            : {}),
      };
    },
    ObservedPartyLedger: ({ result }) => {
      // SAFETY: The subscription emits this message only with a successful party Ledger response.
      const reply = result as ApiResult;
      return {
        model: {
          ...model,
          // SAFETY: The successful party endpoint returns the array of published entries.
          partyEntries: reply.value as PartyLedgerEntry[],
          partyRefreshFailed: false,
        },
      };
    },
    CompletedLedgerFocus: () => ({ model }),
    ReflectedRoomTitle: () => ({ model }),
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
          return {
            model: {
              ...model,
              busy: false,
              status: '',
              prompt: '',
              attempt: null,
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

function backdropPanel(model: Model, room: RoomView, h: Html.H<Message>) {
  const composer = model.backdropComposer;
  const job = room.backdropJob;
  const current = job && targetsCurrentRoom(room, job);
  const plain = current && job.plainVersion !== undefined && room.backdrop.style === 'plain';
  const canRevealPlain = current && job.status !== 'applied' && job.plainVersion === undefined;
  const canRevealArt = current && job.status === 'ready';
  const busy = composer.action !== 'idle';
  const preview = job?.status === 'ready' ? model.authoringUrl + 'preview/' + job.id : null;
  return h.section
    .class('sprite-panel backdrop-panel')
    .attr('aria-labelledby', 'backdrop-heading')
    .children(
      h.h2.id('backdrop-heading').children('Next room'),
      h.label.attr('for', 'backdrop-title').children('Room name'),
      h.input
        .id('backdrop-title')
        .attr('type', 'text')
        .attr('maxlength', String(72))
        .attr('placeholder', 'The Lantern Vault')
        .value(composer.title)
        .disabled(busy)
        .on('input', ({ value: title }) => Message.ChangedBackdropTitle({ title })),
      h.label.attr('for', 'backdrop-prompt').children('Describe the backdrop'),
      h.textarea
        .id('backdrop-prompt')
        .attr('rows', String(3))
        .attr('maxlength', String(400))
        .attr('placeholder', 'An underground vault with floating lanterns and violet stone')
        .value(composer.prompt)
        .disabled(busy)
        .on('input', ({ value: prompt }) => Message.ChangedBackdropPrompt({ prompt })),
      h.button
        .attr('type', 'button')
        .class('primary')
        .disabled(!canGenerateBackdrop(model))
        .on('click', Message.ClickedGenerateBackdrop())
        .children('Prepare sample backdrop'),
      h.p
        .attr('role', 'status')
        .class('backdrop-status')
        .children(
          composer.action === 'starting'
            ? 'Starting backdrop generation…'
            : composer.action === 'revealing'
              ? 'Updating the board…'
              : job?.status === 'pending'
                ? 'Generating backdrop… You can keep playing.'
                : job?.status === 'applied' && room.backdrop.revision === job.version
                  ? 'The backdrop is visible to the party.'
                  : '',
        ),
      ...(composer.status ? [h.p.attr('role', 'alert').children(composer.status)] : []),
      ...(job && job.status !== 'applied'
        ? [
            h.div
              .class('draft backdrop-draft')
              .children(
                h.strong.children(plain ? job.title : 'Private draft · ' + job.title),
                ...(preview
                  ? [
                      h.img.attr('src', preview).attr('alt', 'Draft backdrop for ' + job.title),
                      h.a
                        .attr('href', preview)
                        .attr('target', '_blank')
                        .attr('rel', 'noopener')
                        .children('Open full image (new tab)'),
                    ]
                  : []),
                ...(job.status === 'failed'
                  ? [
                      h.p
                        .attr('role', 'alert')
                        .children(
                          'Backdrop generation failed. You can use a plain board or try another description.',
                        ),
                    ]
                  : []),
                ...(!current
                  ? [
                      h.p.children(
                        'The party has moved on. Generate a new backdrop to reveal another room.',
                      ),
                    ]
                  : []),
              ),
          ]
        : []),
      ...(canRevealArt
        ? [
            h.button
              .attr('type', 'button')
              .class('primary')
              .disabled(busy)
              .on('click', Message.ClickedReveal({ id: job.id, style: 'generated' }))
              .children(plain ? 'Add backdrop to room' : 'Reveal room'),
          ]
        : []),
      ...(canRevealPlain
        ? [
            h.button
              .attr('type', 'button')
              .class('secondary')
              .disabled(busy)
              .on('click', Message.ClickedReveal({ id: job.id, style: 'plain' }))
              .children('Reveal without art'),
          ]
        : []),
    );
}

function spritePanel(model: Model, h: Html.H<Message>) {
  const job = model.room?.job;
  return h.aside.class('sprite-panel').children(
    h.h2.children('Pip’s artwork'),
    h.label.attr('for', 'sprite-prompt').children('Describe the sprite'),
    h.textarea
      .id('sprite-prompt')
      .attr('rows', String(3))
      .attr('maxlength', String(400))
      .attr('placeholder', 'A rat courier in a plum coat carrying a brass lantern')
      .value(model.prompt)
      .disabled(model.busy)
      .on('input', ({ value: prompt }) => Message.ChangedPrompt({ prompt })),
    h.button
      .attr('type', 'button')
      .class('primary')
      .disabled(model.busy || awaitingGeneration(model) || model.prompt.trim().length < 3)
      .on('click', Message.ClickedGenerate())
      .children('Prepare sample sprite'),
    ...(job?.status === 'pending'
      ? [h.p.attr('role', 'status').children('Generating… You can keep playing.')]
      : []),
    ...(job?.status === 'failed'
      ? [
          h.p
            .attr('role', 'alert')
            .children('Generation failed. Pip’s current artwork is still on the board.'),
        ]
      : []),
    ...(job?.status === 'ready'
      ? [
          h.div
            .class('draft')
            .children(
              h.img
                .attr('src', model.authoringUrl + 'preview/' + job.id)
                .attr('alt', 'Draft sprite of Pip'),
              h.div.children(h.strong.children('Private draft'), h.p.children(job.prompt)),
            ),
          h.button
            .attr('type', 'button')
            .class('primary')
            .disabled(model.busy)
            .on('click', Message.ClickedApply({ id: job.id }))
            .children('Apply to Pip'),
        ]
      : []),
    ...(job?.status === 'applied'
      ? [h.p.attr('role', 'status').children('Pip’s artwork is visible to the party.')]
      : []),
  );
}

function view(h: Html.H<Message>, model: Model) {
  const { authoringUrl, participant } = model;
  const { role } = participant;
  const backdrop = model.room?.backdrop ?? initialScene.backdrop;
  const backdropUrl =
    backdrop.style === 'generated'
      ? authoringUrl + 'assets/' + backdrop.assetId
      : baseArt + 'aurora-gate.jpg';
  return h.main.class('tabletop live').children(
    h.header.class('scene-header').children(
      h.div.class('scene-heading').children(
        h.p.class('brand').children('Questmancer · ' + (role === 'dm' ? 'DM' : 'Player')),
        h.h1.children(backdrop.title),
        h.p
          .attr('role', 'status')
          .class('scene-announcement')
          .children(
            backdrop.style === 'generated'
              ? backdrop.title + ' backdrop revealed.'
              : backdrop.style === 'plain'
                ? backdrop.title + ' revealed on a plain board.'
                : '',
          ),
      ),
      h.div
        .class('scene-actions')
        .children(
          ...(model.room ? [h.a.attr('href', '#librarians-ledger').children('Ledger')] : []),
          h.button
            .attr('type', 'button')
            .on('click', Message.ClickedFitScene())
            .children('Fit scene'),
        ),
    ),
    h.div.class('live-layout').children(
      h.div.children(
        boardView(h, model.editor, {
          id: 'aurora-gate-live',
          title: backdrop.title,
          backdrop: backdrop.style === 'plain' ? null : backdropUrl,
          descriptionId: 'questmancer-live-instructions',
          onInput: (input) => Message.ObservedBoardInput({ input }),
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
        h.footer
          .class('scene-footer')
          .children(
            h.p
              .id('questmancer-live-instructions')
              .children(
                participant.role === 'player'
                  ? 'You control ' + seatNames[participant.seat] + '. ' + Instructions
                  : Instructions,
              ),
          ),
        h.p.attr('role', 'status').class('room-status').children(model.status),
        h.p
          .attr('role', 'status')
          .class('room-status')
          .children(
            model.connection === 'reconnecting'
              ? 'Reconnecting to the room…'
              : model.connection === 'denied'
                ? 'Room access ended. Return to your team to join again.'
                : '',
          ),
        ...(role === 'dm' && model.room
          ? [
              ledgerView(h, model.ledger, backdrop, authoringUrl, (message) =>
                Message.ObservedLedgerInput({ message }),
              ),
            ]
          : []),
        ...(role === 'player' && model.room
          ? [partyLedgerView(h, model.partyEntries, model.partyRefreshFailed, authoringUrl)]
          : []),
      ),
      ...(role === 'dm' && model.room
        ? [
            h.div
              .class('authoring-panel')
              .children(backdropPanel(model, model.room, h), spritePanel(model, h)),
          ]
        : []),
    ),
  );
}

const roomTitle = (model: Model) => (model.room?.backdrop ?? initialScene.backdrop).title;

export const QuestmancerTable = Html.component({
  name: 'QuestmancerTable',
  props: Props,
  model: ModelSchema,
  message: Message,
}).make({
  init: ($) => {
    const initial = init($.props);
    return $.set(initial.model).run(...(initial.commands ?? []));
  },
  update: ($, message) => {
    const result = update($.model, message);
    const step = $.set(result.model).run(...(result.commands ?? []));
    return roomTitle(result.model) === roomTitle($.model)
      ? step
      : step.run(ReflectRoomTitle.make({ title: roomTitle(result.model) }));
  },
  subscriptions: ({ model }) => [
    model.connection !== 'denied' &&
      Subscription.make(
        'QuestmancerRoom',
        [model.authoringUrl, model.participant.role] as const,
        ([authoringUrl, role]) => roomUpdates(authoringUrl, role),
      ),
  ],
  view,
});
