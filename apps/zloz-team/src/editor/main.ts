import { Command, Subscription, UiSchema, type View } from '@effect/ui';
import { Html } from '@effect/ui/html';
import {
  createEditor,
  decideOperation,
  projectAggregate,
  resolveEventStormingRelationship,
  updateEditor,
} from '@opsydyn/foldkit-zloz';
import type {
  EditorEvent,
  EditorState,
  ZlozGraph,
  ZlozNode,
  ZlozGraphOperation,
  ZlozOperationReceipt,
  ZlozOperationRequest,
  ZlozSvgReviewRequest,
  ZlozEditionPlaybackEvent,
} from '@opsydyn/foldkit-zloz';
import { applyDiagramDelta, DiagramFeedSchema } from '@opsydyn/foldkit-zloz-alchemy/delta';
import { operationHash } from '@opsydyn/foldkit-zloz-alchemy/hash';
import {
  beginEdit,
  prepareEdit,
  DiagramSessionSchema,
  DiagramDocumentSchema,
  DiagramRequestSchema,
  isDiagramFrame,
  isDiagramReply,
  newSession,
  receiveFrame,
  receiveReply,
  sameTarget,
  unknownEdit,
} from '@opsydyn/foldkit-zloz-alchemy/session';
import type { DiagramSession, DiagramRoom } from '@opsydyn/foldkit-zloz-alchemy/session';
import {
  canvasStatusContext,
  graphSurface,
  historyMinimap,
  resolveConnectionList,
  svgReview,
  viewportControl,
  viewportControlActions,
} from '@opsydyn/foldkit-zloz/effect-ui';
import { BoardTitle } from '@opsydyn/zloz-server/src/team-contract';
import { Effect, Option, Schema, Stream } from 'effect';

import { teamCanvasTheme } from '../appearance/canvas';
import { teamIcon } from '../appearance/icons';
import { publishTitle, titleChanges } from '../board-settings/channel';
import * as DiagramImport from '../likec4/board';
import { requestLimit } from '../likec4/review';
import { aggregateViewContent } from './aggregate-view';
import * as Assessment from './assessment';
import { bridgeEvent, isAuthoredGesture } from './bridge';
import { boardWidths, historyMotion, historyVisibility } from './browser-signals';
import { view as couplingView } from './coupling/effect-ui';
import { Message as CouplingMessage, OutMessage as CouplingOutMessage } from './coupling/message';
import * as Coupling from './coupling/model';
import { observe as observeCoupling, update as updateCoupling } from './coupling/update';
import { revealEdgeStrokes, introducedEdges } from './edge-motion';
import * as Evolution from './evolution';
import { view as evolutionView, type Perspective as EvolutionPerspective } from './evolution-view';
import {
  Connection,
  ReconnectDelay,
  SocketSlot,
  boardFeedBinding,
  isLiveConnection,
  otherSlot,
} from './feed-state';
import { findMatches, FindTarget } from './find';
import * as HistoryReview from './history-review';
import { createConnectionsView } from './native-connections';
import { nodeShell } from './native-node-shell';
import * as Opy from './opy';
import { geometryGraph, pendingGeometryGraph } from './pending-geometry';
import { deltaStream, liveStream, pathFor } from './protocol';
import {
  advanceGestureBase,
  advanceQueuedMove,
  appendMove,
  isGeometryOperation,
  QueuedMove,
} from './queued-move';
import * as Layout from './selection-layout';
import { shareFrame } from './share-frame';
import * as SourceExport from './source-export';
import * as Svg from './svg-export';
import * as TeamIcons from './team-icons';
import {
  changedHotspots,
  createWorkshopNote,
  hotspotStatus,
  revealHotspots,
  workshopNotes,
  WorkshopRole,
  WorkshopStatus,
} from './workshop';
import { journey, journeyTriggerId, journeyView } from './workshop-journey';

const Role = Schema.Literals(['owner', 'editor', 'viewer']);
const CanvasEmphasis = Schema.Literals(['c4', 'ddd', 'event-storming', 'neutral']);
const canvasModeLabels = {
  c4: 'C4 view',
  ddd: 'DDD view',
  'event-storming': 'Event Storming',
  neutral: 'Neutral view',
} satisfies Record<typeof CanvasEmphasis.Type, string>;
const Inspector = Schema.Literals([
  'selection',
  'coupling',
  'aggregate',
  'evolution',
  'opy',
  'journey',
]);
const Rail = Schema.Literals(['tools', 'inspector']);
const BoardCommand = Schema.Literals(['File', 'Edit', 'View', 'Arrange', 'Help', 'History']);
type BoardCommand = typeof BoardCommand.Type;
const triggerId = (name: BoardCommand) =>
  name === 'History' ? 'board-history-toggle' : `board-menu-${name.toLowerCase()}-toggle`;
export const Props = Schema.Struct({
  startingView: Schema.optional(CanvasEmphasis),
  teamId: Schema.String,
  diagramId: Schema.String,
  actorId: Schema.String,
  role: Role,
  name: Schema.String,
  nameRevision: Schema.optional(Schema.Number),
});
export type Props = typeof Props.Type;
const Room = Schema.Struct({
  teamId: Schema.String,
  diagramId: Schema.String,
  actorId: Schema.String,
  generation: Schema.String,
});
const Peer = Schema.Struct({
  connectionId: Schema.String,
  actorId: Schema.String,
  name: Schema.String,
  selection: Schema.Array(Schema.String),
  cursor: Schema.NullOr(Schema.Struct({ x: Schema.Number, y: Schema.Number })),
  seenAt: Schema.Number,
});
const FeedSeed = Schema.Struct({
  run: Schema.Number,
  feed: DiagramFeedSchema,
  frame: Schema.Unknown,
});
const FeedProgress = Schema.Struct({
  run: Schema.Number,
  cursor: Schema.Number,
  sourceVersion: Schema.Number,
});
const workshopLinkHint = {
  produces: 'To add Produces, connect a command output to a domain event input.',
  activates: 'To add Activates, connect a domain event output to a policy input.',
  triggers: 'To add Triggers, connect a policy output to a command input.',
} as const;
const WorkshopLink = Schema.Literals(['plain', 'produces', 'activates', 'triggers']);

export const Model = Schema.Struct({
  feedMode: Schema.Literals(['legacy', 'delta']),
  feedSeeds: Schema.Array(FeedSeed),
  feedProgress: Schema.Array(FeedProgress),
  edgeMotionRun: Schema.NullOr(Schema.Number),
  deferredEdgeReveals: Schema.Array(Schema.String),
  room: Room,
  assessment: Assessment.Model,
  coupling: Coupling.Model,
  evolution: Evolution.History,
  historyReview: Schema.Unknown,
  historyRun: Schema.Number,
  historyReducedMotion: Schema.Boolean,
  historyVisible: Schema.Boolean,
  inspector: Inspector,
  journey: Schema.Struct({ start: Schema.String, via: Schema.Array(Schema.String) }),
  rails: Schema.Struct({ tools: Schema.Boolean, inspector: Schema.Boolean }),
  compactBoard: Schema.Boolean,
  drawer: Schema.NullOr(Rail),
  activeBoardCommand: BoardCommand,
  focusedBoard: Schema.Boolean,
  overviewOpen: Schema.Boolean,
  find: Schema.NullOr(Schema.String),
  sourceExport: Schema.NullOr(SourceExport.Review),
  sourceExportRun: Schema.Number,
  importRun: Schema.Number,
  boardImport: Schema.NullOr(
    Schema.Struct({
      version: Schema.Number,
      child: DiagramImport.Model,
      notice: Schema.String,
    }),
  ),
  svg: Schema.Unknown,
  svgRun: Schema.Number,
  layout: Layout.Task,
  layoutMethod: Layout.Method,
  layoutRun: Schema.Number,
  opy: Opy.Model,
  decisionAuthoring: Schema.Boolean,
  clefShadow: Schema.Boolean,
  session: DiagramSessionSchema,
  queuedMove: Schema.NullOr(QueuedMove),
  moveSaveIssue: Schema.NullOr(Schema.Literals(['conflict', 'rejected'])),
  editor: Schema.Unknown,
  base: Schema.NullOr(DiagramDocumentSchema),
  role: Role,
  name: Schema.String,
  nameRevision: Schema.Number,
  serial: Schema.Number,
  ownEdits: Schema.Array(
    Schema.Struct({ operationId: Schema.String, documentVersion: Schema.Number }),
  ),
  draft: Schema.String,
  icons: TeamIcons.Panel,
  failedIconAssets: Schema.Array(Schema.String),
  connection: Connection,
  socketRun: Schema.Number,
  socketSlot: SocketSlot,
  reconnectDelayMs: ReconnectDelay,
  peers: Schema.Array(Peer),
  cursor: Schema.NullOr(Schema.Struct({ x: Schema.Number, y: Schema.Number })),
  error: Schema.String,
  emphasis: CanvasEmphasis,
  workshopLink: WorkshopLink,
});
export type Model = Omit<typeof Model.Type, 'coupling' | 'svg'> &
  Readonly<{ coupling: Coupling.Model; svg: Svg.Review | null }>;
const session = (model: Model) => model.session;
// SAFETY: createEditor and bridgeEvent exclusively maintain this editor field.
const editor = (model: Model) => model.editor as EditorState;
const base = (model: Model) => model.base;
const preparing = (model: Model) => {
  const pending = session(model).pending;
  return pending?.status === 'preparing' ? pending.request : null;
};
const current = (model: Model, room: DiagramRoom) =>
  model.room.generation === room.generation &&
  model.room.teamId === room.teamId &&
  model.room.diagramId === room.diagramId &&
  model.room.actorId === room.actorId;
export const Message = UiSchema.TaggedEnum({
  SucceededIdentity: { generation: Schema.String },
  FailedIdentity: {},
  SucceededSnapshot: {
    room: Room,
    frame: Schema.Unknown,
    role: Role,
    run: Schema.optionalKey(Schema.Number),
    feed: Schema.optionalKey(Schema.Unknown),
    decisionAuthoring: Schema.optionalKey(Schema.Boolean),
    clefShadow: Schema.optionalKey(Schema.Boolean),
  },
  FailedSnapshot: { room: Room, status: Schema.Number, run: Schema.optionalKey(Schema.Number) },
  ObservedDelta: { room: Room, run: Schema.Number, cursor: Schema.Number, delta: Schema.Unknown },
  ObservedCaughtUp: { room: Room, run: Schema.Number, cursor: Schema.Number },
  ObservedFrame: { room: Room, run: Schema.Number, frame: Schema.Unknown },
  ObservedRenewal: { room: Room, run: Schema.Number },
  ObservedDisconnect: {
    room: Room,
    run: Schema.Number,
    reason: Schema.Literals(['lease', 'failure']),
  },
  ObservedTick: { room: Room },
  ObservedBoardTitle: { title: BoardTitle },
  SucceededPresence: { room: Room, peers: Schema.Array(Peer) },
  FailedPresence: { room: Room, status: Schema.Number },
  ObservedEditorInput: { event: Schema.Unknown },
  ChangedLabel: { text: Schema.String },
  ClickedAdd: {},
  ClickedAddWorkshopNote: { noteRole: WorkshopRole },
  ClickedHotspotStatus: { id: Schema.String, expected: Schema.Number, status: WorkshopStatus },
  CompletedHotspotReveal: {},
  ClickedRename: {},
  ToggledIconPicker: {},
  FailedIconAsset: { icon: Schema.String },
  SelectedIconTab: { tab: TeamIcons.Tab },
  ChoseNodeIcon: { icon: Schema.NullOr(Schema.String) },
  SelectedIconFile: { file: Schema.Unknown },
  ClickedArchiveIcon: { id: Schema.String },
  SettledIconLibrary: {
    run: Schema.Number,
    entries: Schema.NullOr(TeamIcons.Entries),
    notice: Schema.String,
    applied: Schema.NullOr(
      Schema.Struct({ id: Schema.String, expected: Schema.Number, icon: Schema.String }),
    ),
  },
  ClickedUndo: {},
  ClickedRetry: {},
  ClickedDiscardQueuedMove: {},
  ClickedDelete: {},
  PreparedEdit: { room: Room, request: DiagramRequestSchema, hash: Schema.String },
  FailedPreparation: { room: Room },
  SucceededEdit: { room: Room, reply: Schema.Unknown },
  FailedEdit: { room: Room, operationId: Schema.String },
  GotAssessmentMessage: { room: Room, message: Assessment.Message },
  SelectedWorkshopLink: { meaning: WorkshopLink },
  SelectedCanvasEmphasis: { emphasis: CanvasEmphasis },
  ChoseJourneyStart: { id: Schema.String },
  FollowedJourneyLink: { id: Schema.String },
  SteppedBackInJourney: { edgeId: Schema.String, depth: Schema.Number },
  SelectedInspector: { inspector: Inspector },
  SelectedEvolutionVersion: { value: Schema.String },
  OpenedLatestHistory: {},
  OpenedHistory: { version: Schema.Number, baseline: Schema.optional(Schema.Number) },
  ClosedHistory: {},
  OpenedBoardImport: {},
  ClosedBoardImport: {},
  ChoseBoardImportFormat: { format: Schema.Literals(['likec4', 'alchemy']) },
  GotBoardImportMessage: { run: Schema.Number, message: DiagramImport.Message },

  ChangedHistoryPlayback: { run: Schema.Number, event: Schema.Unknown },
  ChangedHistoryBaseline: { run: Schema.Number, id: Schema.String },
  NavigatedHistory: { run: Schema.Number, event: Schema.Unknown },
  AdvancedHistoryPlayback: { run: Schema.Number, milliseconds: Schema.Number },
  ChangedHistoryMotion: { reducedMotion: Schema.Boolean },
  ChangedHistoryVisibility: { visible: Schema.Boolean },
  ChangedBoardWidth: { compact: Schema.Boolean },
  ToggledBoardRail: { rail: Rail },
  FocusedBoardCommand: { name: BoardCommand },
  NavigatedBoardCommands: { name: BoardCommand },
  ToggledBoardFocus: {},
  ToggledOverview: {},
  OpenedFind: {},
  ClosedFind: {},
  ChangedFind: { query: Schema.String },
  ChoseFindResult: { target: Schema.Literals(FindTarget), id: Schema.String },
  OpenedSourceExport: { kind: SourceExport.Kind },
  ClosedSourceExport: {},
  SettledSourceExport: { run: Schema.Number, review: SourceExport.Review },
  ChangedSourceExportConsent: {
    kind: SourceExport.Kind,
    version: Schema.Number,
    accepted: Schema.Boolean,
  },
  ClickedSourceDownload: {
    kind: SourceExport.Kind,
    version: Schema.Number,
    format: SourceExport.Format,
  },
  CompletedSourceDownload: {
    kind: SourceExport.Kind,
    version: Schema.Number,
    started: Schema.Boolean,
  },
  OpenedSvg: {},
  ClosedSvg: {},
  LoadedSvgIcons: { run: Schema.Number, images: Schema.Record(Schema.String, Schema.String) },
  ObservedSvgReview: { request: Schema.Unknown },
  SelectedLayoutMethod: { method: Layout.Method },
  ClickedLayoutPreview: { method: Schema.optional(Layout.Method) },
  DiscardedLayoutPreview: {},
  ClickedApplyLayout: { run: Schema.Number },
  SettledLayoutPreview: { room: Room, run: Schema.Number, result: Layout.Task },
  OpenedOpy: {},
  ClosedOpy: {},
  GotOpyMessage: { room: Room, message: Opy.Message },
  CompletedBoardFocus: {},
  CompletedEdgeReveal: {},
  GotCouplingMessage: { room: Room, message: CouplingMessage },
  CompletedInspectorFocus: {},
});
export type Message = typeof Message.Type;
type Return<State, Event> = Readonly<{
  model: State;
  commands?: readonly Command.Command<Event>[];
}>;

// oxlint-disable-next-line linteffect/no-effect-wrapper-alias -- The callback registers a frame and provides its native cancellation to Effect.
function scheduleAfterPaint(resume: Parameters<Parameters<typeof Effect.callback<void>>[0]>[0]) {
  const frame = requestAnimationFrame(() => resume(Effect.void));
  return Effect.sync(() => cancelAnimationFrame(frame));
}

function focusBoardElement(selector: string, makeFocusable = false) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return;
  if (makeFocusable && !element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
  element.focus();
}

