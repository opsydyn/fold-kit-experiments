import {
  createEditor,
  decideOperation,
  projectAggregate,
  updateEditor,
} from '@opsydyn/foldkit-zloz';
import type {
  EditorEvent,
  EditorState,
  ZlozGraph,
  ZlozGraphOperation,
  ZlozOperationReceipt,
  ZlozOperationRequest,
  ZlozSvgReviewRequest,
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
  zlozAggregateView,
  zlozDragHandle,
  zlozGroupFrame,
  zlozSvgReview,
  zlozSvgReviewSelect,
  zlozView,
  zlozWorldOverlayItem,
} from '@opsydyn/foldkit-zloz/foldkit';
import { Effect, Option, Schema, Stream } from 'effect';
import { Command, Dom, Render, Subscription } from 'foldkit';
import { createLazy, type Document, type HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { DevToolsConfig } from 'foldkit/runtime';
import { foldChild, foldChildInits, type Return } from 'foldkit/update';

import { teamCanvasTheme } from '../appearance/canvas';
import { teamIcon } from '../appearance/icons';
import * as Assessment from './assessment';
import { bridgeEvent, isAuthoredGesture } from './bridge';
import { createConnectionsView } from './connections-view';
import { Message as CouplingMessage, OutMessage as CouplingOutMessage } from './coupling/message';
import * as Coupling from './coupling/model';
import { observe as observeCoupling, update as updateCoupling } from './coupling/update';
import { view as couplingView } from './coupling/view';
import { revealEdgeStrokes, introducedEdges } from './edge-motion';
import * as Evolution from './evolution';
import { view as evolutionView } from './evolution-view';
import {
  Connection,
  ReconnectDelay,
  SocketSlot,
  feedDescriptor,
  isLiveConnection,
  otherSlot,
} from './feed-state';
import { findMatches, FindTarget } from './find';
import { createNodesView } from './nodes-view';
import * as Opy from './opy';
import { geometryGraph, pendingGeometryGraph } from './pending-geometry';
import { createPortsView } from './ports-view';
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

export { slow } from './diagnostics';

const Role = Schema.Literals(['owner', 'editor', 'viewer']);
const CanvasEmphasis = Schema.Literals(['c4', 'ddd', 'neutral']);
const Inspector = Schema.Literals(['selection', 'coupling', 'aggregate', 'evolution', 'opy']);
const Rail = Schema.Literals(['tools', 'inspector']);
const compactBoardQuery = '(max-width: 1080px)';
export const Props = Schema.Struct({
  teamId: Schema.String,
  diagramId: Schema.String,
  actorId: Schema.String,
  role: Role,
  name: Schema.String,
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
  inspector: Inspector,
  rails: Schema.Struct({ tools: Schema.Boolean, inspector: Schema.Boolean }),
  compactBoard: Schema.Boolean,
  drawer: Schema.NullOr(Rail),
  focusedBoard: Schema.Boolean,
  overviewOpen: Schema.Boolean,
  find: Schema.NullOr(Schema.String),
  sourceExport: Schema.NullOr(SourceExport.Review),
  sourceExportRun: Schema.Number,
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
  serial: Schema.Number,
  ownEdits: Schema.Array(
    Schema.Struct({ operationId: Schema.String, documentVersion: Schema.Number }),
  ),
  draft: Schema.String,
  connection: Connection,
  socketRun: Schema.Number,
  socketSlot: SocketSlot,
  reconnectDelayMs: ReconnectDelay,
  peers: Schema.Array(Peer),
  cursor: Schema.NullOr(Schema.Struct({ x: Schema.Number, y: Schema.Number })),
  error: Schema.String,
  emphasis: CanvasEmphasis,
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
export const Message = defineMessageUnion({
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
  SucceededPresence: { room: Room, peers: Schema.Array(Peer) },
  FailedPresence: { room: Room, status: Schema.Number },
  ObservedEditorInput: { event: Schema.Unknown },
  ChangedLabel: { text: Schema.String },
  ClickedAdd: {},
  ClickedRename: {},
  ClickedUndo: {},
  ClickedRetry: {},
  ClickedDiscardQueuedMove: {},
  ClickedDelete: {},
  PreparedEdit: { room: Room, request: DiagramRequestSchema, hash: Schema.String },
  FailedPreparation: { room: Room },
  SucceededEdit: { room: Room, reply: Schema.Unknown },
  FailedEdit: { room: Room, operationId: Schema.String },
  GotAssessmentMessage: { room: Room, message: Assessment.Message },
  SelectedCanvasEmphasis: { emphasis: CanvasEmphasis },
  SelectedInspector: { inspector: Inspector },
  SelectedEvolutionVersion: { value: Schema.String },
  ChangedBoardWidth: { compact: Schema.Boolean },
  ToggledBoardRail: { rail: Rail },
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
  ObservedSvgReview: { request: Schema.Unknown },
  SelectedLayoutMethod: { method: Layout.Method },
  ClickedLayoutPreview: {},
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
// Transport still updates the live Model. Avoid retaining/diffing every remote
// delivery in the debugging history of a large multiplayer document.
export const devTools = {
  excludeFromHistory: [
    'ObservedDelta',
    'ObservedFrame',
    'ObservedCaughtUp',
    'ObservedTick',
    'SucceededPresence',
  ] satisfies readonly Message['_tag'][],
} satisfies DevToolsConfig;
const RevealEdges = Command.define('RevealEdges', {
  args: { run: Schema.Number, edgeIds: Schema.Array(Schema.String) },
  messages: [Message.CompletedEdgeReveal],
  execute: ({ run, edgeIds }) => {
    const reveal = Effect.sync(() => revealEdgeStrokes(run, edgeIds));
    return Render.afterCommit.pipe(Effect.andThen(reveal), Effect.map(Message.CompletedEdgeReveal));
  },
});
const FocusAssessmentInspector = Command.define('FocusAssessmentInspector', {
  messages: [Message.CompletedInspectorFocus],
  execute: Render.afterCommit.pipe(
    Effect.andThen(Dom.focus('#assessment-inspector', { makeFocusable: true })),
    Effect.catchTag('ElementNotFound', () => Effect.void),
    Effect.map(() => Message.CompletedInspectorFocus()),
  ),
});
const FocusBoardControl = Command.define('FocusBoardControl', {
  args: { selector: Schema.String },
  messages: [Message.CompletedBoardFocus],
  execute: ({ selector }) =>
    Render.afterCommit.pipe(
      Effect.andThen(Dom.focus(selector, { makeFocusable: true })),
      Effect.catchTag('ElementNotFound', () => Effect.void),
      Effect.map(() => Message.CompletedBoardFocus()),
    ),
});
const PrepareLikeC4 = Command.define('PrepareLikeC4', {
  args: { run: Schema.Number, document: DiagramDocumentSchema },
  messages: [Message.SettledSourceExport],
  execute: ({ run, document }) =>
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
});
const DownloadSource = Command.define('DownloadSource', {
  args: {
    kind: SourceExport.Kind,
    version: Schema.Number,
    format: SourceExport.Format,
    contents: Schema.String,
  },
  messages: [Message.CompletedSourceDownload],
  execute: ({ kind, version, format, contents }) =>
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
});
function handoffDownload(contents: string, mediaType: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mediaType }));
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
}
const DownloadSvg = Command.define('DownloadSvg', {
  args: {
    svg: Schema.String,
    fileName: Schema.String,
    scope: Schema.String,
    generation: Schema.Number,
    key: Schema.String,
    run: Schema.Number,
  },
  messages: [Message.ObservedSvgReview],
  execute: ({ svg, fileName, scope, generation, key, run }) => {
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
});
const PrepareLayoutPreview = Command.define('PrepareLayoutPreview', {
  args: {
    room: Room,
    run: Schema.Number,
    document: DiagramDocumentSchema,
    selection: Schema.Array(Schema.String),
    direction: Layout.Direction,
    method: Layout.Method,
  },
  messages: [Message.SettledLayoutPreview],
  execute: ({ room, run, document, selection, direction, method }) =>
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
});
const sharedConnections = createConnectionsView<Message>((id) =>
  Message.ObservedEditorInput({ event: { type: 'EdgeSelected', id, additive: false } }),
);
const sharedPorts = createPortsView<Message>();
const sharedNodes = createNodesView<Message>();
const AllocateDiagramSession = Command.define('AllocateDiagramSession', {
  messages: [Message.SucceededIdentity, Message.FailedIdentity],
  execute: Effect.try(() => crypto.randomUUID()).pipe(
    Effect.match({
      onSuccess: (generation) => Message.SucceededIdentity({ generation }),
      onFailure: () => Message.FailedIdentity(),
    }),
  ),
});
const LoadSharedDiagram = Command.define('LoadSharedDiagram', {
  args: { room: Room, run: Schema.optionalKey(Schema.Number) },
  messages: [Message.SucceededSnapshot, Message.FailedSnapshot],
  execute: ({ room, run }) =>
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
});
const PrepareSharedEdit = Command.define('PrepareSharedEdit', {
  args: { room: Room, request: DiagramRequestSchema },
  messages: [Message.PreparedEdit, Message.FailedPreparation],
  execute: ({ room, request }) =>
    Effect.tryPromise(async () => {
      const input = request;
      return Message.PreparedEdit({ room, request: input, hash: await operationHash(input) });
    }).pipe(Effect.orElseSucceed(() => Message.FailedPreparation({ room }))),
});
const SubmitSharedEdit = Command.define('SubmitSharedEdit', {
  args: { room: Room, request: DiagramRequestSchema },
  messages: [Message.SucceededEdit, Message.FailedEdit],
  execute: ({ room, request }) => {
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
});
const SendDiagramPresence = Command.define('SendDiagramPresence', {
  args: {
    room: Room,
    selection: Schema.Array(Schema.String),
    cursor: Schema.NullOr(Schema.Struct({ x: Schema.Number, y: Schema.Number })),
  },
  messages: [Message.SucceededPresence, Message.FailedPresence],
  execute: ({ room, selection, cursor }) =>
    Effect.tryPromise(async (signal) => {
      const response = await fetch(`${pathFor(room)}/presence`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId: room.generation, selection, cursor }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });
      if (!response.ok) return Message.FailedPresence({ room, status: response.status });
      return Message.SucceededPresence({
        room,
        peers: Schema.decodeUnknownSync(Schema.Struct({ peers: Schema.Array(Peer) }))(
          await response.json(),
        ).peers,
      });
    }).pipe(Effect.orElseSucceed(() => Message.FailedPresence({ room, status: 0 }))),
});

export function init(raw: typeof Props.Type): Return<Model, Message> {
  const props = Schema.decodeUnknownSync(Props)(raw);
  const room = {
    teamId: props.teamId,
    diagramId: props.diagramId,
    actorId: props.actorId,
    generation: '',
  };
  const children = foldChildInits(
    { assessment: { model: Assessment.init() }, coupling: { model: Coupling.init() } },
    {
      toParentModel: ({ assessment, coupling }): Model => ({
        ...props,
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
        connection: Connection.Opening(),
        socketRun: 0,
        socketSlot: 'a',
        reconnectDelayMs: 0,
        peers: [],
        cursor: null,
        error: '',
        emphasis: 'c4',
        assessment,
        coupling,
        inspector: 'selection',
        evolution: Evolution.empty,
        rails: { tools: true, inspector: true },
        compactBoard: false,
        drawer: null,
        focusedBoard: false,
        overviewOpen: false,
        find: null,
        sourceExport: null,
        sourceExportRun: 0,
        svg: null,
        svgRun: 0,
        layout: Layout.Task.Closed(),
        layoutMethod: 'elk',
        layoutRun: 0,
        opy: Opy.init(),
        decisionAuthoring: false,
        clefShadow: false,
      }),
      folds: {
        assessment: {
          toParentMessage: (message: Assessment.Message) =>
            Message.GotAssessmentMessage({ room, message }),
        },
        coupling: {
          toParentMessage: (message: CouplingMessage) =>
            Message.GotCouplingMessage({ room, message }),
        },
      },
    },
  );
  return {
    model: children.model,
    commands: [...(children.commands ?? []), AllocateDiagramSession()],
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
    commands: [PrepareSharedEdit({ room: model.room, request })],
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
const supportedLayoutSelection = (model: Model) =>
  isLiveConnection(model.connection) &&
  editor(model).gesture.type === 'idle' &&
  editor(model).selectedNodes.length >= Layout.methods[model.layoutMethod].minimum;
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
        commands: open ? [FocusBoardControl({ selector: `#board-${rail}` })] : [],
      };
    },
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
        FocusBoardControl({
          selector: model.overviewOpen
            ? '#board-overview-toggle'
            : '#board-overview [data-flow-minimap-frame]',
        }),
      ],
    }),
    OpenedFind: () => ({
      model: { ...model, find: '', sourceExport: null, svg: null, layout: Layout.Task.Closed() },
      commands: [FocusBoardControl({ selector: '#board-find-query' })],
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
          ...(kind === 'likec4' ? [PrepareLikeC4({ run, document: confirmed })] : []),
          FocusBoardControl({ selector: '#board-mermaid' }),
        ],
      };
    },
    ClosedSourceExport: () => ({
      model: { ...model, sourceExport: null },
      commands: [
        FocusBoardControl({
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
        commands: [DownloadSource({ kind, version, format, contents: review[format] })],
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
        commands: [FocusBoardControl({ selector: '#board-svg' })],
      };
    },
    ClosedSvg: () => ({
      model: { ...model, svg: null },
      commands: [
        FocusBoardControl({
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
        ? { model: updated, commands: [DownloadSvg(next.payload)] }
        : { model: updated };
    },
    SelectedLayoutMethod: ({ method }) => ({
      model: { ...model, layoutMethod: method, layout: Layout.Task.Closed() },
    }),
    ClickedLayoutPreview: () => {
      const document = session(model).confirmed?.document;
      if (!document || !supportedLayoutSelection(model) || model.layout._tag === 'Running')
        return { model };
      const run = model.layoutRun + 1;
      const currentEditor = editor(model);
      return {
        model: withRailChange(model, {
          ...model,
          layoutRun: run,
          layout: Layout.Task.Running(),
          drawer: model.compactBoard ? null : model.drawer,
          find: null,
          sourceExport: null,
          svg: null,
        }),
        commands: [
          PrepareLayoutPreview({
            room: model.room,
            run,
            document,
            selection: currentEditor.selectedNodes,
            direction: (currentEditor.surface?.width ?? 800) < 600 ? 'DOWN' : 'RIGHT',
            method: model.layoutMethod,
          }),
          FocusBoardControl({ selector: '#board-layout-preview' }),
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
        FocusBoardControl({
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
          FocusBoardControl({ selector: '#shared-diagram-surface' }),
        ],
      };
    },
    ClosedFind: () => ({
      model: { ...model, find: null },
      commands: [FocusBoardControl({ selector: '#board-find-toggle' })],
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
          FocusBoardControl({ selector: '#shared-diagram-surface' }),
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
            commands: [FocusBoardControl({ selector: '#opy-inspector' })],
          }
        : { model },
    ClosedOpy: () => ({
      model: {
        ...model,
        inspector: 'selection' as const,
        drawer: 'tools' as const,
        rails: { ...model.rails, tools: true },
      },
      commands: [FocusBoardControl({ selector: '#ask-opy' })],
    }),
    GotOpyMessage: ({ room, message: childMessage }) =>
      current(model, room)
        ? foldChild({
            update: (opy: Opy.Model, child: Opy.Message) =>
              Opy.update(opy, child, opyContext(model)),
            read: (parent: Model) => Option.some(parent.opy),
            write: (parent, opy) => ({ ...parent, opy }),
            toParentMessage: (message) => Message.GotOpyMessage({ room, message }),
          })(model, childMessage)
        : { model },
    SelectedInspector: ({ inspector }) => {
      if (inspector === model.inspector) return { model };
      const next = withRailChange(model, { ...model, inspector });
      return inspector === 'selection' && model.assessment.status === 'editing'
        ? { model: next, commands: [FocusAssessmentInspector()] }
        : { model: next };
    },
    SelectedEvolutionVersion: ({ value }) => ({
      model: { ...model, evolution: Evolution.inspect(model.evolution, value) },
    }),
    GotCouplingMessage: ({ room, message }) => {
      if (!current(model, room) || !couplingVisible(model)) return { model };
      return foldChild({
        update: updateCoupling,
        read: (parent: Model) => Option.some(parent.coupling),
        write: (parent, coupling) => ({ ...parent, coupling }),
        toParentMessage: (message) => Message.GotCouplingMessage({ room, message }),
        foldOutMessage: (outMessage) =>
          CouplingOutMessage.match(outMessage, {
            SelectedRelationship:
              ({ id }) =>
              (parent: Model): Return<Model, Message> => {
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
            RequestedAssessmentReview:
              ({ id }) =>
              (parent: Model): Return<Model, Message> => {
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
                  commands: [...(opened.commands ?? []), FocusAssessmentInspector()],
                };
              },
          }),
      })(model, Schema.decodeUnknownSync(CouplingMessage)(message));
    },
    GotAssessmentMessage: ({ room, message }) => {
      if (!current(model, room)) return { model };
      const childMessage = Schema.decodeUnknownSync(Assessment.Message)(message);
      return foldChild({
        update: (child: Assessment.Model, message: Assessment.Message) =>
          Assessment.update(child, message, {
            room: model.room,
            frame: model.session.confirmed,
            editable: model.role !== 'viewer' && model.connection._tag !== 'Denied',
            graphPending: model.session.pending !== null || model.queuedMove !== null,
          }),
        read: (parent: Model) => Option.some(parent.assessment),
        write: (parent, assessment) => ({ ...parent, assessment }),
        toParentMessage: (message) => Message.GotAssessmentMessage({ room, message }),
      })(model, childMessage);
    },
    SelectedCanvasEmphasis: ({ emphasis }) => ({ model: { ...model, emphasis } }),
    SucceededIdentity: ({ generation }) => {
      if (model.room.generation) return { model };
      const room = { ...model.room, generation };
      return {
        model: { ...model, room, session: newSession(room) },
        commands: [LoadSharedDiagram({ room, run: model.socketRun })],
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
                ? [LoadSharedDiagram({ room, run: model.socketRun + 1 })]
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
            model.feedMode === 'delta' ? [LoadSharedDiagram({ room, run: next.socketRun })] : [],
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
          model.feedMode === 'delta' ? [LoadSharedDiagram({ room, run: next.socketRun })] : [],
      };
    },
    ObservedTick: ({ room }) => {
      if (!current(model, room) || model.connection._tag === 'Denied') return { model };
      return {
        model,
        commands: [
          SendDiagramPresence({
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
            ? [LoadSharedDiagram({ room, run: model.socketRun })]
            : []),
        ],
      };
    },
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
              peers: [],
              error: 'Access ended. Sign in again or contact the team owner.',
            },
          }
        : current(model, room)
          ? { model: { ...model, peers: [] } }
          : { model },
    ChangedLabel: ({ text }) => ({ model: { ...model, draft: text } }),
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
              SubmitSharedEdit({ room: model.room, request: pending.request }),
              LoadSharedDiagram({ room: model.room, run: next.socketRun }),
            ],
          }
        : { model: next, commands: [LoadSharedDiagram({ room: model.room, run: next.socketRun })] };
    },
    PreparedEdit: ({ room, request, hash }) => {
      if (!current(model, room) || preparing(model)?.operationId !== request.operationId)
        return { model };
      const state = beginEdit(session(model), request, hash);
      return {
        model: install(model, state),
        commands: [SubmitSharedEdit({ room, request })],
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
            commands: [LoadSharedDiagram({ room, run: model.socketRun })],
          },
    FailedEdit: ({ room, operationId }) =>
      !current(model, room)
        ? { model }
        : {
            model: { ...model, session: unknownEdit(session(model), room, operationId) },
            commands: [LoadSharedDiagram({ room, run: model.socketRun })],
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
        event.type === 'NodeDragStarted' ||
        (event.type === 'NodeSelected' &&
          (!event.additive || result.editor.selectedNodes[0] !== before.selectedNodes[0]))
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
      ? [...(step.commands ?? []), RevealEdges({ run, edgeIds })]
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

const aggregateInspector = createLazy();
function aggregateView(h: HtmlBuilder<Message>, graph: ZlozGraph, selectedId: string | null) {
  return zlozAggregateView(h, projectAggregate(graph, selectedId));
}

const sharedCanvas = createLazy();
const canvasEvent = (event: EditorEvent) => Message.ObservedEditorInput({ event });
function layoutGhosts(
  h: HtmlBuilder<Message>,
  state: EditorState,
  preview: Layout.Proposal | null,
) {
  if (!preview) return [];
  const nodes = new Map(state.graph.nodes.map((node) => [node.id, node]));
  return preview.moves.flatMap(({ id, position }) => {
    const node = nodes.get(id);
    if (!node) return [];
    return [
      zlozWorldOverlayItem(
        h,
        { position },
        [
          h.Key(id),
          h.Class(node.kind === 'group' ? 'layout-ghost layout-ghost-group' : 'layout-ghost'),
          h.AriaHidden(true),
          h.DataAttribute('layout-ghost', id),
          h.DataAttribute('layout-x', String(position.x)),
          h.DataAttribute('layout-y', String(position.y)),
          h.Style({ width: `${node.size.width}px`, height: `${node.size.height}px` }),
        ],
        [node.label],
      ),
    ];
  });
}
const overviewToggle = createLazy();
function overviewToggleView(h: HtmlBuilder<Message>, open: boolean, enabled: boolean) {
  return h.button(
    [
      h.Id('board-overview-toggle'),
      h.Type('button'),
      h.Disabled(!enabled),
      h.AriaControls('board-overview'),
      h.AriaExpanded(open),
      h.OnClick(Message.ToggledOverview()),
    ],
    ['Overview'],
  );
}

function canvasView(
  h: HtmlBuilder<Message>,
  state: EditorState,
  disabled: boolean,
  peers: Model['peers'],
  generation: string,
  geometrySaving: boolean,
  overview: boolean | null,
  layoutPreview: Layout.Proposal | null,
) {
  const onEvent = canvasEvent;
  const canShowOverview =
    overview !== null && Boolean(state.surface) && state.graph.nodes.length > 0;
  return zlozView(
    h,
    { ...state, readOnly: disabled },
    {
      id: 'shared-diagram',
      label: 'Shared team diagram',
      onEvent,
      height: 'fill',
      theme: teamCanvasTheme,
      renderCanvasHelp: (_context, builder) =>
        builder.span(
          [],
          [
            'Drag a node title to move it, or focus its title and use arrow keys. Drag the background to pan and scroll to zoom. Activate an output port, then an input port to connect. Escape cancels a gesture.',
          ],
        ),
      renderConnections: sharedConnections,
      contextActions: false,
      nodeToolbar: false,
      edgeToolbar: false,
      viewportControls: true,
      fitSelectionControl: true,
      previousViewControl: true,
      resizeHandles: false,
      minimap: overview === true && canShowOverview,
      autoPan: false,
      stablePointerOrigin: true,
      viewportCulling: true,
      renderLayout: ({ canvas, canvasId, controls, status, connections, help, minimap }, builder) =>
        builder.div(
          [builder.Class('board-canvas')],
          [
            canvas,
            builder.div(
              [builder.Class('board-navigation')],
              [
                ...(controls ? [controls] : []),
                overviewToggle(overviewToggleView, [builder, minimap !== null, canShowOverview]),
                builder.div(
                  [
                    builder.Id('board-overview'),
                    builder.Class('board-popover-content board-overview'),
                    builder.Hidden(minimap === null),
                    builder.OnKeyDownPreventDefault((key) =>
                      key === 'Escape' ? Option.some(Message.ToggledOverview()) : Option.none(),
                    ),
                  ],
                  minimap ? [minimap] : [],
                ),
                builder.details(
                  [builder.Class('board-popover')],
                  [
                    builder.summary([], ['Browse relationships']),
                    builder.div([builder.Class('board-popover-content')], [connections]),
                  ],
                ),
                builder.details(
                  [builder.Class('board-popover')],
                  [
                    builder.summary([], ['Canvas help']),
                    builder.div([builder.Class('board-popover-content')], [help]),
                  ],
                ),
                builder.a(
                  [builder.Class('board-skip'), builder.Href(`#${canvasId}`)],
                  ['Skip to canvas'],
                ),
              ],
            ),
            status,
          ],
        ),
      canResizeNode: (node) =>
        geometrySaving
          ? 'Finish saving this move before resizing'
          : node.kind === 'group'
            ? 'Group resizing is not shared yet'
            : null,
      canConnectPort: () => (geometrySaving ? 'Finish saving this move before connecting' : null),
      renderPort: sharedPorts,
      renderNodeShell: sharedNodes,
      renderGroupShell: (context, builder) =>
        zlozGroupFrame(
          builder,
          context,
          [builder.Class('shared-group')],
          [
            zlozDragHandle(
              builder,
              context,
              [builder.Class('shared-group-title')],
              [context.node.label],
            ),
            ...(context.ports ?? []),
          ],
        ),
      renderWorldOverlay: (_context, builder) =>
        builder.div(
          [],
          [
            ...layoutGhosts(builder, state, layoutPreview),
            ...peers
              .filter((peer) => peer.connectionId !== generation && peer.cursor !== null)
              .map((peer) =>
                zlozWorldOverlayItem(
                  builder,
                  { position: peer.cursor!, interactive: false },
                  [builder.Class('peer-cursor')],
                  [`↖ ${peer.name}`],
                ),
              ),
          ],
        ),
    },
  );
}

const boardControls = createLazy();
const layoutLauncher = createLazy();
function layoutLauncherView(h: HtmlBuilder<Message>, method: Layout.Method, enabled: boolean) {
  return h.div(
    [],
    [
      h.label(
        [h.Class('canvas-mode')],
        [
          'Layout action',
          h.select(
            [
              h.Value(method),
              h.OnChange((value) =>
                Message.SelectedLayoutMethod({
                  method: Schema.is(Layout.Method)(value) ? value : method,
                }),
              ),
            ],
            Layout.Method.literals.map((value) =>
              h.option([h.Value(value)], [Layout.methods[value].label]),
            ),
          ),
        ],
      ),
      h.button(
        [
          h.Id('board-layout-open'),
          h.Class('layout-launcher'),
          h.Type('button'),
          h.Title(`Select at least ${Layout.methods[method].minimum} sibling nodes or groups`),
          h.Disabled(!enabled),
          h.OnClick(Message.ClickedLayoutPreview()),
        ],
        ['Preview selection layout'],
      ),
    ],
  );
}

function layoutPanel(model: Model, h: HtmlBuilder<Message>, reason: string | null) {
  const ready = model.layout._tag === 'Ready';
  return h.div(
    [
      h.Id('board-layout-preview'),
      h.Class('board-layout-preview'),
      h.Role('region'),
      h.AriaLabel('Selection layout preview'),
      h.Tabindex(-1),
      h.OnKeyDownPreventDefault((key) =>
        key === 'Escape' ? Option.some(Message.DiscardedLayoutPreview()) : Option.none(),
      ),
    ],
    [
      h.p([], [h.strong([], [Layout.methods[model.layoutMethod].label])]),
      h.p(
        [h.Role('status')],
        [
          model.layout._tag === 'Failed'
            ? model.layout.message
            : model.layout._tag === 'Running'
              ? 'Preparing selection layout…'
              : (reason ?? 'Layout preview is visible only to you.'),
        ],
      ),
      h.div(
        [h.Class('layout-preview-actions')],
        [
          ...(ready
            ? [
                h.button(
                  [
                    h.Type('button'),
                    h.Disabled(reason !== null),
                    h.OnClick(Message.ClickedApplyLayout({ run: model.layoutRun })),
                  ],
                  ['Apply layout'],
                ),
              ]
            : []),
          h.button(
            [h.Type('button'), h.OnClick(Message.DiscardedLayoutPreview())],
            ['Discard layout'],
          ),
        ],
      ),
    ],
  );
}

const sourceExportPanel = createLazy();
function sourceExportPanelView(
  h: HtmlBuilder<Message>,
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

const mermaidExportLauncher = createLazy();
const likeC4ExportLauncher = createLazy();
function sourceExportLauncherView(
  h: HtmlBuilder<Message>,
  kind: SourceExport.Kind,
  available: boolean,
) {
  return h.button(
    [
      h.Id(SourceExport.launcherId(kind)),
      h.Class('mermaid-launcher'),
      h.Type('button'),
      h.Disabled(!available),
      h.OnClick(Message.OpenedSourceExport({ kind })),
    ],
    [`Export ${SourceExport.label(kind)}`],
  );
}

const svgLauncher = createLazy();
function svgLauncherView(h: HtmlBuilder<Message>, available: boolean) {
  return h.button(
    [
      h.Id('board-svg-open'),
      h.Class('svg-launcher'),
      h.Type('button'),
      h.Disabled(!available),
      h.OnClick(Message.OpenedSvg()),
    ],
    ['Export SVG'],
  );
}

const evolutionInspector = createLazy();
function evolutionInspectorView(
  h: HtmlBuilder<Message>,
  history: Evolution.History,
  connection: 'live' | 'offline' | 'denied',
) {
  return evolutionView(h, history, connection, (value) =>
    Message.SelectedEvolutionVersion({ value }),
  );
}

const svgPanel = createLazy();
function svgPanelView(h: HtmlBuilder<Message>, review: Svg.Review, availability: Svg.Availability) {
  const controls = Svg.resolve(review, availability);
  const request = (value: ZlozSvgReviewRequest) => Message.ObservedSvgReview({ request: value });
  return h.div(
    [
      h.Id('board-svg'),
      h.Class('board-svg'),
      h.Role('region'),
      h.AriaLabel('SVG export preview'),
      h.Tabindex(-1),
      h.OnKeyDownPreventDefault((key) =>
        key === 'Escape' ? Option.some(Message.ClosedSvg()) : Option.none(),
      ),
    ],
    [
      h.div(
        [h.Class('mermaid-review-header')],
        [
          h.div([], [h.h2([], ['SVG export']), h.p([], [`Confirmed version ${review.version}`])]),
          h.button([h.Type('button'), h.OnClick(Message.ClosedSvg())], ['Close SVG preview']),
        ],
      ),
      zlozSvgReview(h, controls, request, {
        idPrefix: 'team-svg',
        attributes: [h.Class('svg-review')],
        diagnostics: { instructions: false, measurements: false },
        renderSettings: (settings, builder, onRequest) =>
          builder.div(
            [builder.Class('svg-review-settings')],
            [
              builder.div(
                [],
                [
                  builder.label([builder.For('team-svg-theme')], ['SVG theme']),
                  zlozSvgReviewSelect(builder, settings, 'themeId', onRequest, [
                    builder.Id('team-svg-theme'),
                  ]),
                ],
              ),
              builder.div(
                [],
                [
                  builder.label([builder.For('team-svg-background')], ['SVG background']),
                  zlozSvgReviewSelect(builder, settings, 'backgroundId', onRequest, [
                    builder.Id('team-svg-background'),
                  ]),
                ],
              ),
            ],
          ),
        renderAcceptance: () => (availability === 'current' ? undefined : null),
        renderStatus: (state, builder) =>
          builder.p(
            [builder.Role('status')],
            [state.downloadReason ?? (review.notice || 'SVG is ready to download.')],
          ),
        renderLayout: (
          { settings, preview, findings, acceptance, download, status },
          _context,
          builder,
        ) => [
          builder.div(
            [builder.Class('mermaid-review-body')],
            [
              ...[settings, preview].flatMap((part) => (part ? [part] : [])),
              builder.p(
                [],
                [
                  'Exports the confirmed graph. Live board controls, custom backgrounds, presence, assessments, decisions and generic icons on non-C4 nodes are omitted.',
                ],
              ),
              ...(findings ? [findings] : []),
            ],
          ),
          builder.div(
            [builder.Class('mermaid-review-footer svg-review-footer')],
            [
              ...[status, acceptance].flatMap((part) => (part ? [part] : [])),
              ...(availability === 'newer'
                ? [
                    builder.button(
                      [builder.Type('button'), builder.OnClick(Message.OpenedSvg())],
                      ['Review latest version'],
                    ),
                  ]
                : []),
              ...(download ? [download] : []),
            ],
          ),
        ],
      }),
    ],
  );
}

function boardControlsView(
  h: HtmlBuilder<Message>,
  toolsOpen: boolean,
  inspectorOpen: boolean,
  findOpen: boolean,
  focused: boolean,
  accessEnded: boolean,
) {
  const railToggle = (rail: typeof Rail.Type, open: boolean, label: string) =>
    h.button(
      [
        h.Type('button'),
        h.Disabled(accessEnded),
        h.AriaControls(`board-${rail}`),
        h.AriaExpanded(open),
        h.OnClick(Message.ToggledBoardRail({ rail })),
      ],
      [label],
    );
  return h.div(
    [h.Class('board-controls')],
    [
      railToggle('tools', toolsOpen, 'Tools'),
      railToggle('inspector', inspectorOpen, 'Inspector'),
      h.button(
        [
          h.Id('board-find-toggle'),
          h.Type('button'),
          h.Disabled(accessEnded),
          h.AriaControls('board-find'),
          h.AriaExpanded(findOpen),
          h.OnClick(findOpen ? Message.ClosedFind() : Message.OpenedFind()),
        ],
        ['Find'],
      ),
      h.button(
        [h.Type('button'), h.Disabled(accessEnded), h.OnClick(Message.ToggledBoardFocus())],
        [focused ? 'Exit focus' : 'Focus board'],
      ),
    ],
  );
}

export function view(model: Model, h: HtmlBuilder<Message>): Document {
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
  const modeName =
    model.emphasis === 'c4' ? 'C4 view' : model.emphasis === 'ddd' ? 'DDD view' : 'Neutral view';
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
    title: model.name,
    body: h.div(
      [
        h.Class('shared-editor'),
        h.DataAttribute('canvas-emphasis', model.emphasis),
        h.DataAttribute('inspector-mode', model.inspector),
        h.DataAttribute('tools-open', String(toolsOpen)),
        h.DataAttribute('inspector-open', String(inspectorOpen)),
        h.DataAttribute('confirmed-version', String(state.confirmed?.document.version ?? -1)),
        h.DataAttribute('edge-motion-run', String(model.edgeMotionRun ?? '')),
      ],
      [
        h.div(
          [h.Class('canvas-toolbar'), h.Role('group'), h.AriaLabel('Board controls')],
          [
            boardControls(boardControlsView, [
              h,
              toolsOpen,
              inspectorOpen,
              findOpen,
              model.focusedBoard,
              accessEnded,
            ]),
            h.div(
              [h.Class('board-session')],
              [
                h.span(
                  [h.Class('mode-badge')],
                  [teamIcon(h, model.emphasis === 'c4' ? 'package' : 'cube', 16), modeName],
                ),
                h.span(
                  [h.Role('status'), h.DataAttribute('save-status', status), h.AriaLive('polite')],
                  [status],
                ),
                ...((state.pending?.status === 'uncertain' ||
                  !isLiveConnection(model.connection)) &&
                model.connection._tag !== 'Denied'
                  ? [
                      h.button(
                        [h.Type('button'), h.OnClick(Message.ClickedRetry())],
                        [state.pending ? 'Retry saved request' : 'Reconnect'],
                      ),
                    ]
                  : []),
                h.details(
                  [h.Class('board-popover board-presence')],
                  [
                    h.summary([], [`Here now · ${model.peers.length}`]),
                    h.div(
                      [
                        h.Class('board-popover-content presence'),
                        h.AriaLabel('Teammates in this diagram'),
                      ],
                      model.peers.length
                        ? model.peers.map((peer) =>
                            h.span(
                              [],
                              [
                                `${peer.name}${peer.connectionId === model.room.generation ? ' (you)' : ''}${peer.selection.length ? ` · ${peer.selection.length} selected` : ''}`,
                              ],
                            ),
                          )
                        : [h.span([], ['No teammates reported yet.'])],
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        h.div(
          [
            h.Id('board-find'),
            h.Class('board-find'),
            h.Role('search'),
            h.AriaLabel('Find on board'),
            h.Hidden(!findOpen),
            h.OnKeyDownPreventDefault((key) =>
              key === 'Escape' ? Option.some(Message.ClosedFind()) : Option.none(),
            ),
          ],
          findOpen
            ? [
                h.div(
                  [h.Class('find-controls')],
                  [
                    h.label(
                      [],
                      [
                        'Find on board',
                        h.input([
                          h.Id('board-find-query'),
                          h.Type('search'),
                          h.Value(model.find ?? ''),
                          h.OnInput((query) => Message.ChangedFind({ query })),
                        ]),
                      ],
                    ),
                    h.button([h.Type('button'), h.OnClick(Message.ClosedFind())], ['Close Find']),
                  ],
                ),
                h.p(
                  [h.Role('status')],
                  [
                    !model.find?.trim()
                      ? 'Search nodes or relationships by name or ID.'
                      : matches.length > findLimit
                        ? `Showing ${findLimit} of ${matches.length} matches. Refine to narrow results.`
                        : matches.length === 0
                          ? 'No matches.'
                          : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}.`,
                  ],
                ),
                ...(matches.length
                  ? [
                      h.ul(
                        [h.Class('find-results')],
                        matches
                          .slice(0, findLimit)
                          .map(({ target, id, label }) =>
                            h.li(
                              [h.Key(`${target}:${id}`)],
                              [
                                h.button(
                                  [
                                    h.Type('button'),
                                    h.OnClick(Message.ChoseFindResult({ target, id })),
                                  ],
                                  [
                                    target === 'node'
                                      ? `Reveal ${label} (${id})`
                                      : `Reveal connection ${label}`,
                                  ],
                                ),
                              ],
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
              sourceExportPanel(sourceExportPanelView, [
                h,
                sourceReview,
                !exportDocument
                  ? 'offline'
                  : exportDocument.version === sourceReview.version
                    ? 'current'
                    : 'newer',
              ]),
            ]
          : []),
        ...(svg ? [svgPanel(svgPanelView, [h, svg, Svg.availability(svg, exportDocument)])] : []),
        h.aside(
          [
            h.Id('board-tools'),
            h.Class('tool-rail'),
            h.AriaLabel('Diagram tools'),
            h.Hidden(!toolsOpen),
            h.Tabindex(-1),
          ],
          toolsOpen
            ? [
                h.h2([h.Class('rail-heading')], ['Diagram tools']),
                ...(opyAvailable(model)
                  ? [
                      h.button(
                        [
                          h.Id('ask-opy'),
                          h.Type('button'),
                          h.Class('opy-launcher'),
                          h.OnClick(Message.OpenedOpy()),
                        ],
                        ['Ask OPY'],
                      ),
                    ]
                  : []),
                h.div(
                  [h.Class('editor-actions')],
                  [
                    h.button(
                      [h.Type('button'), h.Disabled(disabled), h.OnClick(Message.ClickedAdd())],
                      [teamIcon(h, 'plus'), h.span([], ['Add node'])],
                    ),
                    h.button(
                      [
                        h.Type('button'),
                        h.Disabled(disabled || !model.ownEdits.length),
                        h.OnClick(Message.ClickedUndo()),
                      ],
                      [teamIcon(h, 'arrow-counter-clockwise'), h.span([], ['Undo my last edit'])],
                    ),
                    h.button(
                      [
                        h.Type('button'),
                        h.Disabled(
                          disabled ||
                            (!currentEditor.selectedNodes.length &&
                              !currentEditor.selectedEdges.length),
                        ),
                        h.OnClick(Message.ClickedDelete()),
                      ],
                      [teamIcon(h, 'trash'), h.span([], ['Delete selection'])],
                    ),
                  ],
                ),
                layoutLauncher(layoutLauncherView, [
                  h,
                  model.layoutMethod,
                  supportedLayoutSelection(model) && model.layout._tag !== 'Running',
                ]),
                h.div([h.Class('tool-divider')], []),
                h.a(
                  [h.Href(`${pathFor(model.room)}/export`), h.Class('button-link')],
                  [teamIcon(h, 'download-simple'), 'Export confirmed diagram'],
                ),
                mermaidExportLauncher(sourceExportLauncherView, [
                  h,
                  'mermaid',
                  exportDocument !== undefined,
                ]),
                likeC4ExportLauncher(sourceExportLauncherView, [
                  h,
                  'likec4',
                  exportDocument !== undefined,
                ]),
                svgLauncher(svgLauncherView, [h, exportDocument !== undefined]),
                h.label(
                  [h.Class('canvas-mode')],
                  [
                    'Canvas emphasis',
                    h.select(
                      [
                        h.Value(model.emphasis),
                        h.AriaLabel('Canvas emphasis'),
                        h.OnChange((value) =>
                          Message.SelectedCanvasEmphasis({
                            emphasis: Schema.is(CanvasEmphasis)(value) ? value : model.emphasis,
                          }),
                        ),
                      ],
                      (['c4', 'ddd', 'neutral'] as const).map((emphasis) =>
                        h.option(
                          [h.Value(emphasis)],
                          [
                            emphasis === 'c4'
                              ? 'C4 view'
                              : emphasis === 'ddd'
                                ? 'DDD view'
                                : 'Neutral view',
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                h.p([h.Class('mode-note')], ['Appearance only. Your diagram stays unchanged.']),
                h.p([h.Class('role-label')], [`Your role · ${model.role}`]),
              ]
            : [],
        ),
        h.div(
          [h.Class('canvas-column')],
          [
            h.div(
              [h.Class('canvas-alerts')],
              [
                ...(model.error || state.notice
                  ? [h.p([h.Role('alert')], [model.error || state.notice])]
                  : []),
                ...(model.role === 'viewer'
                  ? [h.p([], ['Viewer access. You can explore and export this diagram.'])]
                  : []),
                ...(model.queuedMove?._tag === 'Blocked'
                  ? [
                      h.p(
                        [h.Role('alert')],
                        [
                          'A queued move could not be applied safely. Your queued positions are retained; discard them to continue.',
                        ],
                      ),
                    ]
                  : []),
                ...(model.queuedMove?._tag === 'Blocked' && model.connection._tag !== 'Denied'
                  ? [
                      h.button(
                        [
                          h.Type('button'),
                          h.Disabled(isAuthoredGesture(currentEditor.gesture)),
                          h.OnClick(Message.ClickedDiscardQueuedMove()),
                        ],
                        ['Discard queued moves'],
                      ),
                    ]
                  : []),
              ],
            ),
            sharedCanvas(canvasView, [
              h,
              currentEditor,
              canvasDisabled,
              model.peers,
              model.room.generation,
              waiting,
              accessEnded ? null : model.overviewOpen,
              !layoutStale && isLiveConnection(model.connection) ? layout : null,
            ]),
            ...(!accessEnded && model.layout._tag !== 'Closed'
              ? [layoutPanel(model, h, layoutReason)]
              : []),
          ],
        ),
        h.aside(
          [
            h.Id('board-inspector'),
            h.Class('editor-inspector'),
            h.AriaLabel('Selection inspector'),
            h.Hidden(!inspectorOpen),
            h.Tabindex(-1),
          ],
          inspectorOpen
            ? [
                h.div(
                  [],
                  [
                    h.label(
                      [h.Class('inspector-mode')],
                      [
                        'Inspector view',
                        h.select(
                          [
                            h.AriaLabel('Inspector view'),
                            h.Value(model.inspector),
                            h.OnChange((value) =>
                              Message.SelectedInspector({
                                inspector: Schema.is(Inspector)(value) ? value : model.inspector,
                              }),
                            ),
                          ],
                          [
                            h.option([h.Value('selection')], ['Selection and authoring']),
                            h.option([h.Value('aggregate')], ['Aggregate']),
                            h.option([h.Value('coupling')], ['Balanced Coupling map']),
                            h.option([h.Value('evolution')], ['Diagram Evolution']),
                            ...(opyAvailable(model) ? [h.option([h.Value('opy')], ['OPY'])] : []),
                          ],
                        ),
                      ],
                    ),
                    ...(showOpy
                      ? [
                          h.button(
                            [h.Type('button'), h.OnClick(Message.ClosedOpy())],
                            ['Close OPY'],
                          ),
                        ]
                      : []),
                  ],
                ),
                h.div(
                  [h.Class('inspector-content')],
                  [
                    ...(showOpy || model.inspector === 'aggregate'
                      ? showOpy
                        ? [
                            Opy.view(model.opy, opyContext(model), h, (message) =>
                              Message.GotOpyMessage({ room: model.room, message }),
                            ),
                          ]
                        : [
                            model.connection._tag === 'Denied'
                              ? h.p([], ['Access ended.'])
                              : state.confirmed
                                ? aggregateInspector(aggregateView, [
                                    h,
                                    state.confirmed.document.graph,
                                    currentEditor.selectedNodes.length === 1
                                      ? (currentEditor.selectedNodes[0] ?? null)
                                      : null,
                                  ])
                                : h.p([], ['Opening diagram…']),
                          ]
                      : model.inspector === 'evolution'
                        ? [
                            evolutionInspector(evolutionInspectorView, [
                              h,
                              model.evolution,
                              accessEnded
                                ? 'denied'
                                : isLiveConnection(model.connection)
                                  ? 'live'
                                  : 'offline',
                            ]),
                          ]
                        : model.inspector === 'coupling'
                          ? [
                              ...(model.assessment.status === 'editing'
                                ? [
                                    h.div(
                                      [h.Class('coupling-notice')],
                                      [
                                        h.p(
                                          [h.Role('status')],
                                          [
                                            `Assessment ${model.assessment.draft.target.relationshipId} retained. ${model.assessment.delivery.status === 'uncertain' ? 'Save outcome unknown.' : model.assessment.delivery.status === 'sending' ? 'Sending save.' : model.assessment.notice || 'Your form is preserved.'}`,
                                          ],
                                        ),
                                        h.button(
                                          [
                                            h.Type('button'),
                                            h.OnClick(
                                              Message.SelectedInspector({ inspector: 'selection' }),
                                            ),
                                          ],
                                          ['Return to assessment'],
                                        ),
                                      ],
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
                              h.h2([h.Class('rail-heading')], ['Selection inspector']),
                              ...(selected
                                ? [
                                    h.label(
                                      [],
                                      [
                                        'Node label',
                                        h.input([
                                          h.Value(model.draft),
                                          h.Disabled(disabled),
                                          h.Maxlength(500),
                                          h.OnInput((text) => Message.ChangedLabel({ text })),
                                        ]),
                                      ],
                                    ),
                                    h.button(
                                      [
                                        h.Type('button'),
                                        h.Disabled(disabled || !model.draft.trim()),
                                        h.OnClick(Message.ClickedRename()),
                                      ],
                                      ['Rename node'],
                                    ),
                                    ...selected.ports.map((port) =>
                                      h.button(
                                        [
                                          h.Type('button'),
                                          h.Disabled(disabled),
                                          h.OnClick(
                                            onEvent({
                                              type: 'PortRemoved',
                                              endpoint: { node: selected.id, port: port.id },
                                            }),
                                          ),
                                        ],
                                        [`Remove ${port.id} port`],
                                      ),
                                    ),
                                  ]
                                : [
                                    h.p(
                                      [h.Class('inspector-hint')],
                                      [
                                        'Select a node to rename it. Drag to move; use the width handle to resize. Activate an output port, then an input port to connect.',
                                      ],
                                    ),
                                  ]),
                              h.div(
                                [h.Id('assessment-inspector'), h.Tabindex(-1)],
                                [
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
                                ],
                              ),
                              h.div(
                                [h.Class('board-facts')],
                                [
                                  h.div(
                                    [],
                                    [
                                      h.strong([], [String(currentEditor.graph.nodes.length)]),
                                      h.span([], ['Nodes']),
                                    ],
                                  ),
                                  h.div(
                                    [],
                                    [
                                      h.strong([], [String(currentEditor.graph.edges.length)]),
                                      h.span([], ['Connections']),
                                    ],
                                  ),
                                ],
                              ),
                            ]),
                  ],
                ),
              ]
            : [],
        ),
      ],
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
export const subscriptions = Subscription.make<Model, Message>()((entry) => {
  const feed = (slot: typeof SocketSlot.Type) =>
    entry(
      {
        room: Room,
        run: Schema.Number,
        delay: Schema.Literals([0, 1000]),
        active: Schema.Boolean,
        after: Schema.NullOr(Schema.Number),
      },
      {
        modelToDependencies: (model) => {
          const descriptor = feedDescriptor(model, slot);
          const seed = model.feedSeeds.find((seed) => seed.run === descriptor.run);
          return {
            ...descriptor,
            room: model.room,
            after: model.feedMode === 'delta' && seed ? seed.feed.cursor : null,
            active:
              descriptor.active &&
              Boolean(model.room.generation) &&
              session(model).confirmed !== null &&
              (model.feedMode === 'legacy' || Boolean(seed)),
          };
        },
        dependenciesToStream: ({ room, run, delay, active, after }) =>
          active
            ? Stream.fromEffect(Effect.sleep(delay)).pipe(
                Stream.flatMap(() =>
                  after !== null
                    ? deltaStream<Message>(
                        room,
                        after,
                        (entry) =>
                          entry.kind === 'delta'
                            ? Message.ObservedDelta({
                                room,
                                run,
                                cursor: entry.cursor,
                                delta: entry.delta,
                              })
                            : Message.ObservedCaughtUp({ room, run, cursor: entry.cursor }),
                        (reason) => Message.ObservedDisconnect({ room, run, reason }),
                      )
                    : liveStream<Message>(
                        room,
                        (snapshot) => Message.ObservedFrame({ room, run, frame: snapshot.state }),
                        (reason) => Message.ObservedDisconnect({ room, run, reason }),
                      ),
                ),
              )
            : Stream.empty,
      },
    );
  return {
    compactBoard: Subscription.persistentEntry(
      Dom.streamFromMediaQuery({
        query: compactBoardQuery,
        mapMatches: (compact) => Message.ChangedBoardWidth({ compact }),
      }),
    ),
    liveA: feed('a'),
    liveB: feed('b'),
    renewal: entry(
      { room: Room, run: Schema.Number, active: Schema.Boolean },
      {
        modelToDependencies: (model) => ({
          room: model.room,
          run: model.socketRun,
          active: Boolean(model.room.generation) && model.connection._tag === 'Live',
        }),
        dependenciesToStream: ({ room, run, active }) =>
          active
            ? Stream.fromEffect(Effect.sleep('20 seconds')).pipe(
                Stream.map(() => Message.ObservedRenewal({ room, run })),
              )
            : Stream.empty,
      },
    ),
    tick: entry(
      { room: Room, active: Schema.Boolean },
      {
        modelToDependencies: (model) => ({
          room: model.room,
          active: Boolean(model.room.generation) && model.connection._tag !== 'Denied',
        }),
        dependenciesToStream: ({ room, active }) =>
          active
            ? Stream.tick(3000).pipe(Stream.map(() => Message.ObservedTick({ room })))
            : Stream.empty,
      },
    ),
    unsaved: entry(
      { pending: Schema.Boolean },
      {
        modelToDependencies: (model) => ({
          pending: hasUncommittedEdit(model),
        }),
        dependenciesToStream: ({ pending }) => {
          if (!pending) return Stream.empty;
          return Stream.callback<Message>(() => {
            const acquire = Effect.sync(() => {
              const listener = (event: BeforeUnloadEvent) => {
                event.preventDefault();
              };
              window.addEventListener('beforeunload', listener);
              return listener;
            });
            return Effect.acquireRelease(acquire, (listener) =>
              Effect.sync(() => window.removeEventListener('beforeunload', listener)),
            );
          });
        },
      },
    ),
  };
});