const RevealHotspots = Command.make(
  'RevealHotspots',
  {
    args: {
      run: Schema.Number,
      changes: Schema.Array(Schema.Struct({ id: Schema.String, status: WorkshopStatus })),
    },
  },
  ({ run, changes }) =>
    Effect.callback<void>(scheduleAfterPaint).pipe(
      Effect.map(() => {
        revealHotspots(run, changes);
        return Message.CompletedHotspotReveal();
      }),
    ),
);
const RevealEdges = Command.make(
  'RevealEdges',
  { args: { run: Schema.Number, edgeIds: Schema.Array(Schema.String) } },
  ({ run, edgeIds }) =>
    Effect.callback<void>(scheduleAfterPaint).pipe(
      Effect.map(() => {
        revealEdgeStrokes(run, edgeIds);
        return Message.CompletedEdgeReveal();
      }),
    ),
);
const FocusAssessmentInspector = Command.make('FocusAssessmentInspector', { args: {} }, () =>
  Effect.callback<void>(scheduleAfterPaint).pipe(
    Effect.map(() => {
      focusBoardElement('#assessment-inspector', true);
      return Message.CompletedInspectorFocus();
    }),
  ),
);
const FocusBoardControl = Command.make(
  'FocusBoardControl',
  { args: { selector: Schema.String } },
  ({ selector }) =>
    Effect.callback<void>(scheduleAfterPaint).pipe(
      Effect.map(() => {
        focusBoardElement(selector, true);
        return Message.CompletedBoardFocus();
      }),
    ),
);
const FocusJourneyNote = Command.make(
  'FocusJourneyNote',
  { args: { triggerId: Schema.String } },
  ({ triggerId }) =>
    Effect.gen(function* () {
      yield* Effect.callback<void>(scheduleAfterPaint);
      const active = document.activeElement;
      // A removed Follow button leaves focus on the body. A surviving trigger
      // may hand off focus too, unless the reviewer already chose another control.
      if (active === document.body || active?.id === triggerId)
        document.getElementById('journey-current-note')?.focus();
      return Message.CompletedBoardFocus();
    }),
);
const FocusCommandTrigger = Command.make(
  'FocusCommandTrigger',
  { args: { name: BoardCommand } },
  ({ name }) =>
    Effect.gen(function* () {
      yield* Effect.callback<void>(scheduleAfterPaint);
      document.querySelector<HTMLElement>('.board-command-bar :popover-open')?.hidePopover();
      focusBoardElement(`#${triggerId(name)}`);
      return Message.CompletedBoardFocus();
    }),
);
const PrepareLikeC4 = Command.make(
  'PrepareLikeC4',
  { args: { run: Schema.Number, document: DiagramDocumentSchema } },
  ({ run, document }) =>
    Effect.tryPromise(() => SourceExport.prepareLikeC4(document.graph, document.version)).pipe(
      Effect.orElseSucceed(() =>
        SourceExport.Review.Rejected({
          kind: 'likec4',
          version: document.version,
          diagnostics: [
            { severity: 'error', subject: null, message: 'Could not prepare LikeC4 source.' },
          ],
        }),
      ),
      Effect.map((review) => Message.SettledSourceExport({ run, review })),
    ),
);
const DownloadSource = Command.make(
  'DownloadSource',
  {
    args: {
      kind: SourceExport.Kind,
      version: Schema.Number,
      format: SourceExport.Format,
      contents: Schema.String,
    },
  },
  ({ kind, version, format, contents }) =>
    Effect.try(() => {
      const source = format === 'source';
      const extension = kind === 'likec4' ? 'c4' : source ? 'mmd' : 'mermaid.json';
      handoffDownload(
        contents,
        source ? 'text/plain;charset=utf-8' : 'application/json',
        `zloz-v${version}.${extension}`,
      );
    }).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedSourceDownload({ kind, version, started: true }),
        onFailure: () => Message.CompletedSourceDownload({ kind, version, started: false }),
      }),
    ),
);
function handoffDownload(contents: string, mediaType: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mediaType }));
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
}
const LoadSvgIcons = Command.make(
  'LoadSvgIcons',
  { args: { team: Schema.String, run: Schema.Number, references: Schema.Array(Schema.String) } },
  ({ team, run, references }) =>
    Effect.tryPromise(() => Svg.loadIcons(team, references)).pipe(
      Effect.match({
        onSuccess: (images) => Message.LoadedSvgIcons({ run, images }),
        onFailure: () => Message.LoadedSvgIcons({ run, images: {} }),
      }),
    ),
);
const DownloadSvg = Command.make(
  'DownloadSvg',
  {
    args: {
      svg: Schema.String,
      fileName: Schema.String,
      scope: Schema.String,
      generation: Schema.Number,
      key: Schema.String,
      run: Schema.Number,
    },
  },
  ({ svg, fileName, scope, generation, key, run }) => {
    const settled = (outcome: 'succeeded' | 'failed') =>
      Message.ObservedSvgReview({
        request: {
          type: 'SvgDownloadSettled',
          scope,
          generation,
          key,
          run,
          outcome,
        } satisfies ZlozSvgReviewRequest,
      });
    return Effect.try(() => handoffDownload(svg, 'image/svg+xml;charset=utf-8', fileName)).pipe(
      Effect.match({ onSuccess: () => settled('succeeded'), onFailure: () => settled('failed') }),
    );
  },
);
const UseIconLibrary = Command.make(
  'UseIconLibrary',
  {
    args: {
      team: Schema.String,
      run: Schema.Number,
      file: Schema.Unknown,
      target: Schema.NullOr(Schema.Struct({ id: Schema.String, expected: Schema.Number })),
      archive: Schema.NullOr(Schema.String),
    },
  },
  ({ team, run, file, target, archive }) =>
    Effect.tryPromise({
      try: async () => {
        if (archive) await TeamIcons.archive(team, archive);
        const uploaded = file instanceof File ? await TeamIcons.upload(team, file) : null;
        const entries = await TeamIcons.list(team);
        return Message.SettledIconLibrary({
          run,
          entries,
          notice: uploaded ? 'Icon added to the team library.' : archive ? 'Icon archived.' : '',
          applied: uploaded && target ? { ...target, icon: `team:${uploaded.id}` } : null,
        });
      },
      catch: (error) => (error instanceof Error ? error.message : 'Icon library is unavailable.'),
    }).pipe(
      Effect.match({
        onSuccess: (message) => message,
        onFailure: (notice) =>
          Message.SettledIconLibrary({ run, entries: null, notice, applied: null }),
      }),
    ),
);
const PrepareLayoutPreview = Command.make(
  'PrepareLayoutPreview',
  {
    args: {
      room: Room,
      run: Schema.Number,
      document: DiagramDocumentSchema,
      selection: Schema.Array(Schema.String),
      direction: Layout.Direction,
      method: Layout.Method,
    },
  },
  ({ room, run, document, selection, direction, method }) =>
    Effect.tryPromise({
      try: () =>
        Layout.prepare(
          document,
          selection,
          `teams-${room.generation}-layout-${run}`,
          direction,
          method,
        ),
      catch: (error) =>
        error instanceof Layout.SelectionLayoutError
          ? error.message
          : 'Could not arrange this selection.',
    }).pipe(
      Effect.match({
        onSuccess: (proposal) =>
          Message.SettledLayoutPreview({ room, run, result: Layout.Task.Ready({ proposal }) }),
        onFailure: (message) =>
          Message.SettledLayoutPreview({ room, run, result: Layout.Task.Failed({ message }) }),
      }),
    ),
);
const sharedConnections = createConnectionsView<Message>((id) =>
  Message.ObservedEditorInput({ event: { type: 'EdgeSelected', id, additive: false } }),
);
const AllocateDiagramSession = Command.make('AllocateDiagramSession', { args: {} }, () =>
  Effect.try(() => crypto.randomUUID()).pipe(
    Effect.match({
      onSuccess: (generation) => Message.SucceededIdentity({ generation }),
      onFailure: () => Message.FailedIdentity(),
    }),
  ),
);
const LoadSharedDiagram = Command.make(
  'LoadSharedDiagram',
  { args: { room: Room, run: Schema.optionalKey(Schema.Number) } },
  ({ room, run }) =>
    Effect.tryPromise(async (signal) => {
      const response = await fetch(pathFor(room), {
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });
      if (!response.ok) return Message.FailedSnapshot({ room, run, status: response.status });
      const body = Schema.decodeUnknownSync(
        Schema.Struct({
          frame: Schema.Unknown.pipe(Schema.refine(isDiagramFrame)),
          role: Role,
          feed: Schema.optionalKey(Schema.Unknown),
          decisionAuthoring: Schema.optionalKey(Schema.Boolean),
          clefShadow: Schema.optionalKey(Schema.Boolean),
        }),
      )(await response.json());
      return Message.SucceededSnapshot({
        room,
        run,
        frame: body.frame,
        role: body.role,
        feed: body.feed,
        decisionAuthoring: body.decisionAuthoring ?? false,
        clefShadow: body.clefShadow ?? false,
      });
    }).pipe(Effect.orElseSucceed(() => Message.FailedSnapshot({ room, run, status: 0 }))),
);
const PrepareSharedEdit = Command.make(
  'PrepareSharedEdit',
  { args: { room: Room, request: DiagramRequestSchema } },
  ({ room, request }) =>
    Effect.tryPromise(async () => {
      const input = request;
      return Message.PreparedEdit({ room, request: input, hash: await operationHash(input) });
    }).pipe(Effect.orElseSucceed(() => Message.FailedPreparation({ room }))),
);
const SubmitSharedEdit = Command.make(
  'SubmitSharedEdit',
  { args: { room: Room, request: DiagramRequestSchema } },
  ({ room, request }) => {
    const input = request;
    return Effect.tryPromise(async (signal) => {
      const response = await fetch(`${pathFor(room)}/operations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });
      if (!response.ok) return Message.FailedEdit({ room, operationId: input.operationId });
      const reply: unknown = await response.json();
      if (!isDiagramReply(reply))
        return Message.FailedEdit({ room, operationId: input.operationId });
      return Message.SucceededEdit({ room, reply });
    }).pipe(
      Effect.orElseSucceed(() => Message.FailedEdit({ room, operationId: input.operationId })),
    );
  },
);
const SendDiagramPresence = Command.make(
  'SendDiagramPresence',
  {
    args: {
      room: Room,
      selection: Schema.Array(Schema.String),
      cursor: Schema.NullOr(Schema.Struct({ x: Schema.Number, y: Schema.Number })),
    },
  },
  ({ room, selection, cursor }) =>
    Effect.tryPromise(async (signal) => {
      const response = await fetch(`${pathFor(room)}/presence`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId: room.generation, selection, cursor }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });
      if (!response.ok) return Message.FailedPresence({ room, status: response.status });
      const presence = Schema.decodeUnknownSync(
        Schema.Struct({ peers: Schema.Array(Peer), boardTitle: Schema.optional(BoardTitle) }),
      )(await response.json());
      if (presence.boardTitle) publishTitle(presence.boardTitle);
      return Message.SucceededPresence({ room, peers: presence.peers });
    }).pipe(Effect.orElseSucceed(() => Message.FailedPresence({ room, status: 0 }))),
);

export function init(raw: typeof Props.Type): Return<Model, Message> {
  const props = Schema.decodeUnknownSync(Props)(raw);
  const room = {
    teamId: props.teamId,
    diagramId: props.diagramId,
    actorId: props.actorId,
    generation: '',
  };
  return {
    model: {
      ...props,
      nameRevision: props.nameRevision ?? 0,
      room,
      feedMode: 'legacy',
      feedSeeds: [],
      feedProgress: [],
      edgeMotionRun: null,
      deferredEdgeReveals: [],
      session: newSession(room),
      queuedMove: null,
      moveSaveIssue: null,
      editor: createEditor({ nodes: [], edges: [] }),
      base: null,
      serial: 0,
      ownEdits: [],
      draft: '',
      icons: TeamIcons.initial,
      failedIconAssets: [],
      connection: Connection.Opening(),
      socketRun: 0,
      socketSlot: 'a',
      reconnectDelayMs: 0,
      peers: [],
      cursor: null,
      error: '',
      workshopLink: 'plain' as const,
      emphasis: props.startingView ?? 'c4',
      assessment: Assessment.init(),
      coupling: Coupling.init(),
      inspector: 'selection',
      journey: { start: '', via: [] },
      evolution: Evolution.empty,
      historyReview: null,
      historyRun: 0,
      historyReducedMotion: true,
      historyVisible: false,
      rails: { tools: true, inspector: true },
      compactBoard: false,
      drawer: null,
      activeBoardCommand: 'File',
      focusedBoard: false,
      overviewOpen: false,
      find: null,
      sourceExport: null,
      sourceExportRun: 0,
      importRun: 0,
      boardImport: null,
      svg: null,
      svgRun: 0,
      layout: Layout.Task.Closed(),
      layoutMethod: 'elk',
      layoutRun: 0,
      opy: Opy.init(),
      decisionAuthoring: false,
      clefShadow: false,
    },
    commands: [AllocateDiagramSession.make({})],
  };
}
function install(model: Model, state: DiagramSession, receipt?: ZlozOperationReceipt): Model {
  const old = session(model);
  if (state.confirmed) {
    const confirmed = shareFrame(old.confirmed, state.confirmed);
    if (confirmed !== state.confirmed) state = { ...state, confirmed };
  }
  model = state.confirmed
    ? {
        ...model,
        assessment: Assessment.observe(model.assessment, state.confirmed, model.room.actorId),
        opy: Opy.observe(model.opy, state.confirmed, model.room.actorId),
        evolution: Evolution.observe(model.evolution, state.confirmed.document),
        coupling: couplingVisible(model)
          ? observeCoupling(model.coupling, state.confirmed)
          : model.coupling,
      }
    : model;
  if (
    !old.confirmed &&
    model.emphasis === 'c4' &&
    state.confirmed?.document.graph.nodes.some(
      (node) => node.architecture?.family === 'event-storming',
    )
  )
    model = { ...model, emphasis: 'event-storming' };
  const undoResetVersion = state.confirmed?.undoResetVersion ?? 0;
  let ownEdits =
    undoResetVersion > (old.confirmed?.undoResetVersion ?? 0)
      ? model.ownEdits.filter((entry) => entry.documentVersion > undoResetVersion)
      : model.ownEdits;
  if (old.pending && !state.pending) {
    const p = old.pending;
    const covered = state.confirmed?.coverage.find(
      (entry) =>
        entry.actorId === model.room.actorId &&
        entry.operationId === p.request.operationId &&
        entry.requestHash === p.requestHash,
    );
    const acceptedVersion =
      p.status === 'awaiting-frame'
        ? p.accepted.receipt.documentVersion
        : covered?.status === 'accepted'
          ? covered.documentVersion
          : receipt?.status === 'accepted'
            ? receipt.documentVersion
            : undefined;
    if (acceptedVersion !== undefined) {
      model = { ...model, moveSaveIssue: null };
    } else if (
      p.request.operation.type === 'MoveNodes' &&
      (receipt?.status === 'rejected' || covered?.status === 'rejected')
    ) {
      model = {
        ...model,
        moveSaveIssue:
          receipt?.status === 'rejected' && receipt.code === 'Conflict' ? 'conflict' : 'rejected',
      };
    }
    if (state.confirmed) {
      model = {
        ...model,
        base:
          acceptedVersion === undefined
            ? model.base
            : advanceGestureBase(
                model.base,
                p.request.operation,
                acceptedVersion,
                state.confirmed.document,
              ),
        queuedMove:
          model.queuedMove === null
            ? null
            : acceptedVersion === undefined
              ? QueuedMove.Blocked({ nodes: model.queuedMove.nodes })
              : advanceQueuedMove(
                  model.queuedMove,
                  p.request.operation,
                  acceptedVersion,
                  state.confirmed.document,
                ),
      };
    }
    // An edit can be acknowledged by a frame that already includes a recovery.
    // Preserve its known outcome, but do not offer its invalidated inverse.
    if (acceptedVersion !== undefined && acceptedVersion > undoResetVersion)
      ownEdits =
        p.request.operation.type === 'Undo'
          ? ownEdits.filter(
              (entry) =>
                p.request.operation.type !== 'Undo' ||
                entry.operationId !== p.request.operation.operationId,
            )
          : [
              ...ownEdits,
              { operationId: p.request.operationId, documentVersion: acceptedVersion },
            ].slice(-100);
  }
  const before = editor(model);
  if (model.role === 'viewer' && model.queuedMove)
    model = { ...model, queuedMove: QueuedMove.Blocked({ nodes: model.queuedMove.nodes }) };
  if (!state.confirmed || isAuthoredGesture(before.gesture))
    return { ...model, session: state, ownEdits };
  let graph =
    model.role === 'viewer'
      ? state.confirmed.document.graph
      : pendingGeometryGraph(state.confirmed.document, state.pending);
  if (model.role !== 'viewer' && model.queuedMove?._tag === 'Ready')
    graph = geometryGraph(
      { ...state.confirmed.document, graph },
      { type: 'MoveNodes', nodes: model.queuedMove.nodes },
    );
  // Metadata-only/duplicate feed snapshots cannot change this canvas. Preserve
  // its identity after validation, while session receipts and clocks stay live.
  if (
    before.graph === graph &&
    before.routes.length === 0 &&
    before.past.length === 0 &&
    before.future.length === 0 &&
    before.selectedNodes.every((id) => graph.nodes.some((node) => node.id === id)) &&
    before.selectedEdges.every((id) => graph.edges.some((edge) => edge.id === id))
  )
    return { ...model, session: state, ownEdits };
  const selectedNodes = before.selectedNodes.filter((id) =>
    graph.nodes.some((node) => node.id === id),
  );
  const selectedEdges = before.selectedEdges.filter((id) =>
    graph.edges.some((edge) => edge.id === id),
  );
  const oldLabel = before.graph.nodes.find((node) => node.id === before.selectedNodes[0])?.label;
  const newLabel = graph.nodes.find((node) => node.id === before.selectedNodes[0])?.label;
  return {
    ...model,
    session: state,
    ownEdits,
    draft:
      oldLabel !== undefined && model.draft === oldLabel && newLabel !== undefined
        ? newLabel
        : model.draft,
    editor: {
      ...before,
      graph,
      routes: [],
      past: [],
      future: [],
      selectedNodes:
        selectedNodes.length === before.selectedNodes.length ? before.selectedNodes : selectedNodes,
      selectedEdges:
        selectedEdges.length === before.selectedEdges.length ? before.selectedEdges : selectedEdges,
    },
  };
}
function selectedIconTarget(model: Model) {
  const id = editor(model).selectedNodes[0];
  const clock = session(model).confirmed?.document.nodes.find((node) => node.id === id);
  return clock?.present ? { id: clock.id, expected: clock.icon ?? 0 } : null;
}

function loadTeamIcons(model: Model, file: File | null = null, archive: string | null = null) {
  const run = model.icons.run + 1;
  const target = file ? selectedIconTarget(model) : null;
  return {
    model: { ...model, icons: { ...model.icons, run, busy: true, notice: '' } },
    commands: [UseIconLibrary.make({ team: model.room.teamId, run, file, target, archive })],
  };
}

function enqueue(model: Model, operation: ZlozGraphOperation): Return<Model, Message> {
  if (
    model.connection._tag === 'Denied' ||
    model.role === 'viewer' ||
    session(model).pending ||
    model.queuedMove !== null ||
    !session(model).confirmed
  )
    return { model };
  const serial = model.serial + 1;
  const request: ZlozOperationRequest = {
    version: 1,
    operationId: `${model.room.generation}-${serial}`,
    operation,
  };
  return {
    model: {
      ...model,
      serial,
      session: prepareEdit(session(model), request),
      base: null,
      editor: { ...editor(model), gesture: { type: 'idle' }, past: [], future: [] },
      error: '',
    },
    commands: [PrepareSharedEdit.make({ room: model.room, request })],
  };
}
const opyContext = (model: Model) => ({
  room: model.room,
  frame: session(model).confirmed,
  relationshipId: editor(model).selectedEdges[0],
  isOwner: model.role === 'owner',
  clefShadow: model.clefShadow,
  actorLabel: (id: string) =>
    id === model.room.actorId
      ? 'you'
      : (model.peers.find((peer) => peer.actorId === id)?.name ?? id),
  authoring:
    model.decisionAuthoring &&
    model.role !== 'viewer' &&
    isLiveConnection(model.connection) &&
    Boolean(model.room.generation),
});
const opyAvailable = (model: Model) =>
  model.connection._tag !== 'Denied' &&
  (model.decisionAuthoring || Boolean(session(model).confirmed?.relationshipDecisions?.length));

const railVisible = (model: Model, rail: typeof Rail.Type) =>
  !model.focusedBoard && (model.compactBoard ? model.drawer === rail : model.rails[rail]);
const couplingVisible = (model: Model) =>
  railVisible(model, 'inspector') && model.inspector === 'coupling';
const confirmedExportDocument = (model: Model) =>
  isLiveConnection(model.connection) ? model.session.confirmed?.document : undefined;
function currentSourceReview(model: Model, kind: SourceExport.Kind, version: number) {
  const review = model.sourceExport;
  return review?._tag === 'Ready' &&
    review.kind === kind &&
    review.version === version &&
    confirmedExportDocument(model)?.version === version
    ? review
    : null;
}
function canOpenBoardImport(model: Model) {
  const document = confirmedExportDocument(model);
  return (
    document !== undefined &&
    document.graph.nodes.length === 0 &&
    document.graph.edges.length === 0 &&
    model.role !== 'viewer' &&
    editor(model).gesture.type === 'idle' &&
    !hasUncommittedEdit(model)
  );
}

function boardImportBlockReason(model: Model, version: number) {
  const document = session(model).confirmed?.document;
  if (document?.version !== version || document.graph.nodes.length || document.graph.edges.length)
    return 'The board changed while you reviewed the import. No import has been applied.';
  return canOpenBoardImport(model) ? '' : 'Wait for a live, ready board before importing.';
}

function importChild(model: Model, format: 'likec4' | 'alchemy') {
  const props = {
    teamId: model.room.teamId,
    creationId: model.room.diagramId,
    insideBoard: true,
  } satisfies DiagramImport.Props;
  return DiagramImport.init(format === 'alchemy' ? { ...props, format } : props).model;
}

const supportedLayoutSelection = (model: Model, method = model.layoutMethod) =>
  isLiveConnection(model.connection) &&
  editor(model).gesture.type === 'idle' &&
  editor(model).selectedNodes.length >= Layout.methods[method].minimum;
const layoutStaleReason = (model: Model, proposal: Layout.Proposal) =>
  Layout.staleReason(proposal, model.session.confirmed?.document, editor(model).selectedNodes);
function layoutApplyReason(model: Model, stale: string | null) {
  if (stale) return Option.some(stale);
  if (model.role === 'viewer') return Option.some('Editors can apply this layout.');
  if (!isLiveConnection(model.connection))
    return Option.some('Reconnect before applying the layout.');
  if (model.session.pending || model.queuedMove || editor(model).gesture.type !== 'idle')
    return Option.some('Finish the current edit before applying the layout.');
  return Option.none();
}
function withRailChange(before: Model, next: Model): Model {
  if (couplingVisible(before) === couplingVisible(next)) return next;
  const coupling = { ...next.coupling, width: null };
  return {
    ...next,
    coupling: couplingVisible(next) ? observeCoupling(coupling, next.session.confirmed) : coupling,
  };
}

function navigableJourney(model: Model) {
  const graph = session(model).confirmed?.document.graph;
  return graph && model.inspector === 'journey' && editor(model).gesture.type === 'idle'
    ? journey(graph, model.journey)
    : null;
}
function revealJourneyStep(
  model: Model,
  via: readonly string[],
  nodeId: string,
  triggerId: string,
): Return<Model, Message> {
  const revealed = update(
    { ...model, journey: { ...model.journey, via } },
    canvasEvent({ type: 'NodeRevealRequested', id: nodeId }),
  );
  return {
    model: revealed.model,
    commands: [...(revealed.commands ?? []), FocusJourneyNote.make({ triggerId })],
  };
}

export function update(model: Model, message: Message): Return<Model, Message> {
  // Re-authentication starts a new page generation; late work cannot reopen this one.
  if (model.connection._tag === 'Denied' && message._tag !== 'SelectedCanvasEmphasis')
    return { model };
  const step = Message.match(message, {
    ClickedDiscardQueuedMove: () =>
      isAuthoredGesture(editor(model).gesture)
        ? { model }
        : {
            model: install({ ...model, queuedMove: null, error: '' }, session(model)),
          },
    CompletedInspectorFocus: () => ({ model }),
    CompletedBoardFocus: () => ({ model }),
    CompletedEdgeReveal: () => ({ model }),
    ChangedBoardWidth: ({ compact }) => ({
      model: withRailChange(model, {
        ...model,
        compactBoard: compact,
        drawer:
          compact && model.inspector !== 'selection' && railVisible(model, 'inspector')
            ? 'inspector'
            : null,
      }),
    }),
    ToggledBoardRail: ({ rail }) => {
      const open = !railVisible(model, rail);
      return {
        model: withRailChange(model, {
          ...model,
          focusedBoard: false,
          ...(model.compactBoard
            ? { drawer: open ? rail : null }
            : {
                rails: {
                  ...(model.focusedBoard ? { tools: false, inspector: false } : model.rails),
                  [rail]: open,
                },
              }),
        }),
        commands: [
          FocusBoardControl.make({ selector: open ? `#board-${rail}` : `#board-${rail}-toggle` }),
        ],
      };
    },
    FocusedBoardCommand: ({ name }) => ({
      model: model.activeBoardCommand === name ? model : { ...model, activeBoardCommand: name },
    }),
    NavigatedBoardCommands: ({ name }) => ({
      model: { ...model, activeBoardCommand: name },
      commands: [FocusCommandTrigger.make({ name })],
    }),
    ToggledBoardFocus: () => ({
      model: withRailChange(model, {
        ...model,
        focusedBoard: !model.focusedBoard,
        overviewOpen: false,
      }),
    }),
    ToggledOverview: () => ({
      model: { ...model, overviewOpen: !model.overviewOpen },
      commands: [
        FocusBoardControl.make({
          selector: model.overviewOpen
            ? '#board-overview-toggle'
            : '#board-overview [data-flow-minimap-frame]',
        }),
      ],
    }),
    OpenedFind: () => ({
      model: { ...model, find: '', sourceExport: null, svg: null, layout: Layout.Task.Closed() },
      commands: [FocusBoardControl.make({ selector: '#board-find-query' })],
    }),
    OpenedSourceExport: ({ kind }) => {
      const confirmed = confirmedExportDocument(model);
      if (!confirmed) return { model };
      const run = model.sourceExportRun + 1;
      const review =
        kind === 'likec4'
          ? SourceExport.Review.Loading({ kind, version: confirmed.version, run })
          : SourceExport.prepareMermaid(confirmed.graph, confirmed.version);
      return {
        model: {
          ...model,
          find: null,
          sourceExport: review,
          sourceExportRun: run,
          svg: null,
          layout: Layout.Task.Closed(),
        },
        commands: [
          ...(kind === 'likec4' ? [PrepareLikeC4.make({ run, document: confirmed })] : []),
          FocusBoardControl.make({ selector: '#board-mermaid' }),
        ],
      };
    },
    ClosedSourceExport: () => ({
      model: { ...model, sourceExport: null },
      commands: [
        FocusBoardControl.make({
          selector:
            model.sourceExport && railVisible(model, 'tools') && confirmedExportDocument(model)
              ? '#' + SourceExport.launcherId(model.sourceExport.kind)
              : '#shared-diagram-surface',
        }),
      ],
    }),
    SettledSourceExport: ({ run, review }) =>
      model.sourceExport?._tag === 'Loading' && model.sourceExport.run === run
        ? { model: { ...model, sourceExport: review } }
        : { model },
    ChangedSourceExportConsent: ({ kind, version, accepted }) => {
      const review = currentSourceReview(model, kind, version);
      return { model: review ? { ...model, sourceExport: { ...review, accepted } } : model };
    },
    ClickedSourceDownload: ({ kind, version, format }) => {
      const review = currentSourceReview(model, kind, version);
      if (
        !review ||
        (review.diagnostics.length && !review.accepted) ||
        (kind === 'likec4' && format === 'bundle')
      )
        return { model };
      return {
        model,
        commands: [DownloadSource.make({ kind, version, format, contents: review[format] })],
      };
    },
    CompletedSourceDownload: ({ kind, version, started }) => {
      const review = currentSourceReview(model, kind, version);
      return {
        model: review
          ? {
              ...model,
              sourceExport: SourceExport.Review.Ready({
                ...review,
                download: started ? 'started' : 'failed',
              }),
            }
          : model,
      };
    },
    OpenedSvg: () => {
      const confirmed = confirmedExportDocument(model);
      if (!confirmed) return { model };
      const svgRun = model.svgRun + 1;
      const references = Svg.iconReferences(confirmed.graph);
      return {
        model: withRailChange(model, {
          ...model,
          svgRun,
          svg: Svg.open(
            confirmed,
            model.name,
            `${model.room.generation}/svg/${svgRun}`,
            model.svg ?? undefined,
          ),
          drawer: model.compactBoard ? null : model.drawer,
          find: null,
          sourceExport: null,
          layout: Layout.Task.Closed(),
        }),
        commands: [
          FocusBoardControl.make({ selector: '#board-svg' }),
          ...(references.length
            ? [LoadSvgIcons.make({ team: model.room.teamId, run: svgRun, references })]
            : []),
        ],
      };
    },
    LoadedSvgIcons: ({ run, images }) =>
      model.svg && run === model.svgRun
        ? { model: { ...model, svg: { ...model.svg, images } } }
        : { model },
    ClosedSvg: () => ({
      model: { ...model, svg: null },
      commands: [
        FocusBoardControl.make({
          selector:
            railVisible(model, 'tools') && confirmedExportDocument(model)
              ? '#board-svg-open'
              : '#shared-diagram-surface',
        }),
      ],
    }),
    ObservedSvgReview: ({ request }) => {
      if (!model.svg || model.connection._tag === 'Denied') return { model };
      const available = Svg.availability(model.svg, confirmedExportDocument(model));
      // SAFETY: SDK review controls and the download Command emit only ZlozSvgReviewRequest facts.
      const next = Svg.update(model.svg, available, request as ZlozSvgReviewRequest);
      const updated = { ...model, svg: next.review };
      return next.payload
        ? { model: updated, commands: [DownloadSvg.make(next.payload)] }
        : { model: updated };
    },
    SelectedLayoutMethod: ({ method }) => ({
      model: { ...model, layoutMethod: method, layout: Layout.Task.Closed() },
    }),
    ClickedLayoutPreview: ({ method = model.layoutMethod }) => {
      const document = session(model).confirmed?.document;
      if (!document || !supportedLayoutSelection(model, method) || model.layout._tag === 'Running')
        return { model };
      const run = model.layoutRun + 1;
      const currentEditor = editor(model);
      return {
        model: withRailChange(model, {
          ...model,
          layoutRun: run,
          layoutMethod: method,
          layout: Layout.Task.Running(),
          drawer: model.compactBoard ? null : model.drawer,
          find: null,
          sourceExport: null,
          svg: null,
        }),
        commands: [
          PrepareLayoutPreview.make({
            room: model.room,
            run,
            document,
            selection: currentEditor.selectedNodes,
            direction: (currentEditor.surface?.width ?? 800) < 600 ? 'DOWN' : 'RIGHT',
            method,
          }),
          FocusBoardControl.make({ selector: '#board-layout-preview' }),
        ],
      };
    },
    SettledLayoutPreview: ({ room, run, result }) =>
      current(model, room) && run === model.layoutRun && model.layout._tag === 'Running'
        ? { model: { ...model, layout: result } }
        : { model },
    DiscardedLayoutPreview: () => ({
      model: { ...model, layout: Layout.Task.Closed() },
      commands: [
        FocusBoardControl.make({
          selector: railVisible(model, 'tools') ? '#board-layout-open' : '#shared-diagram-surface',
        }),
      ],
    }),
    ClickedApplyLayout: ({ run }) => {
      if (run !== model.layoutRun || model.layout._tag !== 'Ready') return { model };
      const { proposal } = model.layout;
      if (Option.isSome(layoutApplyReason(model, layoutStaleReason(model, proposal))))
        return { model };
      const applied = enqueue(
        { ...model, layout: Layout.Task.Closed() },
        { type: 'MoveNodes', nodes: proposal.moves },
      );
      return {
        ...applied,
        commands: [
          ...(applied.commands ?? []),
          FocusBoardControl.make({ selector: '#shared-diagram-surface' }),
        ],
      };
    },
    ClosedFind: () => ({
      model: { ...model, find: null },
      commands: [FocusBoardControl.make({ selector: '#board-find-toggle' })],
    }),
    ChangedFind: ({ query }) => ({ model: { ...model, find: query } }),
    ChoseFindResult: ({ target, id }) => {
      if (model.find === null || editor(model).gesture.type !== 'idle') return { model };
      const step = update(
        model,
        canvasEvent({
          type: target === 'node' ? 'NodeRevealRequested' : 'EdgeRevealRequested',
          id,
        }),
      );
      return {
        model: { ...step.model, find: null },
        commands: [
          ...(step.commands ?? []),
          FocusBoardControl.make({ selector: '#shared-diagram-surface' }),
        ],
      };
    },
    OpenedOpy: () =>
      opyAvailable(model)
        ? {
            model: withRailChange(model, {
              ...model,
              inspector: 'opy',
              focusedBoard: false,
              rails: { ...model.rails, inspector: true },
              drawer: 'inspector',
            }),
            commands: [FocusBoardControl.make({ selector: '#opy-inspector' })],
          }
        : { model },
    ClosedOpy: () => ({
      model: {
        ...model,
        inspector: 'selection' as const,
        drawer: 'tools' as const,
        rails: { ...model.rails, tools: true },
      },
      commands: [FocusBoardControl.make({ selector: '#ask-opy' })],
    }),
    GotOpyMessage: ({ room, message: childMessage }) => {
      if (!current(model, room)) return { model };
      const result = Opy.update(model.opy, childMessage, opyContext(model));
      return {
        model: { ...model, opy: result.model },
        commands:
          result.commands?.map((command) =>
            Command.map(command, (message) => Message.GotOpyMessage({ room, message })),
          ) ?? [],
      };
    },
    ChoseJourneyStart: ({ id }) => {
      const graph = session(model).confirmed?.document.graph;
      if (!graph || model.inspector !== 'journey' || editor(model).gesture.type !== 'idle')
        return { model };
      const cursor = { start: id, via: [] };
      if (!id) return { model: { ...model, journey: cursor } };
      if (!journey(graph, cursor).start) return { model };
      return update(
        { ...model, journey: cursor },
        canvasEvent({ type: 'NodeRevealRequested', id }),
      );
    },
    FollowedJourneyLink: ({ id }) => {
      const path = navigableJourney(model);
      const step = path?.choices.find((choice) => choice.id === id);
      if (!path || !step) return { model };
      return revealJourneyStep(
        model,
        [...path.steps, step].map((edge) => edge.id),
        step.target.id,
        journeyTriggerId(id),
      );
    },
    SteppedBackInJourney: ({ edgeId, depth }) => {
      const path = navigableJourney(model);
      if (!path?.start || path.steps.length !== depth || path.steps.at(-1)?.id !== edgeId)
        return { model };
      const remaining = path.steps.slice(0, -1);
      return revealJourneyStep(
        model,
        remaining.map((edge) => edge.id),
        (remaining.at(-1)?.target ?? path.start).id,
        journeyTriggerId(),
      );
    },
    SelectedInspector: ({ inspector }) => {
      if (inspector === 'journey' && model.emphasis !== 'event-storming') return { model };
      if (inspector === model.inspector) return { model };
      const next = withRailChange(model, { ...model, inspector });
      return inspector === 'selection' && model.assessment.status === 'editing'
        ? { model: next, commands: [FocusAssessmentInspector.make({})] }
        : { model: next };
    },
    SelectedEvolutionVersion: ({ value }) => ({
      model: { ...model, evolution: Evolution.inspect(model.evolution, value) },
    }),
    OpenedBoardImport: () => {
      const document = confirmedExportDocument(model);
      if (!document || !canOpenBoardImport(model)) return { model };
      return {
        model: {
          ...model,
          importRun: model.importRun + 1,
          boardImport: {
            version: document.version,
            child: importChild(model, 'likec4'),
            notice: '',
          },
        },
        commands: [FocusBoardControl.make({ selector: '#board-import-format' })],
      };
    },
    ClosedBoardImport: () => ({
      model: { ...model, boardImport: null },
      commands: [
        FocusBoardControl.make({
          selector:
            canOpenBoardImport(model) && railVisible(model, 'tools')
              ? '#board-open-import'
              : '#board-menu-file-toggle',
        }),
      ],
    }),
    ChoseBoardImportFormat: ({ format }) => {
      if (!model.boardImport || (model.boardImport.child.format ?? 'likec4') === format)
        return { model };
      return {
        model: {
          ...model,
          importRun: model.importRun + 1,
          boardImport: { ...model.boardImport, child: importChild(model, format), notice: '' },
        },
      };
    },
    GotBoardImportMessage: ({ run, message: childMessage }) => {
      const preview = model.boardImport;
      if (!preview || run !== model.importRun) return { model };
      if (childMessage._tag === 'ClickedApply') {
        if (boardImportBlockReason(model, preview.version)) return { model };
        const graph = DiagramImport.reviewedBoardGraph(preview.child);
        if (!graph?.nodes.length) return { model };
        const operation = {
          type: 'ImportEmptyBoard',
          expectedVersion: preview.version,
          graph,
        } as const;
        const request = {
          version: 1,
          operationId: `${model.room.generation}-${model.serial + 1}`,
          operation,
        };
        if (new TextEncoder().encode(JSON.stringify(request)).byteLength > requestLimit)
          return {
            model: {
              ...model,
              boardImport: { ...preview, notice: 'This import request exceeds 1 MiB.' },
            },
          };
        const step = enqueue({ ...model, boardImport: null }, operation);
        return {
          ...step,
          commands: [
            ...(step.commands ?? []),
            FocusBoardControl.make({ selector: '#shared-diagram-surface' }),
          ],
        };
      }
      const result = DiagramImport.update(preview.child, childMessage);
      return {
        model: { ...model, boardImport: { ...preview, child: result.model, notice: '' } },
        commands:
          result.commands?.map((command) =>
            Command.map(command, (message) => Message.GotBoardImportMessage({ run, message })),
          ) ?? [],
      };
    },
    OpenedLatestHistory: () => {
      const latest = model.evolution.samples.at(-1);
      return latest ? update(model, Message.OpenedHistory({ version: latest.version })) : { model };
    },
    OpenedHistory: ({ version, baseline }) => {
      if (!isLiveConnection(model.connection) || hasUncommittedEdit(model)) return { model };
      const review = HistoryReview.openHistory(
        model.evolution,
        version,
        editor(model),
        model.historyReducedMotion,
      );
      return review
        ? {
            model: {
              ...model,
              historyReview:
                baseline === undefined
                  ? review
                  : HistoryReview.chooseBaseline(review, String(baseline)),
              historyRun: model.historyRun + 1,
            },
            commands: [FocusBoardControl.make({ selector: '#history-back-live' })],
          }
        : { model };
    },
    ClosedHistory: () => ({
      model: { ...model, historyReview: null, historyRun: model.historyRun + 1 },
      commands: [
        FocusBoardControl.make({
          selector:
            railVisible(model, 'inspector') && model.inspector === 'evolution'
              ? '#board-open-history'
              : '#board-history-toggle',
        }),
      ],
    }),
    ChangedHistoryPlayback: ({ run, event }) => {
      const review = historyReview(model);
      if (!review || run !== model.historyRun) return { model };
      // SAFETY: Built-in playback controls supply the typed event.
      return {
        model: {
          ...model,
          historyRun: run + 1,
          historyReview: HistoryReview.advanceHistory(review, event as ZlozEditionPlaybackEvent),
        },
      };
    },
    ChangedHistoryBaseline: ({ run, id }) => {
      const review = historyReview(model);
      if (!review || run !== model.historyRun) return { model };
      return { model: { ...model, historyReview: HistoryReview.chooseBaseline(review, id) } };
    },
    NavigatedHistory: ({ run, event }) => {
      const review = historyReview(model);
      if (!review || run !== model.historyRun) return { model };
      // SAFETY: The historical canvas supplies the typed event, filtered by the SDK navigation allowlist.
      return {
        model: {
          ...model,
          historyReview: HistoryReview.navigateHistory(review, event as EditorEvent),
        },
      };
    },
    AdvancedHistoryPlayback: ({ run, milliseconds }) => {
      const review = historyReview(model);
      if (!review || run !== model.historyRun || !model.historyVisible) return { model };
      return {
        model: {
          ...model,
          historyReview: HistoryReview.advanceHistory(review, { type: 'Elapsed', milliseconds }),
        },
      };
    },
    ChangedHistoryMotion: ({ reducedMotion }) => {
      if (model.historyReducedMotion === reducedMotion) return { model };
      const review = historyReview(model);
      return {
        model: {
          ...model,
          historyReducedMotion: reducedMotion,
          historyRun: model.historyRun + 1,
          historyReview:
            review &&
            HistoryReview.advanceHistory(review, { type: 'ReducedMotionChanged', reducedMotion }),
        },
      };
    },
    ChangedHistoryVisibility: ({ visible }) => {
      const review = historyReview(model);
      return {
        model: {
          ...model,
          historyVisible: visible,
          historyRun: model.historyRun + 1,
          historyReview:
            review &&
            (visible ? review : HistoryReview.advanceHistory(review, { type: 'PauseClicked' })),
        },
      };
    },
    GotCouplingMessage: ({ room, message }) => {
      if (!current(model, room) || !couplingVisible(model)) return { model };
      const child = updateCoupling(
        model.coupling,
        Schema.decodeUnknownSync(CouplingMessage)(message),
      );
      const parent = { ...model, coupling: child.model };
      if (child.outMessage === undefined) return { model: parent, commands: [] };
      return CouplingOutMessage.match(child.outMessage, {
        SelectedRelationship: ({ id }): Return<Model, Message> => {
          if (isAuthoredGesture(editor(parent).gesture))
            return {
              model: {
                ...parent,
                coupling: {
                  ...parent.coupling,
                  announcement:
                    'Finish or cancel the canvas gesture before selecting another relationship.',
                },
              },
            };
          if (!parent.session.confirmed?.document.graph.edges.some((edge) => edge.id === id))
            return { model: parent };
          return update(
            parent,
            Message.ObservedEditorInput({
              event: { type: 'EdgeSelected', id, additive: false },
            }),
          );
        },
        RequestedAssessmentReview: ({ id }): Return<Model, Message> => {
          if (
            parent.assessment.status === 'editing' &&
            parent.assessment.draft.target.relationshipId !== id
          )
            return {
              model: {
                ...parent,
                coupling: {
                  ...parent.coupling,
                  announcement:
                    'Close the open assessment explicitly before reviewing another relationship. Your draft and save request are preserved.',
                },
              },
            };
          const opened = update(
            parent,
            Message.GotAssessmentMessage({
              room: parent.room,
              message: Assessment.Message.SelectedRelationship({ id }),
            }),
          );
          return {
            model: {
              ...opened.model,
              inspector: 'selection',
              coupling: { ...opened.model.coupling, width: null },
            },
            commands: [...(opened.commands ?? []), FocusAssessmentInspector.make({})],
          };
        },
      });
    },
    GotAssessmentMessage: ({ room, message }) => {
      if (!current(model, room)) return { model };
      const childMessage = Schema.decodeUnknownSync(Assessment.Message)(message);
      const result = Assessment.update(model.assessment, childMessage, {
        room: model.room,
        frame: model.session.confirmed,
        editable: model.role !== 'viewer' && model.connection._tag !== 'Denied',
        graphPending: model.session.pending !== null || model.queuedMove !== null,
      });
      return {
        model: { ...model, assessment: result.model },
        commands:
          result.commands?.map((command) =>
            Command.map(command, (message) => Message.GotAssessmentMessage({ room, message })),
          ) ?? [],
      };
    },
    SelectedWorkshopLink: ({ meaning }) => ({ model: { ...model, workshopLink: meaning } }),
    SelectedCanvasEmphasis: ({ emphasis }) => ({
      model: {
        ...model,
        emphasis,
        inspector:
          model.inspector === 'journey' && emphasis !== 'event-storming'
            ? ('selection' as const)
            : model.inspector,
        workshopLink: 'plain' as const,
      },
    }),
    SucceededIdentity: ({ generation }) => {
      if (model.room.generation) return { model };
      const room = { ...model.room, generation };
      return {
        model: { ...model, room, session: newSession(room) },
        commands: [LoadSharedDiagram.make({ room, run: model.socketRun })],
      };
    },
    FailedIdentity: () => ({
      model: { ...model, error: 'Could not prepare an editing session. Reload to retry.' },
    }),
    SucceededSnapshot: ({ room, frame, role, run, feed, decisionAuthoring, clefShadow }) => {
      if (
        !current(model, room) ||
        !isDiagramFrame(frame) ||
        !sameTarget(room, frame.target) ||
        (run !== undefined && run !== model.socketRun)
      )
        return { model };
      if (
        feed !== undefined &&
        (!Schema.is(DiagramFeedSchema)(feed) ||
          !sameTarget(room, feed.target) ||
          feed.sourceVersion > frame.sourceVersion)
      )
        return update(model, Message.FailedSnapshot({ room, run, status: 0 }));
      const validFeed = Schema.is(DiagramFeedSchema)(feed) ? feed : null;
      const seedRun = run ?? model.socketRun;
      const existing = model.feedSeeds.some((seed) => seed.run === seedRun);
      const next = {
        ...model,
        role,
        decisionAuthoring: decisionAuthoring === true,
        clefShadow: clefShadow === true,
        error: '',
        feedMode: validFeed ? ('delta' as const) : ('legacy' as const),
        feedSeeds:
          validFeed && !existing
            ? [
                ...model.feedSeeds.filter(
                  (seed) =>
                    seed.run ===
                    (model.connection._tag === 'Handoff'
                      ? model.connection.previousRun
                      : model.socketRun),
                ),
                { run: seedRun, feed: validFeed, frame },
              ]
            : model.feedSeeds,
      };
      // A replacement's HTTP bootstrap alone cannot retire the working channel.
      return {
        model:
          validFeed && model.connection._tag === 'Handoff' && !existing
            ? next
            : install(next, receiveFrame(session(model), room, frame)),
      };
    },
    FailedSnapshot: ({ room, status, run }) => {
      if (!current(model, room) || (run !== undefined && run !== model.socketRun)) return { model };
      const denied = status === 401 || status === 403 || status === 404;
      return {
        model: {
          ...model,
          connection: denied ? Connection.Denied() : Connection.Reconnecting(),
          historyReview: denied ? null : model.historyReview,
          boardImport: denied ? null : model.boardImport,
          evolution: denied ? Evolution.empty : model.evolution,
          // A failed HTTP snapshot can arrive after the feed recovered. Renew
          // the subscription as well as its label, rather than waiting for a
          // further edit or authorization-lease expiry to repair that state.
          socketRun: denied ? model.socketRun : model.socketRun + 1,
          reconnectDelayMs: denied ? model.reconnectDelayMs : 1000,
          peers: [],
          error:
            status === 401 || status === 403
              ? 'Access ended. Sign in again or contact the team owner.'
              : 'Diagram unavailable. Reconnecting…',
        },
      };
    },
    ObservedDelta: ({ room, run, cursor, delta }) => receiveDelta(model, room, run, cursor, delta),
    ObservedCaughtUp: ({ room, run, cursor }) => receiveDelta(model, room, run, cursor),
    ObservedFrame: ({ room, run, frame }) => {
      if (!current(model, room) || model.connection._tag === 'Denied' || !isDiagramFrame(frame))
        return { model };
      const handoff = model.connection._tag === 'Handoff' ? model.connection : null;
      if (run !== model.socketRun && run !== handoff?.previousRun) return { model };
      if (!sameTarget(model.room, frame.target)) return { model };
      const state = receiveFrame(session(model), room, frame);
      // Wrong targets and stale replacements cannot promote a channel.
      if (handoff && state === session(model)) return { model };
      const promoted = handoff && run === model.socketRun;
      return {
        model: install(
          {
            ...model,
            connection: handoff && !promoted ? handoff : Connection.Live(),
            socketSlot: promoted ? otherSlot(model.socketSlot) : model.socketSlot,
            error: '',
          },
          state,
        ),
      };
    },
    ObservedRenewal: ({ room, run }) =>
      !current(model, room) || model.connection._tag !== 'Live' || run !== model.socketRun
        ? { model }
        : {
            model: {
              ...model,
              connection: Connection.Handoff({
                previousRun: model.socketRun,
                previousDelayMs: model.reconnectDelayMs,
              }),
              socketRun: model.socketRun + 1,
              reconnectDelayMs: 0 as const,
            },
            commands:
              model.feedMode === 'delta'
                ? [LoadSharedDiagram.make({ room, run: model.socketRun + 1 })]
                : [],
          },
    ObservedDisconnect: ({ room, run, reason }) => {
      if (!current(model, room) || model.connection._tag === 'Denied') return { model };
      if (model.connection._tag === 'Handoff' && run === model.connection.previousRun)
        return {
          model: {
            ...model,
            connection: Connection.Reconnecting(),
            socketSlot: otherSlot(model.socketSlot),
          },
        };
      if (run !== model.socketRun) return { model };
      if (model.connection._tag === 'Handoff') {
        const next = { ...model, socketRun: run + 1, reconnectDelayMs: 1000 as const };
        return {
          model: next,
          commands:
            model.feedMode === 'delta'
              ? [LoadSharedDiagram.make({ room, run: next.socketRun })]
              : [],
        };
      }
      const next = {
        ...model,
        connection: Connection.Reconnecting(),
        socketSlot: model.socketSlot,
        socketRun: run + 1,
        reconnectDelayMs: reason === 'lease' ? (0 as const) : (1000 as const),
      };
      return {
        model: next,
        commands:
          model.feedMode === 'delta' ? [LoadSharedDiagram.make({ room, run: next.socketRun })] : [],
      };
    },
    ObservedTick: ({ room }) => {
      if (!current(model, room) || model.connection._tag === 'Denied') return { model };
      return {
        model,
        commands: [
          SendDiagramPresence.make({
            room,
            selection: [...editor(model).selectedNodes, ...editor(model).selectedEdges].slice(
              0,
              250,
            ),
            cursor: model.cursor,
          }),
          ...(!isLiveConnection(model.connection) ||
          session(model).pending ||
          (model.assessment.status === 'editing' && model.assessment.delivery.status !== 'ready')
            ? [LoadSharedDiagram.make({ room, run: model.socketRun })]
            : []),
        ],
      };
    },
    ObservedBoardTitle: ({ title }) => ({
      model: title.nameRevision > model.nameRevision ? { ...model, ...title } : model,
    }),
    SucceededPresence: ({ room, peers }) =>
      current(model, room) && model.connection._tag !== 'Denied'
        ? { model: { ...model, peers } }
        : { model },
    FailedPresence: ({ room, status }) =>
      current(model, room) && (status === 401 || status === 403)
        ? {
            model: {
              ...model,
              connection: Connection.Denied(),
              historyReview: null,
              boardImport: null,
              evolution: Evolution.empty,
              peers: [],
              error: 'Access ended. Sign in again or contact the team owner.',
            },
          }
        : current(model, room)
          ? { model: { ...model, peers: [] } }
          : { model },
    FailedIconAsset: ({ icon }) => ({
      model: model.failedIconAssets.includes(icon)
        ? model
        : {
            ...model,
            failedIconAssets: [...model.failedIconAssets, icon],
          },
    }),
    ToggledIconPicker: () => {
      const next = { ...model, icons: { ...model.icons, open: !model.icons.open } };
      return next.icons.open && next.icons.tab === 'team' && !next.icons.busy
        ? loadTeamIcons(next)
        : { model: next };
    },
    SelectedIconTab: ({ tab }) => {
      const next = { ...model, icons: { ...model.icons, tab } };
      return tab === 'team' && !model.icons.busy ? loadTeamIcons(next) : { model: next };
    },
    ChoseNodeIcon: ({ icon }) => {
      const target = selectedIconTarget(model);
      return target ? enqueue(model, { type: 'SetNodeIcon', ...target, icon }) : { model };
    },
    SelectedIconFile: ({ file }) =>
      model.role !== 'viewer' && !model.icons.busy && file instanceof File
        ? loadTeamIcons(model, file)
        : { model },
    ClickedArchiveIcon: ({ id }) =>
      model.role === 'owner' && !model.icons.busy ? loadTeamIcons(model, null, id) : { model },
    SettledIconLibrary: ({ run, entries, notice, applied }) => {
      if (run !== model.icons.run) return { model };
      const next = {
        ...model,
        icons: { ...model.icons, entries: entries ?? model.icons.entries, notice, busy: false },
      };
      const target = selectedIconTarget(model);
      if (!applied) return { model: next };
      if (target?.id === applied.id && target.expected === applied.expected)
        return enqueue(next, { type: 'SetNodeIcon', ...applied });
      return {
        model: {
          ...next,
          icons: {
            ...next.icons,
            notice: 'Icon added. Choose it to apply it to the current node.',
          },
        },
      };
    },
    ChangedLabel: ({ text }) => ({ model: { ...model, draft: text } }),
    ClickedAddWorkshopNote: ({ noteRole }) =>
      model.emphasis === 'event-storming'
        ? enqueue(model, {
            type: 'AddNode',
            expectedVersion: session(model).confirmed?.document.version ?? 0,
            node: createWorkshopNote(
              noteRole,
              `${model.room.generation}-node-${model.serial + 1}`,
              session(model).confirmed?.document.graph.nodes ?? [],
            ),
          })
        : { model },
    ClickedHotspotStatus: ({ id, expected, status }) => {
      const document = session(model).confirmed?.document;
      const current = hotspotStatus(document?.graph.nodes.find((node) => node.id === id));
      const clock = document?.nodes.find((node) => node.id === id);
      return model.emphasis === 'event-storming' &&
        editor(model).selectedNodes[0] === id &&
        current &&
        current !== status &&
        clock?.present &&
        (clock.hotspot ?? 0) === expected
        ? enqueue(model, { type: 'SetHotspotStatus', id, expected, status })
        : { model };
    },
    CompletedHotspotReveal: () => ({ model }),
    ClickedAdd: () =>
      enqueue(model, {
        type: 'AddNode',
        expectedVersion: session(model).confirmed?.document.version ?? 0,
        node: {
          id: `${model.room.generation}-node-${model.serial + 1}`,
          label: 'New node',
          position: {
            x: 60 + (model.serial % 6) * 190,
            y: 80 + Math.floor(model.serial / 6) * 130,
          },
          size: { width: 160, height: 90 },
          ports: [
            { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
            { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
          ],
        },
      }),
    ClickedRename: () => {
      const id = editor(model).selectedNodes[0];
      const clock = session(model).confirmed?.document.nodes.find((node) => node.id === id);
      return id && clock
        ? enqueue(model, { type: 'RenameNode', id, expected: clock.label, label: model.draft })
        : { model };
    },
    ClickedDelete: () =>
      enqueue(model, {
        type: 'Delete',
        expectedVersion: session(model).confirmed?.document.version ?? 0,
        nodeIds: editor(model).selectedNodes,
        edgeIds: editor(model).selectedEdges,
      }),
    ClickedUndo: () => {
      const operationId = model.ownEdits.at(-1)?.operationId;
      return operationId ? enqueue(model, { type: 'Undo', operationId }) : { model };
    },
    ClickedRetry: () => {
      const pending = session(model).pending;
      const next = !isLiveConnection(model.connection)
        ? { ...model, socketRun: model.socketRun + 1, reconnectDelayMs: 0 as const }
        : model;
      return pending && pending.status !== 'preparing' && model.connection._tag !== 'Denied'
        ? {
            model: next,
            commands: [
              SubmitSharedEdit.make({ room: model.room, request: pending.request }),
              LoadSharedDiagram.make({ room: model.room, run: next.socketRun }),
            ],
          }
        : {
            model: next,
            commands: [LoadSharedDiagram.make({ room: model.room, run: next.socketRun })],
          };
    },
    PreparedEdit: ({ room, request, hash }) => {
      if (!current(model, room) || preparing(model)?.operationId !== request.operationId)
        return { model };
      const state = beginEdit(session(model), request, hash);
      return {
        model: install(model, state),
        commands: [SubmitSharedEdit.make({ room, request })],
      };
    },
    FailedPreparation: ({ room }) =>
      !current(model, room) || !preparing(model)
        ? { model }
        : {
            model: install(
              { ...model, error: 'Could not prepare the edit. Try again.' },
              { ...session(model), pending: null },
            ),
          },
    SucceededEdit: ({ room, reply }) =>
      !current(model, room) || !isDiagramReply(reply)
        ? { model }
        : {
            // receiveReply checks exact identity/binding before it can clear the
            // pending request. Keep its accepted version if coverage was evicted.
            model: install(model, receiveReply(session(model), room, reply), reply.receipt),
            commands: [LoadSharedDiagram.make({ room, run: model.socketRun })],
          },
    FailedEdit: ({ room, operationId }) =>
      !current(model, room)
        ? { model }
        : {
            model: { ...model, session: unknownEdit(session(model), room, operationId) },
            commands: [LoadSharedDiagram.make({ room, run: model.socketRun })],
          },
    ObservedEditorInput: ({ event: raw }) => {
      // SAFETY: only zlozView's typed onEvent callback constructs this message.
      const event = raw as EditorEvent;
      if (event.type === 'UndoPressed') return update(model, Message.ClickedUndo());
      if (event.type === 'NodeMeasured') return { model };
      if (event.type === 'SurfaceMeasured') {
        const before = editor(model);
        const next = updateEditor(before, event);
        if (next === before) return { model };
        if (!before.surface || !next.surface) return { model: { ...model, editor: next } };
        // Both views are surface-relative. Leave an active gesture's camera pinned.
        const dx = (next.surface.width - before.surface.width) / 2;
        const dy = (next.surface.height - before.surface.height) / 2;
        const shift = (viewport: EditorState['viewport']) => ({
          ...viewport,
          x: viewport.x + dx,
          y: viewport.y + dy,
        });
        return {
          model: {
            ...model,
            editor: {
              ...next,
              viewport: before.gesture.type === 'idle' ? shift(next.viewport) : next.viewport,
              previousViewport: next.previousViewport ? shift(next.previousViewport) : null,
            },
          },
        };
      }
      const state = session(model);
      if (!state.confirmed) return { model };
      const continuingMove =
        state.pending !== null &&
        isGeometryOperation(state.pending.request.operation) &&
        model.queuedMove?._tag !== 'Blocked' &&
        (event.type === 'NodeDragStarted' ||
          event.type === 'SelectionNudged' ||
          (editor(model).gesture.type === 'node-drag' &&
            (event.type === 'PointerMoved' ||
              event.type === 'PointerReleased' ||
              event.type === 'GestureCancelled')));
      const locked =
        model.connection._tag === 'Denied' ||
        model.role === 'viewer' ||
        model.queuedMove?._tag === 'Blocked' ||
        (state.pending !== null && !continuingMove);
      const before = { ...editor(model), readOnly: locked };
      const observed = base(model) ?? state.confirmed.document;
      const result = bridgeEvent(
        before,
        event,
        observed,
        `${model.room.generation}-edge-${model.serial + 1}`,
      );
      let next = { ...model, editor: result.editor };
      if (event.type === 'PointerMoved')
        next = {
          ...next,
          cursor: {
            x: (event.point.x - before.viewport.x) / before.viewport.zoom,
            y: (event.point.y - before.viewport.y) / before.viewport.zoom,
          },
        };
      if (
        (event.type === 'NodeDragStarted' || event.type === 'NodeSelected') &&
        result.editor.selectedNodes[0] !== before.selectedNodes[0]
      )
        next = {
          ...next,
          draft:
            result.editor.graph.nodes.find((node) => node.id === result.editor.selectedNodes[0])
              ?.label ?? '',
        };
      if (
        isAuthoredGesture(result.editor.gesture) &&
        (event.type === 'NodeDragStarted' ||
          event.type === 'NodeResizeStarted' ||
          event.type === 'ConnectionDragStarted')
      )
        next = { ...next, base: { ...state.confirmed.document, graph: before.graph } };
      if (result.operation && !locked) {
        if ((state.pending || model.queuedMove) && result.operation.type === 'MoveNodes')
          return {
            model: {
              ...next,
              base: null,
              queuedMove: appendMove(model.queuedMove, result.operation),
            },
          };
        if (
          result.operation.type === 'Connect' &&
          model.emphasis === 'event-storming' &&
          model.workshopLink !== 'plain'
        ) {
          const edge = {
            ...result.operation.edge,
            architecture: { family: 'event-storming', role: model.workshopLink } as const,
          };
          const decision = resolveEventStormingRelationship(observed.graph, edge);
          if (decision.type !== 'allowed')
            return {
              model: {
                ...next,
                base: null,
                error: workshopLinkHint[model.workshopLink],
              },
            };
          return enqueue(next, {
            ...result.operation,
            edge: { ...edge, label: decision.rule.label },
          });
        }
        return enqueue(next, result.operation);
      }
      if (
        (event.type === 'PointerReleased' && result.editor.gesture.type === 'idle') ||
        event.type === 'GestureCancelled' ||
        (isAuthoredGesture(before.gesture) && !isAuthoredGesture(result.editor.gesture))
      )
        return { model: install({ ...next, base: null }, state) };
      return { model: next };
    },
  });
  return scheduleEdgeReveal(model, message, flushQueuedMove(step));
}

function scheduleEdgeReveal(
  before: Model,
  message: Message,
  step: Return<Model, Message>,
): Return<Model, Message> {
  const next = step.model;
  if (next === before) return step;

  const activeRun =
    next.connection._tag === 'Handoff'
      ? next.connection.previousRun
      : next.connection._tag === 'Live'
        ? next.socketRun
        : null;
  // A delta lane can install history before its explicit catch-up marker.
  // The legacy lane's first frame is its baseline.
  const reachedLive =
    (message._tag === 'ObservedCaughtUp' && next.feedMode === 'delta') ||
    (message._tag === 'ObservedFrame' && next.feedMode === 'legacy');
  const run =
    reachedLive && message.run === activeRun
      ? activeRun
      : before.edgeMotionRun === activeRun
        ? before.edgeMotionRun
        : null;

  if (run !== before.edgeMotionRun)
    return {
      ...step,
      model: { ...next, edgeMotionRun: run, deferredEdgeReveals: [] },
    };

  if (run === null) return step;

  const previous = before.session.confirmed;
  const confirmed = next.session.confirmed;
  const added =
    previous && confirmed && previous.undoResetVersion === confirmed.undoResetVersion
      ? introducedEdges(previous.document, confirmed.document)
      : [];
  if (
    next.emphasis === 'event-storming' &&
    !next.historyReview &&
    previous &&
    confirmed &&
    previous.undoResetVersion === confirmed.undoResetVersion
  ) {
    const changes = changedHotspots(previous.document, confirmed.document);
    if (changes.length)
      step = {
        ...step,
        commands: [...(step.commands ?? []), RevealHotspots.make({ run, changes })],
      };
  }
  const waiting = next.deferredEdgeReveals;
  if (!added.length && !waiting.length) return step;

  const visibleGraph = editor(next).graph;
  if (isAuthoredGesture(editor(next).gesture))
    return added.length
      ? { ...step, model: { ...next, deferredEdgeReveals: [...waiting, ...added] } }
      : step;

  // Reconcile a drag first, then reveal only edges in the resulting canvas graph.
  const visibleIds = new Set(visibleGraph.edges.map((edge) => edge.id));
  const confirmedIds = new Set(confirmed?.document.graph.edges.map((edge) => edge.id));
  const edgeIds: string[] = [];
  const deferredEdgeReveals: string[] = [];
  for (const id of [...waiting, ...added]) {
    if (!confirmedIds.has(id)) continue;
    if (visibleIds.has(id)) edgeIds.push(id);
    else deferredEdgeReveals.push(id);
  }
  return {
    model: { ...next, deferredEdgeReveals },
    commands: edgeIds.length
      ? [...(step.commands ?? []), RevealEdges.make({ run, edgeIds })]
      : step.commands,
  };
}

function flushQueuedMove(step: Return<Model, Message>): Return<Model, Message> {
  const model = step.model;
  const queued = model.queuedMove;
  const state = session(model);
  if (
    !queued ||
    queued._tag === 'Blocked' ||
    state.pending ||
    !state.confirmed ||
    model.role === 'viewer' ||
    model.connection._tag === 'Denied' ||
    isAuthoredGesture(editor(model).gesture)
  )
    return step;
  const operation: ZlozGraphOperation = { type: 'MoveNodes', nodes: queued.nodes };
  const decision = decideOperation(
    state.confirmed.document,
    { version: 1, operationId: `${model.room.generation}-${model.serial + 1}`, operation },
    {
      teamId: model.room.teamId,
      diagramId: model.room.diagramId,
      actorId: model.room.actorId,
    },
  );
  if (decision.type === 'rejected') {
    if (decision.receipt.code === 'NoChange')
      return { ...step, model: install({ ...model, queuedMove: null }, state) };
    return {
      ...step,
      model: install({ ...model, queuedMove: QueuedMove.Blocked({ nodes: queued.nodes }) }, state),
    };
  }
  const next = enqueue({ ...model, queuedMove: null }, operation);
  return { model: next.model, commands: [...(step.commands ?? []), ...(next.commands ?? [])] };
}

function historyReview(model: Model): HistoryReview.Review | null {
  // SAFETY: This transient state is installed only by the typed history reducer.
  const review = model.historyReview as HistoryReview.Review | null;
  return model.connection._tag === 'Denied' ? null : review;
}

function hasUncommittedEdit(model: Model): boolean {
  const gesture = editor(model).gesture.type;
  const selected = editor(model).graph.nodes.find(
    (node) => node.id === editor(model).selectedNodes[0],
  );
  return (
    session(model).pending !== null ||
    (model.opy.pending !== null && model.connection._tag !== 'Denied') ||
    model.queuedMove !== null ||
    gesture === 'node-drag' ||
    gesture === 'node-resize' ||
    gesture === 'connection-drag' ||
    (selected !== undefined && model.draft !== selected.label)
  );
}

export function saveStatus(model: Model): string {
  const state = session(model);
  const waiting = state.pending !== null;
  const gesture = editor(model).gesture.type;
  const preview =
    gesture === 'node-drag' || gesture === 'node-resize' || gesture === 'connection-drag';
  const selected = editor(model).graph.nodes.find(
    (node) => node.id === editor(model).selectedNodes[0],
  );
  const labelDraft = selected !== undefined && model.draft !== selected.label;
  const settledStatus =
    model.moveSaveIssue === 'conflict'
      ? 'Move conflict'
      : model.moveSaveIssue === 'rejected'
        ? 'Move rejected'
        : isLiveConnection(model.connection)
          ? 'Saved'
          : 'Reconnecting…';
  return model.connection._tag === 'Denied'
    ? 'Access ended'
    : model.queuedMove?._tag === 'Blocked'
      ? 'Queued moves need review'
      : waiting
        ? state.pending?.status === 'uncertain'
          ? 'Save outcome unknown'
          : 'Saving…'
        : model.queuedMove
          ? 'Saving…'
          : preview
            ? 'Editing…'
            : labelDraft
              ? 'Label draft — click Rename'
              : !state.confirmed
                ? 'Opening diagram…'
                : settledStatus;
}

function aggregateView(h: Html.H<Message>, graph: ZlozGraph, selectedId: string | null) {
  return aggregateViewContent(h, projectAggregate(graph, selectedId));
}

const iconPickerToggleView = (h: Html.H<Message>, open: boolean, disabled: boolean) =>
  h.button
    .attr('type', 'button')
    .disabled(disabled)
    .attr('aria-expanded', String(open))
    .on('click', Message.ToggledIconPicker())
    .children('Node icon');
const canvasEvent = (event: EditorEvent) => Message.ObservedEditorInput({ event });
const failedIcon = (icon: string) => Message.FailedIconAsset({ icon });
function layoutGhosts(h: Html.H<Message>, state: EditorState, preview: Layout.Proposal | null) {
  if (!preview) return [];
  const nodes = new Map(state.graph.nodes.map((node) => [node.id, node]));
  return preview.moves.flatMap(({ id, position }) => {
    const node = nodes.get(id);
    if (!node) return [];
    return [
      h.div
        .key(id)
        .class(node.kind === 'group' ? 'layout-ghost layout-ghost-group' : 'layout-ghost')
        .attrs({
          'aria-hidden': 'true',
          'data-layout-ghost': id,
          'data-layout-x': String(position.x),
          'data-layout-y': String(position.y),
        })
        .style({
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${node.size.width}px`,
          height: `${node.size.height}px`,
        })
        .children(node.label),
    ];
  });
}

function overviewToggleView(h: Html.H<Message>, open: boolean, enabled: boolean) {
  return h.button
    .id('board-overview-toggle')
    .attr('type', 'button')
    .disabled(!enabled)
    .attr('aria-controls', 'board-overview')
    .attr('aria-expanded', String(open))
    .on('click', Message.ToggledOverview())
    .children('Overview');
}

const infrastructureSource = Schema.decodeUnknownOption(
  Schema.Struct({
    alchemyInfrastructure: Schema.Struct({
      stack: Schema.String,
      stage: Schema.String,
      revision: Schema.String,
      type: Schema.optional(Schema.String),
      omissions: Schema.Array(Schema.String),
    }),
  }),
);

function infrastructureDetails(h: Html.H<Message>, node: ZlozNode) {
  const decoded = infrastructureSource(node.data);
  if (Option.isNone(decoded)) return [];
  const record = decoded.value.alchemyInfrastructure;
  const omissions = record.omissions;
  return [
    h.section
      .attr('aria-label', 'Alchemy source')
      .children(
        h.h3.children('Alchemy source'),
        h.p.children(`${record.stack} · ${record.stage} · ${record.revision}`),
        ...(record.type ? [h.p.children(record.type)] : []),
        ...(omissions.length ? [h.ul.children(omissions.map((item) => h.li.children(item)))] : []),
      ),
  ];
}

function cameraButton(
  h: Html.H<Message>,
  label: string,
  disabled: boolean,
  type: 'Zoomed' | 'FitViewClicked' | 'FitSelectionClicked' | 'PreviousViewClicked',
  x?: number,
  y?: number,
  factor?: number,
) {
  const event: EditorEvent =
    type === 'Zoomed' ? { type, point: { x: x ?? 0, y: y ?? 0 }, factor: factor ?? 1 } : { type };
  return viewportControl(h, { label, disabled, event }, canvasEvent).children(label);
}

function addNodeButton(h: Html.H<Message>, _key: 'add-node', disabled: boolean) {
  return h.button
    .attr('type', 'button')
    .disabled(disabled)
    .on('click', Message.ClickedAdd())
    .children(teamIcon(h, 'plus'), h.span.children('Add node'));
}

function canvasView(
  h: Html.H<Message>,
  state: EditorState,
  disabled: boolean,
  peers: Model['peers'],
  generation: string,
  teamId: string,
  failedIconAssets: readonly string[],
  geometrySaving: boolean,
  overview: boolean | null,
  layoutPreview: Layout.Proposal | null,
) {
  const onEvent = canvasEvent;
  const canShowOverview =
    overview !== null && Boolean(state.surface) && state.graph.nodes.length > 0;
  const editor = { ...state, readOnly: disabled };
  const controls = viewportControlActions(editor);
  const minimap =
    overview === true && canShowOverview
      ? historyMinimap(h, editor, onEvent, { onEscape: Message.ToggledOverview() })
      : null;
  const connections = resolveConnectionList(editor, editor.graph.edges, {
    id: 'shared-diagram',
    compact: false,
    contextActions: false,
    toolbarEdgeId: undefined,
  });
  const status = canvasStatusContext(
    editor.notice,
    editor.graph.nodes.length,
    editor.graph.edges.length,
    true,
  );
  return h.div.class('board-canvas').children(
    graphSurface(h, editor, {
      id: 'shared-diagram',
      label: 'Shared team diagram',
      descriptionId: 'shared-diagram-help',
      onInput: onEvent,
      theme: teamCanvasTheme,
      wheelNavigation: 'zoom',
      stablePointerOrigin: true,
      viewportCulling: true,
      resizeHandles: true,
      reconnect: true,
      edgeEditing: { onEdit: onEvent },
      policy: {
        canResizeNode: (node) =>
          geometrySaving
            ? 'Finish saving this move before resizing'
            : node.kind === 'group'
              ? 'Group resizing is not shared yet'
              : null,
        canConnectPort: () => (geometrySaving ? 'Finish saving this move before connecting' : null),
      },
      renderPort: ({ port, target }) => ({
        className: target ? 'shared-node-port is-target' : 'shared-node-port',
        content: port.kind === 'output' ? '+' : '−',
      }),
      renderNodeShell: ({ node, selected }, builder) =>
        nodeShell(
          builder,
          node,
          selected,
          teamId,
          failedIconAssets.includes(node.icon ?? ''),
          failedIcon,
        ),
      renderGroupShell: () => ({
        className: 'shared-group',
        title: { className: 'shared-group-title' },
      }),
      renderWorldOverlay: (_nodes, builder) =>
        builder.div.children(
          ...layoutGhosts(builder, state, layoutPreview),
          ...peers
            .filter((peer) => peer.connectionId !== generation && peer.cursor !== null)
            .map((peer) =>
              builder.div
                .key(peer.connectionId)
                .class('peer-cursor')
                .style({
                  position: 'absolute',
                  left: `${peer.cursor!.x}px`,
                  top: `${peer.cursor!.y}px`,
                })
                .children(`↖ ${peer.name}`),
            ),
        ),
    }),
    h.div.class('board-navigation').children(
      h.div
        .class('board-viewport-controls')
        .children(
          ...[
            controls.zoomIn,
            controls.zoomOut,
            controls.fitView,
            controls.fitSelection,
            controls.previousView,
          ].flatMap(({ label, disabled, event }) =>
            event.type === 'Zoomed'
              ? [
                  h.lazy(
                    cameraButton,
                    label,
                    disabled,
                    event.type,
                    event.point.x,
                    event.point.y,
                    event.factor,
                  ),
                ]
              : event.type === 'FitViewClicked' ||
                  event.type === 'FitSelectionClicked' ||
                  event.type === 'PreviousViewClicked'
                ? [h.lazy(cameraButton, label, disabled, event.type)]
                : [],
          ),
        ),
      h.lazy(overviewToggleView, minimap != null, canShowOverview),
      h.div
        .id('board-overview')
        .class('board-popover-content', 'board-overview')
        .attr('hidden', minimap == null ? '' : undefined)
        .children(minimap),
      h.details
        .class('board-popover')
        .children(
          h.summary.children('Browse relationships'),
          h.div.class('board-popover-content').children(sharedConnections(connections, h)),
        ),
      h.details
        .class('board-popover')
        .children(
          h.summary.children('Canvas help'),
          h.div
            .id('shared-diagram-help')
            .class('board-popover-content')
            .children(
              'Drag a node title to move it, or focus its title and use arrow keys. Drag the background to pan and scroll to zoom. Activate an output port, then an input port to connect. Escape cancels a gesture.',
            ),
        ),
      h.a.class('board-skip').attr('href', '#shared-diagram-surface').children('Skip to canvas'),
    ),
    h.p.attr('role', 'status').attr('data-flow-status', '').children(status.defaultText),
  );
}

function layoutLauncherView(h: Html.H<Message>, method: Layout.Method, enabled: boolean) {
  return h.div.children(
    h.label.class('canvas-mode').children(
      'Layout action',
      h.select
        .value(method)
        .on('change', ({ value }) =>
          Message.SelectedLayoutMethod({
            method: Schema.is(Layout.Method)(value) ? value : method,
          }),
        )
        .children(
          Layout.Method.literals.map((value) =>
            h.option.attr('value', value).children(Layout.methods[value].label),
          ),
        ),
    ),
    h.button
      .id('board-layout-open')
      .class('layout-launcher')
      .attr('type', 'button')
      .attr('title', `Select at least ${Layout.methods[method].minimum} sibling nodes or groups`)
      .disabled(!enabled)
      .on('click', Message.ClickedLayoutPreview({ method }))
      .children('Preview selection layout'),
  );
}

function layoutPanel(model: Model, h: Html.H<Message>, reason: string | null) {
  const ready = model.layout._tag === 'Ready';
  return h.div
    .id('board-layout-preview')
    .class('board-layout-preview')
    .attr('role', 'region')
    .attr('aria-label', 'Selection layout preview')
    .attr('tabindex', String(-1))
    .on(
      'keydown',
      ({ key }) =>
        Option.getOrUndefined(
          key === 'Escape' ? Option.some(Message.DiscardedLayoutPreview()) : Option.none(),
        ),
      { preventDefault: true },
    )
    .children(
      h.p.children(h.strong.children(Layout.methods[model.layoutMethod].label)),
      h.p
        .attr('role', 'status')
        .children(
          model.layout._tag === 'Failed'
            ? model.layout.message
            : model.layout._tag === 'Running'
              ? 'Preparing selection layout…'
              : (reason ?? 'Layout preview is visible only to you.'),
        ),
      h.div.class('layout-preview-actions').children(
        ...(ready
          ? [
              h.button
                .attr('type', 'button')
                .disabled(reason !== null)
                .on('click', Message.ClickedApplyLayout({ run: model.layoutRun }))
                .children('Apply layout'),
            ]
          : []),
        h.button
          .attr('type', 'button')
          .on('click', Message.DiscardedLayoutPreview())
          .children('Discard layout'),
      ),
    );
}

function sourceExportPanelView(
  h: Html.H<Message>,
  review: SourceExport.Review,
  availability: SourceExport.Availability,
) {
  const { kind, version } = review;
  return SourceExport.view(h, review, availability, {
    close: Message.ClosedSourceExport(),
    refresh: Message.OpenedSourceExport({ kind }),
    accept: (accepted) => Message.ChangedSourceExportConsent({ kind, version, accepted }),
    download: (format) => Message.ClickedSourceDownload({ kind, version, format }),
  });
}

function sourceExportLauncherView(h: Html.H<Message>, kind: SourceExport.Kind, available: boolean) {
  return h.button
    .id(SourceExport.launcherId(kind))
    .class('mermaid-launcher')
    .attr('type', 'button')
    .disabled(!available)
    .on('click', Message.OpenedSourceExport({ kind }))
    .children(`Export ${SourceExport.label(kind)}`);
}

function svgLauncherView(h: Html.H<Message>, available: boolean) {
  return h.button
    .id('board-svg-open')
    .class('svg-launcher')
    .attr('type', 'button')
    .disabled(!available)
    .on('click', Message.OpenedSvg())
    .children('Export SVG');
}

function workshopJourneyPanel(h: Html.H<Message>, graph: ZlozGraph, cursor: Model['journey']) {
  return journeyView(h, journey(graph, cursor), {
    start: (id) => Message.ChoseJourneyStart({ id }),
    follow: (id) => Message.FollowedJourneyLink({ id }),
    back: (edgeId, depth) => Message.SteppedBackInJourney({ edgeId, depth }),
    reveal: (type, id) =>
      canvasEvent({ type: type === 'node' ? 'NodeRevealRequested' : 'EdgeRevealRequested', id }),
  });
}

function evolutionInspectorView(
  h: Html.H<Message>,
  history: Evolution.History,
  connection: 'live' | 'offline' | 'denied',
  availability: 'available' | 'blocked',
  perspective: EvolutionPerspective,
) {
  return evolutionView(
    h,
    history,
    connection,
    (value) => Message.SelectedEvolutionVersion({ value }),
    (version, baseline) => Message.OpenedHistory({ version, baseline }),
    availability,
    perspective,
  );
}

function svgPanelView(h: Html.H<Message>, review: Svg.Review, availability: Svg.Availability) {
  const controls = Svg.resolve(review, availability);
  const request = (value: ZlozSvgReviewRequest) => Message.ObservedSvgReview({ request: value });
  return h.div
    .id('board-svg')
    .class('board-svg')
    .attr('role', 'region')
    .attr('aria-label', 'SVG export preview')
    .attr('tabindex', String(-1))
    .on(
      'keydown',
      ({ key }) =>
        Option.getOrUndefined(key === 'Escape' ? Option.some(Message.ClosedSvg()) : Option.none()),
      { preventDefault: true },
    )
    .children(
      h.div
        .class('mermaid-review-header')
        .children(
          h.div.children(
            h.h2.children('SVG export'),
            h.p.children(`Confirmed version ${review.version}`),
          ),
          h.button
            .attr('type', 'button')
            .on('click', Message.ClosedSvg())
            .children('Close SVG preview'),
        ),
      svgReview(h, controls, request, {
        idPrefix: 'team-svg',
        hideRegion: true,
        diagnostics: { instructions: false, measurements: false },
        status: review.notice || 'SVG is ready to download.',
        showAcceptance: availability === 'current',
        renderLayout: ({ settings, preview, findings, acceptance, download, status }, builder) => [
          builder.div
            .class('mermaid-review-body')
            .children(
              builder.div.class('svg-review-settings').children(settings),
              preview,
              builder.p.children(
                'Exports the confirmed graph. Live board controls, custom backgrounds, presence, assessments, decisions and generic icons on non-C4 nodes are omitted.',
              ),
              findings,
            ),
          builder.div
            .class('mermaid-review-footer', 'svg-review-footer')
            .children(
              status,
              acceptance,
              availability === 'newer'
                ? builder.button
                    .attr('type', 'button')
                    .on('click', Message.OpenedSvg())
                    .children('Review latest version')
                : null,
              download,
            ),
        ],
      }),
    );
}

function commandBarView(
  h: Html.H<Message>,
  active: BoardCommand,
  teamId: string,
  role: Model['role'],
  importAvailable: boolean,
  exportAvailable: boolean,
  undoAvailable: boolean,
  deleteAvailable: boolean,
  layoutSelection: number,
  reviewAvailable: boolean,
  focused: boolean,
  exportUrl: string,
  accessEnded: boolean,
) {
  // Native popovers provide exclusive opening, Escape, light dismissal and keyboard focus return.
  const commands = BoardCommand.literals.filter(
    (name) => name !== 'History' || (reviewAvailable && !accessEnded),
  );
  const tabStop = commands.includes(active) ? active : 'File';
  const trigger = (name: BoardCommand) =>
    h.button
      .attr('type', 'button')
      .id(triggerId(name))
      .attr('tabindex', String(name === tabStop ? 0 : -1))
      .on('focus', Message.FocusedBoardCommand({ name }))
      .on(
        'keydown',
        ({ key }) => {
          if (key !== 'ArrowLeft' && key !== 'ArrowRight') return undefined;
          const offset = key === 'ArrowRight' ? 1 : -1;
          const index = (commands.indexOf(name) + offset + commands.length) % commands.length;
          return Message.NavigatedBoardCommands({ name: commands[index]! });
        },
        { preventDefault: true },
      );
  const menu = (name: BoardCommand, contents: (id: string) => readonly View.Input<Message>[]) => {
    const id = `board-menu-${name.toLowerCase()}`;
    return h.div.class('board-menu').children(
      trigger(name).attr('popovertarget', id).children(name),
      h.div
        .id(id)
        .attr('popover', 'auto')
        .class('board-command-list')
        .attr('aria-label', name)
        .attr('role', 'group')
        .children(...contents(id)),
    );
  };
  const action = (id: string, label: string, message: Message, enabled = true) =>
    h.button
      .attr('type', 'button')
      .disabled(!enabled || accessEnded)
      .attr('popovertarget', id)
      .attr('popovertargetaction', 'hide')
      .on('click', message)
      .children(label);

  return h.div
    .class('board-command-bar')
    .attr('role', 'toolbar')
    .attr('aria-label', 'Board commands')
    .children(
      menu('File', (id) => [
        action(id, 'Import into empty board…', Message.OpenedBoardImport(), importAvailable),
        action(
          id,
          'Export Mermaid…',
          Message.OpenedSourceExport({ kind: 'mermaid' }),
          exportAvailable,
        ),
        action(
          id,
          'Export LikeC4…',
          Message.OpenedSourceExport({ kind: 'likec4' }),
          exportAvailable,
        ),
        ...(exportAvailable
          ? [h.a.attr('href', exportUrl).children('Download confirmed JSON')]
          : []),
        action(id, 'Export SVG…', Message.OpenedSvg(), exportAvailable),
        ...(role === 'owner' && !accessEnded
          ? [
              h.a
                .attr('href', `/app/${encodeURIComponent(teamId)}?view=settings`)
                .children('Team settings'),
            ]
          : []),
      ]),
      menu('Edit', (id) => [
        action(id, 'Undo my last edit', Message.ClickedUndo(), undoAvailable),
        action(id, 'Delete selection', Message.ClickedDelete(), deleteAvailable),
        action(id, 'Find on board…', Message.OpenedFind()),
      ]),
      menu('View', (id) => [
        action(id, focused ? 'Exit focus' : 'Focus board', Message.ToggledBoardFocus()),
        action(id, 'Review latest version', Message.OpenedLatestHistory(), reviewAvailable),
      ]),
      menu('Arrange', (id) =>
        Layout.Method.literals.map((method) =>
          action(
            id,
            Layout.methods[method].label + '…',
            Message.ClickedLayoutPreview({ method }),
            layoutSelection >= Layout.methods[method].minimum,
          ),
        ),
      ),
      menu('Help', () => [
        h.p.children(
          'Drag the background to pan. Scroll to zoom. Use Find to locate a node or relationship.',
        ),
        ...(role !== 'viewer' && !accessEnded
          ? [
              h.p.children(
                'Move a node by its title or focus the title and press an arrow key. Escape cancels the gesture.',
              ),
            ]
          : []),
      ]),
      trigger('History')
        .disabled(accessEnded || !reviewAvailable)
        .on('click', Message.OpenedLatestHistory())
        .children('History'),
    );
}

function boardControlsView(
  h: Html.H<Message>,
  toolsOpen: boolean,
  inspectorOpen: boolean,
  findOpen: boolean,
  focused: boolean,
  accessEnded: boolean,
) {
  const railToggle = (rail: typeof Rail.Type, open: boolean, label: string) =>
    h.button
      .attr('type', 'button')
      .disabled(accessEnded)
      .id(`board-${rail}-toggle`)
      .attr('aria-controls', `board-${rail}`)
      .attr('aria-expanded', String(open))
      .on('click', Message.ToggledBoardRail({ rail }))
      .children(label);
  return h.div.class('board-controls').children(
    railToggle('tools', toolsOpen, 'Tools'),
    railToggle('inspector', inspectorOpen, 'Inspector'),
    h.button
      .id('board-find-toggle')
      .attr('type', 'button')
      .disabled(accessEnded)
      .attr('aria-controls', 'board-find')
      .attr('aria-expanded', String(findOpen))
      .on('click', findOpen ? Message.ClosedFind() : Message.OpenedFind())
      .children('Find'),
    h.button
      .attr('type', 'button')
      .disabled(accessEnded)
      .on('click', Message.ToggledBoardFocus())
      .children(focused ? 'Exit focus' : 'Focus board'),
  );
}

function boardImportView(
  model: Model,
  h: Html.H<Message>,
  preview: NonNullable<Model['boardImport']>,
) {
  const run = model.importRun;
  const reason = boardImportBlockReason(model, preview.version);
  return h.section
    .class('board-import')
    .attr('aria-label', 'Import into this board')
    .children(
      h.header.children(
        h.h2.children('Import into this board'),
        h.button
          .attr('type', 'button')
          .on('click', Message.ClosedBoardImport())
          .children('Close import'),
      ),
      h.div.class('board-import-content').children(
        h.label.children(
          'Import format',
          h.select
            .id('board-import-format')
            .value(preview.child.format ?? 'likec4')
            .on('change', ({ value }) =>
              Message.ChoseBoardImportFormat({
                format: value === 'alchemy' ? 'alchemy' : 'likec4',
              }),
            )
            .children(
              h.option.attr('value', 'likec4').children('LikeC4'),
              h.option.attr('value', 'alchemy').children('Alchemy infrastructure'),
            ),
        ),
        ...(preview.notice ? [h.p.attr('role', 'alert').children(preview.notice)] : []),
        DiagramImport.view(
          h,
          preview.child,
          (message) => Message.GotBoardImportMessage({ run, message }),
          reason,
        ),
      ),
    );
}

export function view(model: Model, h: Html.H<Message>) {
  const review = historyReview(model);
  if (review) {
    const run = model.historyRun;
    return {
      title: `${model.name} | ZLOZ`,
      body: HistoryReview.historyView(h, review, session(model).confirmed?.document.version ?? -1, {
        close: Message.ClosedHistory(),
        playback: (event) => Message.ChangedHistoryPlayback({ run, event }),
        baseline: (id) => Message.ChangedHistoryBaseline({ run, id }),
        navigate: (event) => Message.NavigatedHistory({ run, event }),
      }),
    };
  }
  const state = session(model);
  const status = saveStatus(model);
  const waiting = state.pending !== null || model.queuedMove !== null;
  const disabled =
    waiting ||
    model.connection._tag === 'Denied' ||
    model.role === 'viewer' ||
    !state.confirmed ||
    !model.room.generation;
  const currentEditor = editor(model);
  const canContinueMoving =
    waiting &&
    model.queuedMove?._tag !== 'Blocked' &&
    state.confirmed !== null &&
    model.role !== 'viewer' &&
    model.connection._tag !== 'Denied' &&
    (!state.pending || isGeometryOperation(state.pending.request.operation));
  const canvasDisabled = disabled && !canContinueMoving;
  const selected = currentEditor.graph.nodes.find(
    (node) => node.id === currentEditor.selectedNodes[0],
  );
  const onEvent = canvasEvent;
  const workshopMode = model.emphasis === 'event-storming';
  const modeName = canvasModeLabels[model.emphasis];
  const selectedHotspot = workshopMode ? hotspotStatus(selected) : null;
  const selectedHotspotClock = selectedHotspot
    ? state.confirmed?.document.nodes.find((node) => node.id === selected?.id)
    : undefined;
  const toolsOpen = railVisible(model, 'tools');
  const inspectorOpen = railVisible(model, 'inspector');
  const showOpy = model.inspector === 'opy' && opyAvailable(model);
  const accessEnded = model.connection._tag === 'Denied';
  const layout = !accessEnded && model.layout._tag === 'Ready' ? model.layout.proposal : null;
  const layoutStale = layout ? layoutStaleReason(model, layout) : null;
  const layoutReason = layout ? Option.getOrNull(layoutApplyReason(model, layoutStale)) : null;
  const exportDocument = confirmedExportDocument(model);
  const sourceReview = accessEnded ? null : model.sourceExport;
  const svg = accessEnded ? null : model.svg;
  const findOpen = !accessEnded && model.find !== null;
  const matches = findOpen ? findMatches(currentEditor, model.find ?? '') : [];
  const findLimit = 20;
  return {
    title: `${model.name} | ZLOZ`,
    body: h.div
      .class('shared-editor')
      .attr('data-canvas-emphasis', model.emphasis)
      .attr('data-inspector-mode', model.inspector)
      .attr('data-tools-open', String(toolsOpen))
      .attr('data-inspector-open', String(inspectorOpen))
      .attr('data-confirmed-version', String(state.confirmed?.document.version ?? -1))
      .attr('data-edge-motion-run', String(model.edgeMotionRun ?? ''))
      .children(
        h.div
          .class('canvas-toolbar')
          .attr('role', 'group')
          .attr('aria-label', 'Board controls')
          .children(
            h.lazy(
              commandBarView,
              model.activeBoardCommand,
              model.room.teamId,
              model.role,
              canOpenBoardImport(model) && !model.boardImport,
              exportDocument !== undefined,
              !disabled && model.ownEdits.length > 0,
              !disabled &&
                (currentEditor.selectedNodes.length > 0 || currentEditor.selectedEdges.length > 0),
              isLiveConnection(model.connection) &&
                currentEditor.gesture.type === 'idle' &&
                model.layout._tag !== 'Running'
                ? currentEditor.selectedNodes.length
                : 0,
              isLiveConnection(model.connection) &&
                !hasUncommittedEdit(model) &&
                model.evolution.samples.length > 0,
              model.focusedBoard,
              `${pathFor(model.room)}/export`,
              accessEnded,
            ),
            h.lazy(
              boardControlsView,
              toolsOpen,
              inspectorOpen,
              findOpen,
              model.focusedBoard,
              accessEnded,
            ),
            h.div.class('board-session').children(
              h.span
                .class('mode-badge')
                .children(teamIcon(h, model.emphasis === 'c4' ? 'package' : 'cube', 16), modeName),
              h.span
                .attr('role', 'status')
                .attr('data-save-status', status)
                .attr('aria-live', 'polite')
                .children(status),
              ...((state.pending?.status === 'uncertain' || !isLiveConnection(model.connection)) &&
              model.connection._tag !== 'Denied'
                ? [
                    h.button
                      .attr('type', 'button')
                      .on('click', Message.ClickedRetry())
                      .children(state.pending ? 'Retry saved request' : 'Reconnect'),
                  ]
                : []),
              h.details.class('board-popover board-presence').children(
                h.summary.children(`Here now · ${model.peers.length}`),
                h.div
                  .class('board-popover-content presence')
                  .attr('aria-label', 'Teammates in this diagram')
                  .children(
                    model.peers.length
                      ? model.peers.map((peer) =>
                          h.span.children(
                            `${peer.name}${peer.connectionId === model.room.generation ? ' (you)' : ''}${peer.selection.length ? ` · ${peer.selection.length} selected` : ''}`,
                          ),
                        )
                      : [h.span.children('No teammates reported yet.')],
                  ),
              ),
            ),
          ),
        h.div
          .id('board-find')
          .class('board-find')
          .attr('role', 'search')
          .attr('aria-label', 'Find on board')
          .attr('hidden', !findOpen ? '' : undefined)
          .on(
            'keydown',
            ({ key }) =>
              Option.getOrUndefined(
                key === 'Escape' ? Option.some(Message.ClosedFind()) : Option.none(),
              ),
            { preventDefault: true },
          )
          .children(
            findOpen
              ? [
                  h.div.class('find-controls').children(
                    h.label.children(
                      'Find on board',
                      h.input
                        .id('board-find-query')
                        .attr('type', 'search')
                        .value(model.find ?? '')
                        .on('input', ({ value: query }) => Message.ChangedFind({ query })),
                    ),
                    h.button
                      .attr('type', 'button')
                      .on('click', Message.ClosedFind())
                      .children('Close Find'),
                  ),
                  h.p
                    .attr('role', 'status')
                    .children(
                      !model.find?.trim()
                        ? 'Search nodes or relationships by name or ID.'
                        : matches.length > findLimit
                          ? `Showing ${findLimit} of ${matches.length} matches. Refine to narrow results.`
                          : matches.length === 0
                            ? 'No matches.'
                            : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}.`,
                    ),
                  ...(matches.length
                    ? [
                        h.ul.class('find-results').children(
                          matches.slice(0, findLimit).map(({ target, id, label }) =>
                            h.li.key(`${target}:${id}`).children(
                              h.button
                                .attr('type', 'button')
                                .on('click', Message.ChoseFindResult({ target, id }))
                                .children(
                                  target === 'node'
                                    ? `Reveal ${label} (${id})`
                                    : `Reveal connection ${label}`,
                                ),
                            ),
                          ),
                        ),
                      ]
                    : []),
                ]
              : [],
          ),
        ...(sourceReview
          ? [
              h.lazy(
                sourceExportPanelView,
                sourceReview,
                !exportDocument
                  ? 'offline'
                  : exportDocument.version === sourceReview.version
                    ? 'current'
                    : 'newer',
              ),
            ]
          : []),
        ...(svg ? [h.lazy(svgPanelView, svg, Svg.availability(svg, exportDocument))] : []),
        ...(!accessEnded && model.boardImport
          ? [boardImportView(model, h, model.boardImport)]
          : []),
        h.aside
          .id('board-tools')
          .class('tool-rail')
          .attr('aria-label', 'Diagram tools')
          .attr('hidden', !toolsOpen ? '' : undefined)
          .attr('tabindex', String(-1))
          .children(
            toolsOpen
              ? [
                  h.h2.class('rail-heading').children('Diagram tools'),
                  ...(opyAvailable(model)
                    ? [
                        h.button
                          .id('ask-opy')
                          .attr('type', 'button')
                          .class('opy-launcher')
                          .on('click', Message.OpenedOpy())
                          .children('Ask OPY'),
                      ]
                    : []),
                  h.label.class('canvas-mode').children(
                    'Canvas emphasis',
                    h.select
                      .value(model.emphasis)
                      .attr('aria-label', 'Canvas emphasis')
                      .on('change', ({ value }) =>
                        Message.SelectedCanvasEmphasis({
                          emphasis: Schema.is(CanvasEmphasis)(value) ? value : model.emphasis,
                        }),
                      )
                      .children(
                        CanvasEmphasis.literals.map((emphasis) =>
                          h.option.attr('value', emphasis).children(canvasModeLabels[emphasis]),
                        ),
                      ),
                  ),
                  ...(workshopMode && model.role !== 'viewer'
                    ? [
                        h.label.class('canvas-mode').children(
                          'Connection meaning',
                          h.select
                            .value(model.workshopLink)
                            .disabled(disabled)
                            .on('change', ({ value }) =>
                              Message.SelectedWorkshopLink({
                                meaning: Schema.is(WorkshopLink)(value)
                                  ? value
                                  : model.workshopLink,
                              }),
                            )
                            .children(
                              h.option.attr('value', 'plain').children('Plain connection'),
                              h.option
                                .attr('value', 'produces')
                                .children('Produces · command → domain event'),
                              h.option
                                .attr('value', 'activates')
                                .children('Activates · domain event → policy'),
                              h.option
                                .attr('value', 'triggers')
                                .children('Triggers · policy → command'),
                            ),
                        ),
                      ]
                    : []),
                  h.p
                    .class('mode-note')
                    .children(
                      workshopMode
                        ? 'Capture what happened and flag questions for the team.'
                        : 'View applies only to you.',
                    ),
                  h.div.class('editor-actions').children(
                    h.div.class('editor-primary-actions').children(
                      ...(workshopMode
                        ? workshopNotes.slice(0, 2).map(({ role, label }) =>
                            h.button
                              .key(role)
                              .attr('type', 'button')
                              .disabled(disabled)
                              .on('click', Message.ClickedAddWorkshopNote({ noteRole: role }))
                              .children(teamIcon(h, 'plus'), h.span.children(label)),
                          )
                        : [h.lazy(addNodeButton, 'add-node', disabled)]),
                      ...(canOpenBoardImport(model) && !model.boardImport
                        ? [
                            h.button
                              .id('board-open-import')
                              .attr('type', 'button')
                              .on('click', Message.OpenedBoardImport())
                              .children('Import…'),
                          ]
                        : []),
                    ),
                    ...(workshopMode
                      ? [
                          h.details.class('board-popover').children(
                            h.summary.children('More workshop notes'),
                            h.div.class('board-popover-content').children(
                              workshopNotes.slice(2).map(({ role, label }) =>
                                h.button
                                  .key(role)
                                  .attr('type', 'button')
                                  .disabled(disabled)
                                  .on('click', Message.ClickedAddWorkshopNote({ noteRole: role }))
                                  .children(label),
                              ),
                            ),
                          ),
                        ]
                      : []),
                    h.div
                      .class('rail-edit-tools')
                      .attr('role', 'group')
                      .attr('aria-label', 'Edit selection')
                      .children(
                        h.button
                          .attr('type', 'button')
                          .disabled(disabled || !model.ownEdits.length)
                          .attr('title', 'Undo my last edit')
                          .attr('aria-label', 'Undo my last edit')
                          .on('click', Message.ClickedUndo())
                          .children(
                            teamIcon(h, 'arrow-counter-clockwise'),
                            h.span.children('Undo my last edit'),
                          ),
                        h.button
                          .attr('type', 'button')
                          .disabled(
                            disabled ||
                              (!currentEditor.selectedNodes.length &&
                                !currentEditor.selectedEdges.length),
                          )
                          .attr('title', 'Delete selection')
                          .attr('aria-label', 'Delete selection')
                          .on('click', Message.ClickedDelete())
                          .children(teamIcon(h, 'trash'), h.span.children('Delete selection')),
                      ),
                  ),
                  h.lazy(
                    layoutLauncherView,
                    model.layoutMethod,
                    supportedLayoutSelection(model) && model.layout._tag !== 'Running',
                  ),
                  h.div.class('tool-divider').children(),
                  h.a
                    .attr('href', `${pathFor(model.room)}/export`)
                    .class('button-link')
                    .children(teamIcon(h, 'download-simple'), 'Export confirmed diagram'),
                  h.lazy(sourceExportLauncherView, 'mermaid', exportDocument !== undefined),
                  h.lazy(sourceExportLauncherView, 'likec4', exportDocument !== undefined),
                  h.lazy(svgLauncherView, exportDocument !== undefined),
                  h.p.class('role-label').children(`Your role · ${model.role}`),
                ]
              : [],
          ),
        h.div
          .class('canvas-column')
          .children(
            h.div
              .class('canvas-alerts')
              .children(
                ...(model.error || state.notice
                  ? [h.p.attr('role', 'alert').children(model.error || state.notice)]
                  : []),
                ...(model.role === 'viewer'
                  ? [h.p.children('Viewer access. You can explore and export this diagram.')]
                  : []),
                ...(model.queuedMove?._tag === 'Blocked'
                  ? [
                      h.p
                        .attr('role', 'alert')
                        .children(
                          'A queued move could not be applied safely. Your queued positions are retained; discard them to continue.',
                        ),
                    ]
                  : []),
                ...(model.queuedMove?._tag === 'Blocked' && model.connection._tag !== 'Denied'
                  ? [
                      h.button
                        .attr('type', 'button')
                        .disabled(isAuthoredGesture(currentEditor.gesture))
                        .on('click', Message.ClickedDiscardQueuedMove())
                        .children('Discard queued moves'),
                    ]
                  : []),
              ),
            canvasView(
              h,
              currentEditor,
              canvasDisabled,
              model.peers,
              model.room.generation,
              model.room.teamId,
              model.failedIconAssets,
              waiting,
              accessEnded ? null : model.overviewOpen,
              !layoutStale && isLiveConnection(model.connection) ? layout : null,
            ),
            ...(!accessEnded && model.layout._tag !== 'Closed'
              ? [layoutPanel(model, h, layoutReason)]
              : []),
          ),
        h.aside
          .id('board-inspector')
          .class('editor-inspector')
          .attr('aria-label', 'Selection inspector')
          .attr('hidden', !inspectorOpen ? '' : undefined)
          .attr('tabindex', String(-1))
          .children(
            inspectorOpen
              ? [
                  h.div.children(
                    h.label.class('inspector-mode').children(
                      'Inspector view',
                      h.select
                        .attr('aria-label', 'Inspector view')
                        .value(model.inspector)
                        .on('change', ({ value }) =>
                          Message.SelectedInspector({
                            inspector: Schema.is(Inspector)(value) ? value : model.inspector,
                          }),
                        )
                        .children(
                          h.option.attr('value', 'selection').children('Selection and authoring'),
                          ...(workshopMode
                            ? [h.option.attr('value', 'journey').children('Workshop journey')]
                            : []),
                          h.option.attr('value', 'aggregate').children('Aggregate'),
                          h.option.attr('value', 'coupling').children('Balanced Coupling map'),
                          h.option.attr('value', 'evolution').children('Diagram Evolution'),
                          ...(opyAvailable(model)
                            ? [h.option.attr('value', 'opy').children('OPY')]
                            : []),
                        ),
                    ),
                    ...(showOpy
                      ? [
                          h.button
                            .attr('type', 'button')
                            .on('click', Message.ClosedOpy())
                            .children('Close OPY'),
                        ]
                      : []),
                  ),
                  h.div.class('inspector-content').children(
                    ...(showOpy || model.inspector === 'aggregate'
                      ? showOpy
                        ? [
                            Opy.view(model.opy, opyContext(model), h, (message) =>
                              Message.GotOpyMessage({ room: model.room, message }),
                            ),
                          ]
                        : [
                            model.connection._tag === 'Denied'
                              ? h.p.children('Access ended.')
                              : state.confirmed
                                ? h.lazy(
                                    aggregateView,
                                    state.confirmed.document.graph,
                                    currentEditor.selectedNodes.length === 1
                                      ? (currentEditor.selectedNodes[0] ?? null)
                                      : null,
                                  )
                                : h.p.children('Opening diagram…'),
                          ]
                      : model.inspector === 'journey'
                        ? [
                            accessEnded
                              ? h.p.children('Access ended.')
                              : state.confirmed
                                ? h.lazy(
                                    workshopJourneyPanel,
                                    state.confirmed.document.graph,
                                    model.journey,
                                  )
                                : h.p.children('Opening diagram…'),
                          ]
                        : model.inspector === 'evolution'
                          ? [
                              h.lazy(
                                evolutionInspectorView,
                                model.evolution,
                                accessEnded
                                  ? 'denied'
                                  : isLiveConnection(model.connection)
                                    ? 'live'
                                    : 'offline',
                                !hasUncommittedEdit(model) && isLiveConnection(model.connection)
                                  ? 'available'
                                  : 'blocked',
                                workshopMode ? 'workshop' : 'architecture',
                              ),
                            ]
                          : model.inspector === 'coupling'
                            ? [
                                ...(model.assessment.status === 'editing'
                                  ? [
                                      h.div.class('coupling-notice').children(
                                        h.p
                                          .attr('role', 'status')
                                          .children(
                                            `Assessment ${model.assessment.draft.target.relationshipId} retained. ${model.assessment.delivery.status === 'uncertain' ? 'Save outcome unknown.' : model.assessment.delivery.status === 'sending' ? 'Sending save.' : model.assessment.notice || 'Your form is preserved.'}`,
                                          ),
                                        h.button
                                          .attr('type', 'button')
                                          .on(
                                            'click',
                                            Message.SelectedInspector({
                                              inspector: 'selection',
                                            }),
                                          )
                                          .children('Return to assessment'),
                                      ),
                                    ]
                                  : []),
                                couplingView(
                                  model.coupling,
                                  h,
                                  (message) =>
                                    Message.GotCouplingMessage({ room: model.room, message }),
                                  {
                                    selectedId: currentEditor.selectedEdges[0] ?? null,
                                    connectionNotice:
                                      model.connection._tag === 'Live' ||
                                      model.connection._tag === 'Handoff'
                                        ? ''
                                        : 'Showing the last confirmed assessments while the connection is unavailable.',
                                  },
                                ),
                              ]
                            : [
                                h.h2.class('rail-heading').children('Selection inspector'),
                                ...(selected
                                  ? [
                                      h.label.children(
                                        'Node label',
                                        h.input
                                          .value(model.draft)
                                          .disabled(disabled)
                                          .attr('maxlength', String(500))
                                          .on('input', ({ value: text }) =>
                                            Message.ChangedLabel({ text }),
                                          ),
                                      ),
                                      h.button
                                        .attr('type', 'button')
                                        .disabled(disabled || !model.draft.trim())
                                        .on('click', Message.ClickedRename())
                                        .children('Rename node'),
                                      ...(selectedHotspot &&
                                      selectedHotspotClock?.present &&
                                      model.role !== 'viewer'
                                        ? [
                                            h.button
                                              .attr('type', 'button')
                                              .disabled(disabled)
                                              .on(
                                                'click',
                                                Message.ClickedHotspotStatus({
                                                  id: selected.id,
                                                  expected: selectedHotspotClock.hotspot ?? 0,
                                                  status:
                                                    selectedHotspot === 'open'
                                                      ? 'resolved'
                                                      : 'open',
                                                }),
                                              )
                                              .children(
                                                selectedHotspot === 'open'
                                                  ? 'Resolve hotspot'
                                                  : 'Reopen hotspot',
                                              ),
                                          ]
                                        : []),
                                      ...infrastructureDetails(h, selected),
                                      ...(model.role !== 'viewer' && selected.kind !== 'group'
                                        ? [
                                            h.lazy(
                                              iconPickerToggleView,
                                              model.icons.open,
                                              disabled,
                                            ),
                                            ...(model.icons.open && !disabled
                                              ? [
                                                  TeamIcons.view(
                                                    h,
                                                    model.icons,
                                                    model.room.teamId,
                                                    selected.icon,
                                                    model.role === 'owner',
                                                    {
                                                      tab: (tab) =>
                                                        Message.SelectedIconTab({ tab }),
                                                      choose: (icon) =>
                                                        Message.ChoseNodeIcon({ icon }),
                                                      upload: (file) =>
                                                        Message.SelectedIconFile({ file }),
                                                      archive: (id) =>
                                                        Message.ClickedArchiveIcon({ id }),
                                                    },
                                                  ),
                                                ]
                                              : []),
                                          ]
                                        : []),
                                      ...selected.ports.map((port) =>
                                        h.button
                                          .attr('type', 'button')
                                          .disabled(disabled)
                                          .on(
                                            'click',
                                            onEvent({
                                              type: 'PortRemoved',
                                              endpoint: { node: selected.id, port: port.id },
                                            }),
                                          )
                                          .children(`Remove ${port.id} port`),
                                      ),
                                    ]
                                  : [
                                      h.p
                                        .class('inspector-hint')
                                        .children(
                                          'Select a node to rename it. Drag to move; use the width handle to resize. Activate an output port, then an input port to connect.',
                                        ),
                                    ]),
                                h.div
                                  .id('assessment-inspector')
                                  .attr('tabindex', String(-1))
                                  .children(
                                    Assessment.view(
                                      model.assessment,
                                      {
                                        room: model.room,
                                        frame: state.confirmed,
                                        editable:
                                          model.role !== 'viewer' &&
                                          model.connection._tag !== 'Denied',
                                        graphPending: waiting,
                                      },
                                      h,
                                      (message) =>
                                        Message.GotAssessmentMessage({ room: model.room, message }),
                                    ),
                                  ),
                                h.div
                                  .class('board-facts')
                                  .children(
                                    h.div.children(
                                      h.strong.children(String(currentEditor.graph.nodes.length)),
                                      h.span.children('Nodes'),
                                    ),
                                    h.div.children(
                                      h.strong.children(String(currentEditor.graph.edges.length)),
                                      h.span.children('Connections'),
                                    ),
                                  ),
                              ]),
                  ),
                ]
              : [],
          ),
      ),
  };
}
function receiveDelta(
  model: Model,
  room: DiagramRoom,
  run: number,
  cursor: number,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Untrusted Model message is validated by applyDiagramDelta before installation.
  delta?: unknown,
): Return<Model, Message> {
  const handoff = model.connection._tag === 'Handoff' ? model.connection : null;
  if (
    !current(model, room) ||
    model.connection._tag === 'Denied' ||
    (run !== model.socketRun && run !== handoff?.previousRun)
  )
    return { model };
  const seed = model.feedSeeds.find((seed) => seed.run === run);
  if (!seed) return { model };
  const failed = () => update(model, Message.ObservedDisconnect({ room, run, reason: 'failure' }));
  const progress = model.feedProgress.find((value) => value.run === run) ?? {
    run,
    cursor: seed.feed.cursor,
    sourceVersion: seed.feed.sourceVersion,
  };
  if (!Number.isSafeInteger(cursor) || cursor < 0) return failed();
  // SAFETY: seed.frame was validated on SucceededSnapshot and remains immutable.
  const seedFrame = seed.frame as NonNullable<DiagramSession['confirmed']>;
  let state = receiveFrame(session(model), room, seedFrame);
  let nextProgress = progress;
  if (delta !== undefined) {
    if (cursor !== progress.cursor + 1) return failed();
    const result = applyDiagramDelta(state.confirmed, delta);
    if (result._tag === 'Resync') return failed();
    // applyDiagramDelta validates the envelope; source ordering is independent of SDK cursor.
    const source = Schema.decodeUnknownSync(
      Schema.Struct({ previousSourceVersion: Schema.Number, sourceVersion: Schema.Number }),
    )(delta);
    if (source.previousSourceVersion !== progress.sourceVersion) return failed();
    nextProgress = { run, cursor, sourceVersion: source.sourceVersion };
    state = receiveFrame(state, room, result.frame);
  } else if (cursor !== progress.cursor) return failed();
  const caughtCurrent = nextProgress.sourceVersion >= (state.confirmed?.sourceVersion ?? 0);
  const promoted = handoff && run === model.socketRun && caughtCurrent;
  const next = {
    ...model,
    feedProgress: [
      ...model.feedProgress.filter(
        (value) => value.run !== run && model.feedSeeds.some((seed) => seed.run === value.run),
      ),
      nextProgress,
    ],
    connection: handoff
      ? promoted
        ? Connection.Live()
        : handoff
      : caughtCurrent
        ? Connection.Live()
        : model.connection,
    socketSlot: promoted ? otherSlot(model.socketSlot) : model.socketSlot,
    error: '',
  };
  return { model: install(next, state) };
}
const roomKey = ({ teamId, diagramId, actorId, generation }: DiagramRoom) =>
  [teamId, diagramId, actorId, generation] as const;
const roomFromKey = ([teamId, diagramId, actorId, generation]: ReturnType<typeof roomKey>) => ({
  teamId,
  diagramId,
  actorId,
  generation,
});

function liveFeed(model: Model, slot: typeof SocketSlot.Type) {
  const binding = boardFeedBinding(model, slot);
  if (!binding.active) return false as const;
  return Subscription.make(
    'board-feed-' + slot,
    [...roomKey(binding.room), binding.run, binding.delay, binding.after] as const,
    ([teamId, diagramId, actorId, generation, run, delay, after]) => {
      const room = roomFromKey([teamId, diagramId, actorId, generation]);
      const disconnected = (reason: 'lease' | 'failure') =>
        Message.ObservedDisconnect({ room, run, reason });
      return Stream.fromEffect(Effect.sleep(delay)).pipe(
        Stream.flatMap(() =>
          after === null
            ? liveStream<Message>(
                room,
                (snapshot) => Message.ObservedFrame({ room, run, frame: snapshot.state }),
                disconnected,
              )
            : deltaStream<Message>(
                room,
                after,
                (entry) =>
                  entry.kind === 'delta'
                    ? Message.ObservedDelta({ room, run, cursor: entry.cursor, delta: entry.delta })
                    : Message.ObservedCaughtUp({ room, run, cursor: entry.cursor }),
                disconnected,
              ),
        ),
      );
    },
  );
}
const boardTitleChanges = Subscription.make(
  'board-title',
  titleChanges((title) => Message.ObservedBoardTitle({ title })),
);
const boardWidthChanges = Subscription.make(
  'board-width',
  boardWidths().pipe(Stream.map((compact) => Message.ChangedBoardWidth({ compact }))),
);
const historyMotionChanges = Subscription.make(
  'board-history-motion',
  historyMotion().pipe(
    Stream.map((reducedMotion) => Message.ChangedHistoryMotion({ reducedMotion })),
  ),
);
const historyVisibilityChanges = Subscription.make(
  'board-history-visibility',
  historyVisibility().pipe(Stream.map((visible) => Message.ChangedHistoryVisibility({ visible }))),
);
const unsavedChanges = Subscription.make(
  'board-uncommitted-change',
  Stream.callback<Message>(() => {
    const target = window;
    const guard = Effect.sync(() => {
      const listener = (event: BeforeUnloadEvent) => event.preventDefault();
      target.addEventListener('beforeunload', listener);
      return listener;
    });
    return Effect.acquireRelease(guard, (listener) =>
      Effect.sync(() => target.removeEventListener('beforeunload', listener)),
    );
  }),
);

export const subscriptions = ({ model }: { readonly model: Model }) => {
  const cursor = historyReview(model)?.cursor;
  return [
    boardTitleChanges,
    boardWidthChanges,
    historyMotionChanges,
    historyVisibilityChanges,
    model.historyVisible &&
      cursor?.status === 'playing' &&
      Subscription.make(
        'board-history-playback',
        [model.historyRun, cursor.intervalMs] as const,
        ([run, milliseconds]) =>
          Stream.tick(milliseconds).pipe(
            Stream.drop(1),
            Stream.map(() => Message.AdvancedHistoryPlayback({ run, milliseconds })),
          ),
      ),
    liveFeed(model, 'a'),
    liveFeed(model, 'b'),
    Boolean(model.room.generation) &&
      model.connection._tag === 'Live' &&
      Subscription.make(
        'board-feed-renewal',
        [...roomKey(model.room), model.socketRun] as const,
        ([teamId, diagramId, actorId, generation, run]) =>
          Stream.fromEffect(Effect.sleep('20 seconds')).pipe(
            Stream.map(() =>
              Message.ObservedRenewal({
                room: roomFromKey([teamId, diagramId, actorId, generation]),
                run,
              }),
            ),
          ),
      ),
    Boolean(model.room.generation) &&
      model.connection._tag !== 'Denied' &&
      Subscription.make('board-peer-tick', roomKey(model.room), (key) => {
        const room = roomFromKey(key);
        return Stream.tick(3000).pipe(Stream.map(() => Message.ObservedTick({ room })));
      }),
    hasUncommittedEdit(model) && unsavedChanges,
  ];
};

// The component stores the model exclusively through the editor's init and update.
function boardModel(value: typeof Model.Type): Model {
  // SAFETY: The editor owns the coupling and SVG fields that are opaque to the host schema.
  return value as Model;
}

export const TeamsBoard = Html.component({
  name: 'TeamsBoard',
  model: Model,
  message: Message,
  props: Props,
}).make({
  init: ({ props, set }) => {
    const step = init(props);
    return set(step.model).run(...(step.commands ?? []));
  },
  update: ($, event) => {
    const step = update(boardModel($.model), event);
    return $.set(step.model).run(...(step.commands ?? []));
  },
  subscriptions: ({ model }) => subscriptions({ model: boardModel(model) }),
  view: (h, model) => view(boardModel(model), h).body,
});
