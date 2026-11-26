import { Command, UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import {
  publishGroupWorkbenchResultV3,
  assessPortableCompatibilityV3,
  createSvgReview,
  createPngReview,
  pngReviewForScope,
  updateGroupPngReviewV3,
  type ZlozPngReviewState,
  type ZlozPngReviewRequest,
  type ZlozPngArtifact,
  type ZlozGroupPngRenderPayloadV3,
  svgReviewForScope,
  updateGroupSvgReviewV3,
  type ZlozSvgReviewState,
  type ZlozSvgReviewRequest,
  type ZlozSvgDownload,
  groupLayoutRequestV3,
  applyGroupWorkbenchLayoutV3,
  type ZlozGroupLayoutRequestV3,
  type ZlozGroupLayoutResultV3,
  captureEditionV3,
  captureGroupDocumentV3,
  captureGroupWorkbenchDocumentV3,
  applyGroupEditorTransactionV3,
  captureGroupEditorSourceV3,
  captureModelDocumentV3,
  compareEditionsV3,
  createGroupWorkbenchV3,
  createHistoryReviewV3,
  parseModelDocumentV3,
  restoreModelEditionV3,
  serializeModelDocumentV3,
  updateGroupWorkbenchV3,
  type ZlozEditionV3,
  type ZlozGroupWorkbenchEventV3,
  type ZlozGroupWorkbenchV3,
  type ZlozGroupEditorPolicyV3,
  type ZlozModelDocumentV3,
} from '@opsydyn/foldkit-zloz';
import { createElkGroupLayoutV3 } from '@opsydyn/foldkit-zloz-elk';
import {
  createGroupMermaidReviewV3,
  groupMermaidReviewForScopeV3,
  updateGroupMermaidReviewV3,
  type ZlozGroupMermaidReviewStateV3,
  type ZlozGroupMermaidReviewRequestV3,
  type ZlozGroupMermaidDownloadV3,
} from '@opsydyn/foldkit-zloz-mermaid';
import { groupMermaidReviewV3 } from '@opsydyn/foldkit-zloz-mermaid/effect-ui';
import { renderGroupPngExportV3, downloadPngArtifact } from '@opsydyn/foldkit-zloz/browser';
import {
  groupClipboardV3,
  groupInspectorV3,
  groupSurfaceV3,
  pngReview,
  svgReview,
  type GroupSurfaceOptionsV3,
  zlozDarkTheme,
  zlozLightTheme,
} from '@opsydyn/foldkit-zloz/effect-ui';
import { Data, Effect, Schema } from 'effect';

import { groupMermaidContext, groupMermaidControls, groupMermaidFindingLabel } from './mermaid';
import { groupPngContext, groupPngControls } from './png';
import {
  createNativeReviewTools,
  updateNativeReviewTools,
  nativeReviewToolsView,
  type NativeReviewTools,
  type NativeReviewEvent,
} from './review-tools';
import { groupSvgContext, groupSvgControls } from './svg';

export type ReadyState = Readonly<{
  workbench: ZlozGroupWorkbenchV3;
  nativeTools: NativeReviewTools;
  evidenceReview: ZlozGroupWorkbenchV3 | null;
  nativeReadSequence: number;
  pendingNativeRead: Readonly<{
    token: number;
    sessionId: string;
    revision: number;
    text: string;
  }> | null;
  catalogue: Omit<ZlozModelDocumentV3, 'snapshot'>;
  review: Readonly<{ edition: ZlozEditionV3; workbench: ZlozGroupWorkbenchV3 }> | null;
  theme: 'light' | 'dark';
  minimal: boolean;
  locked: boolean;
  text: string;
  notice: string;
  openSequence: number;
  layoutSequence: number;
  pendingLayout: ZlozGroupLayoutRequestV3 | null;
  svgReview: ZlozSvgReviewState;
  svgCustom: boolean;
  svgRetained: boolean;
  protectSvg: boolean;
  pngReview: ZlozPngReviewState;
  pngRetained: boolean;
  protectPng: boolean;
  mermaidReview: ZlozGroupMermaidReviewStateV3;
  protectMermaid: boolean;
  pendingOpen: Readonly<{ token: number; sessionId: string; revision: number }> | null;
}>;
export const Model = UiSchema.TaggedEnum({
  Preparing: {},
  Ready: { state: Schema.fromJsonString(Schema.Unknown) },
  Failed: {},
});
export type Model = typeof Model.Type;
export const Message = UiSchema.TaggedEnum({
  SucceededIdentity: { id: Schema.String },
  FailedIdentity: {},
  ClickedRetry: {},
  ObservedWorkbenchInput: { event: Schema.Unknown },
  ObservedNativeReview: { event: Schema.Unknown },
  ClickedNativeDownload: {},
  ChoseNativeEvidenceFiles: { files: Schema.Unknown },
  SucceededNativeRead: { text: Schema.String, token: Schema.Number },
  FailedNativeRead: { reason: Schema.String, token: Schema.Number },
  ClickedTheme: {},
  ClickedMinimal: {},
  ClickedProtection: {},
  ClickedCheckpoint: {},
  ObservedSvgReview: { request: Schema.Unknown },
  ObservedPngReview: { request: Schema.Unknown },
  ObservedMermaidReview: { request: Schema.Unknown },
  ClickedMermaidProtection: {},
  ClickedPngRetained: {},
  ClickedPngProtection: {},
  SettledPngDownload: { scope: Schema.String, key: Schema.String, succeeded: Schema.Boolean },
  ClickedSvgCustom: {},
  ClickedSvgRetained: {},
  ClickedSvgProtection: {},
  ClickedLayout: { direction: Schema.Literals(['RIGHT', 'DOWN']) },
  ClickedCancelLayout: {},
  SucceededLayout: { result: Schema.Unknown },
  FailedLayout: { requestId: Schema.String, reason: Schema.String },
  ClickedReview: { id: Schema.String },
  ClickedWorking: {},
  ClickedRestore: {},
  ChangedText: { text: Schema.String },
  ClickedOpen: {},
  ClickedDownload: {},
  SucceededOpen: { document: Schema.Unknown, id: Schema.String, token: Schema.Number },
  FailedOpen: { reason: Schema.String, token: Schema.Number },
  CompletedDownload: {},
  FailedDownload: {},
});
export type Message = typeof Message.Type;
const AllocateGroupIdentity = Command.make('AllocateGroupIdentity', { args: {} }, () =>
  Effect.try(() => crypto.randomUUID()).pipe(
    Effect.match({
      onSuccess: (id) => Message.SucceededIdentity({ id }),
      onFailure: () => Message.FailedIdentity(),
    }),
  ),
);
class ModelInputFailure extends Data.TaggedError('ModelInputFailure')<{
  readonly message: string;
}> {}
const OpenGroupModel = Command.make(
  'OpenGroupModel',
  {
    args: { text: Schema.String, token: Schema.Number },
  },
  ({ text, token }) =>
    Effect.try({
      try: () => {
        if (text.length > 1048576 || new TextEncoder().encode(text).length > 1048576)
          throw new ModelInputFailure({
            message: 'Workbench input exceeds 1 MiB. Use the package codec for larger models.',
          });
        return { document: parseModelDocumentV3(text), id: crypto.randomUUID() };
      },
      catch: (cause) => String(cause),
    }).pipe(
      Effect.match({
        onSuccess: ({ document, id }) => Message.SucceededOpen({ document, id, token }),
        onFailure: (reason) => Message.FailedOpen({ reason, token }),
      }),
    ),
);
const ReadNativeEvidence = Command.make(
  'ReadNativeEvidence',
  {
    args: { file: Schema.Unknown, token: Schema.Number },
  },
  ({ file: raw, token }) => {
    // SAFETY: Only this module's file chooser passes a browser File to this IO Command.
    const file = raw as File;
    return Effect.tryPromise({
      try: async () => {
        if (file.size > 1048576)
          throw new ModelInputFailure({ message: 'Input exceeds 1 MiB UTF-8.' });
        const bytes = await file.arrayBuffer();
        if (bytes.byteLength > 1048576)
          throw new ModelInputFailure({ message: 'Input exceeds 1 MiB UTF-8.' });
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      },
      catch: (cause) => String(cause),
    }).pipe(
      Effect.match({
        onSuccess: (text) => Message.SucceededNativeRead({ text, token }),
        onFailure: (reason) => Message.FailedNativeRead({ reason, token }),
      }),
    );
  },
);
const DownloadGroupModel = Command.make(
  'DownloadGroupModel',
  {
    args: { text: Schema.String, filename: Schema.String },
  },
  ({ text, filename }) =>
    Effect.gen(function* () {
      const acquire = Effect.try(() =>
        URL.createObjectURL(new Blob([text], { type: 'application/json' })),
      );
      const url = yield* Effect.acquireRelease(acquire, (url) =>
        Effect.sync(() => URL.revokeObjectURL(url)),
      );
      yield* Effect.try(() =>
        Object.assign(document.createElement('a'), {
          href: url,
          download: filename,
        }).click(),
      );
      yield* Effect.sleep('1 second');
    }).pipe(
      Effect.scoped,
      Effect.match({
        onSuccess: () => Message.CompletedDownload(),
        onFailure: () => Message.FailedDownload(),
      }),
    ),
);
const DownloadGroupSvg = Command.make(
  'DownloadGroupSvg',
  {
    args: { payload: Schema.Unknown },
  },
  ({ payload: raw }) => {
    // SAFETY: Only the native review controller produces this detached, validated download payload.
    const payload = raw as ZlozSvgDownload;
    const identity = {
      scope: payload.scope,
      generation: payload.generation,
      key: payload.key,
      run: payload.run,
    };
    return Effect.gen(function* () {
      const acquire = Effect.try(() =>
        URL.createObjectURL(new Blob([payload.svg], { type: 'image/svg+xml' })),
      );
      const url = yield* Effect.acquireRelease(acquire, (url) =>
        Effect.sync(() => URL.revokeObjectURL(url)),
      );
      yield* Effect.try(() =>
        Object.assign(document.createElement('a'), {
          href: url,
          download: payload.fileName,
        }).click(),
      );
      yield* Effect.sleep('1 second');
    }).pipe(
      Effect.scoped,
      Effect.match({
        onSuccess: () =>
          Message.ObservedSvgReview({
            request: { ...identity, type: 'SvgDownloadSettled', outcome: 'succeeded' },
          }),
        onFailure: () =>
          Message.ObservedSvgReview({
            request: { ...identity, type: 'SvgDownloadSettled', outcome: 'failed' },
          }),
      }),
    );
  },
);
const DownloadGroupMermaid = Command.make(
  'DownloadGroupMermaid',
  {
    args: { payload: Schema.Unknown },
  },
  ({ payload: raw }) => {
    // SAFETY: The native review controller alone constructs this detached source-bound download payload.
    const payload = raw as ZlozGroupMermaidDownloadV3;
    const identity = {
      scope: payload.scope,
      generation: payload.generation,
      key: payload.key,
      run: payload.run,
    };
    return Effect.gen(function* () {
      const acquire = Effect.try(() =>
        URL.createObjectURL(new Blob([payload.text], { type: 'application/json' })),
      );
      const url = yield* Effect.acquireRelease(acquire, (url) =>
        Effect.sync(() => URL.revokeObjectURL(url)),
      );
      yield* Effect.try(() =>
        Object.assign(document.createElement('a'), {
          href: url,
          download: payload.fileName,
        }).click(),
      );
      yield* Effect.sleep('1 second');
    }).pipe(
      Effect.scoped,
      Effect.match({
        onSuccess: () =>
          Message.ObservedMermaidReview({
            request: { ...identity, type: 'MermaidDownloadSettled', outcome: 'succeeded' },
          }),
        onFailure: () =>
          Message.ObservedMermaidReview({
            request: { ...identity, type: 'MermaidDownloadSettled', outcome: 'failed' },
          }),
      }),
    );
  },
);
const RenderGroupPng = Command.make(
  'RenderGroupPng',
  {
    args: { payload: Schema.Unknown },
    mode: 'switch',
  },
  ({ payload: raw }) => {
    // SAFETY: The native package review controller constructs this detached, source-bound job.
    const payload = raw as ZlozGroupPngRenderPayloadV3;
    const identity = {
      scope: payload.scope,
      generation: payload.generation,
      key: payload.key,
      run: payload.run,
    };
    return Effect.tryPromise((signal) => renderGroupPngExportV3(payload.input, { signal })).pipe(
      Effect.match({
        onSuccess: (result) =>
          Message.ObservedPngReview({ request: { ...identity, type: 'PngRenderSettled', result } }),
        onFailure: () =>
          Message.ObservedPngReview({
            request: {
              ...identity,
              type: 'PngRenderSettled',
              result: {
                type: 'failed',
                code: 'render-failed',
                reason: 'PNG rendering failed. Review settings and retry.',
              },
            },
          }),
      }),
    );
  },
);
const DownloadGroupPng = Command.make(
  'DownloadGroupPng',
  {
    args: {
      artifact: Schema.Unknown,
      fileName: Schema.String,
      scope: Schema.String,
      key: Schema.String,
    },
  },
  ({ artifact: raw, fileName, scope, key }) => {
    // SAFETY: Only a native reviewed browser artifact reaches this download Command.
    const artifact = raw as ZlozPngArtifact;
    return Effect.try(() => downloadPngArtifact(artifact, fileName)).pipe(
      Effect.match({
        onSuccess: () => Message.SettledPngDownload({ scope, key, succeeded: true }),
        onFailure: () => Message.SettledPngDownload({ scope, key, succeeded: false }),
      }),
    );
  },
);
const ArrangeGroupModel = Command.make(
  'ArrangeGroupModel',
  {
    args: { request: Schema.Unknown, direction: Schema.Literals(['RIGHT', 'DOWN']) },
  },
  ({ request: raw, direction }) => {
    // SAFETY: Only groupLayoutRequestV3 constructs this Command argument in the typed update below.
    const request = raw as ZlozGroupLayoutRequestV3;
    return Effect.tryPromise(() => createElkGroupLayoutV3({ direction })(request)).pipe(
      Effect.match({
        onSuccess: (result) => Message.SucceededLayout({ result }),
        onFailure: (error) =>
          Message.FailedLayout({ requestId: request.requestId, reason: String(error) }),
      }),
    );
  },
);
const initialDocument = () =>
  captureGroupDocumentV3({
    version: 3,
    coordinateSpace: 'world',
    connectionMode: 'strict',
    capabilities: { groupPorts: true },
    graph: {
      nodes: [
        {
          id: 'orders',
          label: 'Orders boundary',
          kind: 'group',
          position: { x: 60, y: 100 },
          size: { width: 380, height: 320 },
          ports: [{ id: 'api', label: 'Public API', kind: 'output', side: 'right', offset: 0.5 }],
        },
        {
          id: 'service',
          label: 'Order service',
          architecture: { family: 'event-storming', role: 'command' },
          parentId: 'orders',
          position: { x: 110, y: 205 },
          size: { width: 220, height: 100 },
          ports: [{ id: 'events', label: 'Events', kind: 'output', side: 'right', offset: 0.5 }],
        },
        {
          id: 'warehouse',
          label: 'Warehouse',
          position: { x: 580, y: 200 },
          size: { width: 220, height: 120 },
          ports: [{ id: 'input', label: 'Receive', kind: 'input', side: 'left', offset: 0.5 }],
        },
      ],
      edges: [
        {
          id: 'service-events',
          label: 'Order placed',
          source: { node: 'service', port: 'events' },
          target: { node: 'warehouse', port: 'input' },
        },
      ],
    },
  });
function ready(id: string, document?: ZlozModelDocumentV3): ReadyState {
  const base =
    document ??
    captureModelDocumentV3({
      id: `model:${id}`,
      name: 'Orders group model',
      snapshot: initialDocument(),
      editions: [],
      origin: null,
    });
  const { snapshot, ...catalogue } = base;
  return {
    catalogue,
    nativeTools: createNativeReviewTools(),
    nativeReadSequence: 0,
    pendingNativeRead: null,
    evidenceReview: null,
    workbench: createGroupWorkbenchV3(snapshot, { sessionId: id }),
    review: null,
    theme: 'light',
    minimal: false,
    locked: false,
    text: '',
    openSequence: 0,
    layoutSequence: 0,
    pendingLayout: null,
    pendingOpen: null,
    svgReview: createSvgReview(`${id}:svg`),
    svgCustom: false,
    svgRetained: false,
    protectSvg: false,
    pngReview: createPngReview(`${id}:png`),
    pngRetained: false,
    protectPng: false,
    mermaidReview: createGroupMermaidReviewV3(`${id}:mermaid`),
    protectMermaid: false,
    notice: 'Native v3 controls. Export and advanced-tool limits are listed below.',
  };
}
function working(state: ReadyState): ZlozModelDocumentV3 {
  return captureModelDocumentV3({ ...state.catalogue, snapshot: state.workbench.editor.document });
}
function policy(state: ReadyState): ZlozGroupEditorPolicyV3 {
  return state.locked
    ? {
        canMoveNode: (node) =>
          node.id === 'service' ? 'The service is pinned by the current workshop policy.' : null,
        canEditPort: () => 'The published interface is protected.',
        canReconnect: () => 'Published connections are protected.',
      }
    : {};
}
type GroupUpdate = { model: Model; commands?: readonly Command.Command<Message>[] };

export const init = () => ({ model: Model.Preparing(), commands: [AllocateGroupIdentity.make()] });
export function update(model: Model, message: Message): GroupUpdate {
  // SAFETY: Ready is constructed only by ready()/the typed transitions in this module.
  const state = model._tag === 'Ready' ? (model.state as ReadyState) : null;
  const changed = (next: ReadyState): GroupUpdate => ({
    model: Model.Ready({ state: next }),
  });
  return Message.match(message, {
    SucceededIdentity: ({ id }) => (model._tag === 'Preparing' ? changed(ready(id)) : { model }),
    FailedIdentity: () => ({ model: model._tag === 'Preparing' ? Model.Failed() : model }),
    ClickedRetry: () => (model._tag === 'Failed' ? init() : { model }),
    ChoseNativeEvidenceFiles: ({ files: raw }) => {
      if (!state) return { model };
      // SAFETY: Only the native file input supplies this browser File array.
      const files = raw as readonly File[],
        file = files[0];
      if (files.length !== 1 || !file)
        return changed({
          ...state,
          notice: 'Choose one evidence JSON file. Existing review retained.',
        });
      if (state.workbench.gesture.type !== 'idle')
        return changed({
          ...state,
          notice: 'Finish or cancel the active gesture before opening evidence.',
        });
      const token = state.nativeReadSequence + 1;
      return {
        model: Model.Ready({
          state: {
            ...state,
            nativeReadSequence: token,
            pendingNativeRead: {
              token,
              sessionId: state.workbench.editor.sessionId,
              revision: state.workbench.editor.revision,
              text: state.nativeTools.text,
            },
          },
        }),
        commands: [ReadNativeEvidence.make({ file, token })],
      };
    },
    SucceededNativeRead: ({ text, token }) => {
      if (!state || state.pendingNativeRead?.token !== token) return { model };
      const active = state.pendingNativeRead;
      if (
        active.sessionId !== state.workbench.editor.sessionId ||
        active.revision !== state.workbench.editor.revision ||
        active.text !== state.nativeTools.text ||
        state.workbench.gesture.type !== 'idle'
      )
        return changed({
          ...state,
          pendingNativeRead: null,
          notice: 'Evidence read became stale. Current work and previous review retained.',
        });
      const changedText = updateNativeReviewTools(
        state.nativeTools,
        { type: 'TextChanged', text },
        state.workbench.editor,
        working(state),
      );
      const reopened = updateNativeReviewTools(
        changedText.tools,
        { type: 'OpenEvidenceClicked' },
        state.workbench.editor,
        working(state),
      );
      const opened = reopened.tools.opened;
      return changed({
        ...state,
        pendingNativeRead: null,
        nativeTools: reopened.tools,
        evidenceReview: opened
          ? createGroupWorkbenchV3(opened[opened.side], {
              sessionId: `${state.workbench.editor.sessionId}:evidence:${opened.sequence}:${opened.side}`,
              readOnly: true,
            })
          : state.evidenceReview,
      });
    },
    FailedNativeRead: ({ reason, token }) =>
      state?.pendingNativeRead?.token === token
        ? changed({ ...state, pendingNativeRead: null, notice: reason })
        : { model },
    ObservedNativeReview: ({ event }) => {
      if (!state) return { model };
      // SAFETY: Only native review view emits this closed host event universe.
      const request = event as NativeReviewEvent;
      const result = updateNativeReviewTools(
        state.nativeTools,
        request,
        state.workbench.editor,
        working(state),
        policy(state),
        state.review !== null ||
          state.evidenceReview !== null ||
          state.pendingOpen !== null ||
          state.pendingLayout !== null ||
          state.workbench.gesture.type !== 'idle',
      );
      const opened = result.tools.opened;
      const evidenceReview = opened
        ? opened === state.nativeTools.opened
          ? state.evidenceReview
          : createGroupWorkbenchV3(opened[opened.side], {
              sessionId: `${state.workbench.editor.sessionId}:evidence:${opened.sequence}:${opened.side}`,
              readOnly: true,
            })
        : null;
      const { snapshot: _snapshot, ...catalogue } = result.document;
      return changed({
        ...state,
        catalogue,
        pendingNativeRead: null,
        nativeTools: result.tools,
        evidenceReview,
        workbench:
          result.editor === state.workbench.editor
            ? state.workbench
            : publishGroupWorkbenchResultV3(state.workbench, {
                type: 'applied',
                editor: result.editor,
              }),
      });
    },
    ClickedNativeDownload: () =>
      state?.nativeTools.artifact
        ? { model, commands: [DownloadGroupModel.make(state.nativeTools.artifact)] }
        : { model },
    ObservedWorkbenchInput: ({ event }) => {
      if (!state) return { model };
      // SAFETY: Package views emit this declared event universe; no portable JSON becomes a UI event.
      const input = event as ZlozGroupWorkbenchEventV3;
      if (state.evidenceReview)
        return changed({
          ...state,
          evidenceReview: updateGroupWorkbenchV3(state.evidenceReview, input, policy(state), {
            grid: 20,
          }),
        });
      return state.review
        ? changed({
            ...state,
            review: {
              ...state.review,
              workbench: updateGroupWorkbenchV3(state.review.workbench, input, policy(state), {
                portAnchorSnap: { distance: 12, cornerDistance: 10, midpointDistance: 10 },
                grid: 20,
                pasteOffset: { x: 0, y: 380 },
              }),
            },
          })
        : changed({
            ...state,
            workbench: updateGroupWorkbenchV3(state.workbench, input, policy(state), {
              portAnchorSnap: { distance: 12, cornerDistance: 10, midpointDistance: 10 },
              grid: 20,
              pasteOffset: { x: 0, y: 380 },
            }),
          });
    },
    ClickedTheme: () =>
      state ? changed({ ...state, theme: state.theme === 'light' ? 'dark' : 'light' }) : { model },
    ClickedMinimal: () => (state ? changed({ ...state, minimal: !state.minimal }) : { model }),
    ClickedProtection: () => (state ? changed({ ...state, locked: !state.locked }) : { model }),
    ClickedPngRetained: () =>
      state ? changed({ ...state, pngRetained: !state.pngRetained }) : { model },
    ClickedPngProtection: () =>
      state ? changed({ ...state, protectPng: !state.protectPng }) : { model },
    ClickedMermaidProtection: () =>
      state ? changed({ ...state, protectMermaid: !state.protectMermaid }) : { model },
    ObservedMermaidReview: ({ request: raw }) => {
      if (!state) return { model };
      // SAFETY: Only package controls and the download Command produce native review requests.
      const request = raw as ZlozGroupMermaidReviewRequestV3,
        context = groupMermaidContext(state);
      if (request.scope !== context.scope) return { model };
      const result = updateGroupMermaidReviewV3(
        groupMermaidReviewForScopeV3(state.mermaidReview, context.scope),
        context,
        request,
      );
      const next = { ...state, mermaidReview: result.state, notice: result.notice || state.notice };
      return result.payload
        ? {
            model: Model.Ready({ state: next }),
            commands: [DownloadGroupMermaid.make({ payload: result.payload })],
          }
        : changed(next);
    },
    ObservedPngReview: ({ request: raw }) => {
      if (!state) return { model };
      // SAFETY: Package PNG controls and RenderGroupPng emit the declared native review facts.
      const request = raw as ZlozPngReviewRequest;
      const context = groupPngContext(state);
      if (request.type === 'PngRenderSettled' && request.scope !== context.scope) return { model };
      const review = pngReviewForScope(state.pngReview, context.scope);
      const result = updateGroupPngReviewV3(review, context, request);
      const next = { ...state, pngReview: result.state, notice: result.notice || state.notice };
      if (
        request.type === 'PngRenderCancelled' &&
        review.rendering.type === 'pending' &&
        result.state.rendering.type === 'idle'
      )
        return { ...changed(next), commands: [Command.interrupt(RenderGroupPng)] };
      return result.payload
        ? {
            model: Model.Ready({ state: next }),
            commands: [RenderGroupPng.make({ payload: result.payload })],
          }
        : result.download
          ? {
              model: Model.Ready({ state: next }),
              commands: [
                DownloadGroupPng.make({
                  ...result.download,
                  scope: context.scope,
                  key: request.key,
                }),
              ],
            }
          : changed(next);
    },
    SettledPngDownload: ({ scope, key, succeeded }) => {
      if (!state) return { model };
      const current = groupPngControls(state);
      if (scope !== current.identity.scope || key !== current.identity.key) return { model };
      return changed({
        ...state,
        notice: succeeded
          ? 'Reviewed PNG downloaded.'
          : 'PNG download failed. The reviewed image is retained for retry.',
      });
    },
    ClickedSvgCustom: () =>
      state ? changed({ ...state, svgCustom: !state.svgCustom }) : { model },
    ClickedSvgRetained: () =>
      state ? changed({ ...state, svgRetained: !state.svgRetained }) : { model },
    ClickedSvgProtection: () =>
      state ? changed({ ...state, protectSvg: !state.protectSvg }) : { model },
    ObservedSvgReview: ({ request: raw }) => {
      if (!state) return { model };
      // SAFETY: Package SVG controls and DownloadGroupSvg emit this closed review event universe.
      const request = raw as ZlozSvgReviewRequest;
      const context = groupSvgContext(state);
      if (request.type === 'SvgDownloadSettled' && request.scope !== context.scope)
        return { model };
      const result = updateGroupSvgReviewV3(
        svgReviewForScope(state.svgReview, context.scope),
        context,
        request,
      );
      const next = { ...state, svgReview: result.state, notice: result.notice || state.notice };
      return result.payload
        ? {
            model: Model.Ready({ state: next }),
            commands: [DownloadGroupSvg.make({ payload: result.payload })],
          }
        : changed(next);
    },
    ClickedLayout: ({ direction }) => {
      if (!state || state.review || state.workbench.gesture.type !== 'idle') return { model };
      const sequence = state.layoutSequence + 1,
        request = groupLayoutRequestV3(
          state.workbench.editor,
          `${state.workbench.editor.sessionId}:layout:${sequence}`,
          {
            edgeLabels: state.workbench.editor.document.graph.edges
              .filter((edge) => edge.label?.trim())
              .map((edge) => ({ id: edge.id, size: { width: 160, height: 32 } })),
          },
        );
      return {
        model: Model.Ready({
          state: {
            ...state,
            layoutSequence: sequence,
            pendingLayout: request,
            notice: `Arranging native v3 groups ${direction.toLowerCase()}…`,
          },
        }),
        commands: [ArrangeGroupModel.make({ request, direction })],
      };
    },
    ClickedCancelLayout: () =>
      state
        ? changed({
            ...state,
            pendingLayout: null,
            notice: 'Layout cancelled. Late results will be ignored.',
          })
        : { model },
    SucceededLayout: ({ result: raw }) => {
      // SAFETY: The engine Command produces this result; core independently validates complete geometry at Apply.
      const result = raw as ZlozGroupLayoutResultV3;
      if (!state?.pendingLayout || result.requestId !== state.pendingLayout.requestId)
        return { model };
      if (state.review)
        return changed({
          ...state,
          pendingLayout: null,
          notice: 'Layout ignored during read-only review.',
        });
      const workbench = applyGroupWorkbenchLayoutV3(
        state.workbench,
        state.pendingLayout,
        result,
        policy(state),
      );
      return changed({ ...state, pendingLayout: null, workbench, notice: workbench.status });
    },
    FailedLayout: ({ requestId, reason }) =>
      state?.pendingLayout?.requestId === requestId
        ? changed({
            ...state,
            pendingLayout: null,
            notice: `Layout failed. Current model retained. ${reason}`,
          })
        : { model },
    ClickedCheckpoint: () => {
      if (!state || state.review || state.workbench.gesture.type !== 'idle') return { model };
      const result = applyGroupEditorTransactionV3(
        state.workbench.editor,
        {
          source: captureGroupEditorSourceV3(state.workbench.editor),
          document: captureGroupWorkbenchDocumentV3(state.workbench),
        },
        policy(state),
      );
      if (result.type === 'blocked') return changed({ ...state, notice: result.reason });
      const workbench = { ...state.workbench, editor: result.editor };
      let index = state.catalogue.editions.length + 1;
      while (
        state.catalogue.editions.some(
          (e) => e.id === `${state.workbench.editor.sessionId}:edition:${index}`,
        )
      )
        index++;
      const edition = captureEditionV3({
        id: `${state.workbench.editor.sessionId}:edition:${index}`,
        name: `Edition ${index}`,
        snapshot: result.editor.document,
      });
      const catalogue = { ...state.catalogue, editions: [...state.catalogue.editions, edition] };
      // Validate aggregate limits before publishing catalogue and working state together.
      captureModelDocumentV3({ ...catalogue, snapshot: result.editor.document });
      return changed({
        ...state,
        catalogue,
        workbench,
        notice: 'Checkpoint retained with its own mode, capabilities and camera.',
      });
    },
    ClickedReview: ({ id }) => {
      const edition = state?.catalogue.editions.find((e) => e.id === id);
      if (!state || !edition || state.workbench.gesture.type !== 'idle') return { model };
      const review = createHistoryReviewV3(
        edition,
        `${state.workbench.editor.sessionId}:review:${id}`,
      );
      const workbench = createGroupWorkbenchV3(edition.snapshot, {
        sessionId: review.editor.sessionId,
        readOnly: true,
        historyLimit: 0,
      });
      return changed({
        ...state,
        review: { edition: review.edition, workbench },
        pendingLayout: null,
        notice: 'Read-only checkpoint. Working Undo remains independent.',
      });
    },
    ClickedWorking: () => (state ? changed({ ...state, review: null }) : { model }),
    ClickedRestore: () => {
      if (!state?.review || state.workbench.gesture.type !== 'idle') return { model };
      const result = restoreModelEditionV3(
        working(state),
        state.workbench.editor,
        {
          source: captureGroupEditorSourceV3(state.workbench.editor),
          modelId: state.catalogue.id,
          edition: state.review.edition,
        },
        policy(state),
      );
      return changed({
        ...state,
        workbench: {
          ...state.workbench,
          editor: result.editor,
          viewport: result.editor.document.viewport ?? { x: 20, y: 20, zoom: 1 },
        },
        review: result.type === 'blocked' ? state.review : null,
        notice:
          result.type === 'blocked'
            ? result.reason
            : 'Checkpoint restored. One Undo returns to the previous complete document.',
      });
    },
    ChangedText: ({ text }) => (state ? changed({ ...state, text }) : { model }),
    ClickedOpen: () => {
      if (!state || state.workbench.gesture.type !== 'idle') return { model };
      const token = state.openSequence + 1;
      return {
        model: Model.Ready({
          state: {
            ...state,
            openSequence: token,
            pendingOpen: {
              token,
              sessionId: state.workbench.editor.sessionId,
              revision: state.workbench.editor.revision,
            },
          },
        }),
        commands: [OpenGroupModel.make({ text: state.text, token })],
      };
    },
    SucceededOpen: ({ document, id, token }) => {
      if (!state || state.pendingOpen?.token !== token) return { model };
      if (
        state.workbench.editor.sessionId !== state.pendingOpen.sessionId ||
        state.workbench.editor.revision !== state.pendingOpen.revision ||
        state.workbench.gesture.type !== 'idle'
      )
        return changed({
          ...state,
          pendingOpen: null,
          notice:
            'The working model changed while opening. Current edits were retained; open again to replace them.',
        });
      // SAFETY: OpenGroupModel emits document only after parseModelDocumentV3 succeeds.
      return changed({
        ...ready(id, document as ZlozModelDocumentV3),
        theme: state.theme,
        minimal: state.minimal,
        openSequence: state.openSequence,
        notice: 'Opened a validated v3 model in a new session with independent Undo.',
      });
    },
    FailedOpen: ({ reason, token }) =>
      state?.pendingOpen?.token === token
        ? changed({ ...state, pendingOpen: null, notice: reason })
        : { model },
    ClickedDownload: () =>
      state
        ? {
            model,
            commands: [
              DownloadGroupModel.make({
                filename: 'zloz-model-v3.json',
                text: serializeModelDocumentV3({
                  ...working(state),
                  snapshot: captureGroupWorkbenchDocumentV3(state.workbench),
                }),
              }),
            ],
          }
        : { model },
    CompletedDownload: () =>
      state ? changed({ ...state, notice: 'Validated native artifact downloaded.' }) : { model },
    FailedDownload: () =>
      state
        ? changed({ ...state, notice: 'Download failed. The working model is retained.' })
        : { model },
  });
}

export function view(h: Html.H<Message>, model: Model) {
  return Model.match(model, {
    Preparing: () => h.p.attr('role', 'status').children('Preparing a new v3 session…'),
    Failed: () =>
      h.div.children(
        h.p.attr('role', 'alert').children('Could not allocate a new session.'),
        h.button.on('click', Message.ClickedRetry()).children('Try again'),
      ),
    Ready: ({ state: raw }) => {
      // SAFETY: Ready contains only this module's ReadyState.
      const state = raw as ReadyState,
        current = state.evidenceReview ?? state.review?.workbench ?? state.workbench;
      const options: GroupSurfaceOptionsV3<Message> = {
        id: 'group-v3-canvas',
        portAnchorSnapBypass: 'Alt',
        theme: state.theme === 'dark' ? zlozDarkTheme : zlozLightTheme,
        minimalMode: state.minimal,
        policy: policy(state),
        onEvent: (event) => Message.ObservedWorkbenchInput({ event }),
        nodeBadge: () => (state.svgCustom ? 'Workshop' : undefined),
      };
      const button = (label: string, message: Message, disabled = false) =>
        h.button.attr('type', 'button').on('click', message).disabled(disabled).children(label);
      const report = assessPortableCompatibilityV3(working(state));
      const comparison = state.review
        ? compareEditionsV3(
            state.review.edition,
            captureEditionV3({
              id: 'working',
              name: 'Working',
              snapshot: state.workbench.editor.document,
            }),
          )
        : null;
      return h.div
        .class('flow-workbench group-v3-workbench')
        .attr('data-flow-workbench-color-scheme', state.theme)
        .children(
          h.div.class('workbench-layout').children(
            h.aside
              .class('workbench-sidebar')
              .attr('aria-label', 'Group modelling sidebar')
              .children(
                h.div.class('workbench-sidebar-scroll').children(
                  h.p.class('workbench-eyebrow').children('COMPOSE · CONNECT · COMMUNICATE'),
                  h.h1.children('V3 group workbench'),
                  h.p.children('Authored group ports, live policies and complete-document Undo.'),
                  button(
                    state.theme === 'light' ? 'Use dark theme' : 'Use light theme',
                    Message.ClickedTheme(),
                  ),
                  button(
                    state.minimal ? 'Show diagnostics' : 'Minimal mode',
                    Message.ClickedMinimal(),
                  ),
                  button(
                    state.locked ? 'Disable protection' : 'Protect service and interface',
                    Message.ClickedProtection(),
                  ),
                  h.p.attr('role', 'status').attr('aria-live', 'polite').children(state.notice),
                  nativeReviewToolsView(
                    h,
                    state.nativeTools,
                    state.workbench.editor,
                    working(state),
                    policy(state),
                    state.review !== null ||
                      state.evidenceReview !== null ||
                      state.pendingLayout !== null ||
                      state.pendingOpen !== null ||
                      state.workbench.gesture.type !== 'idle',
                    (event) => Message.ObservedNativeReview({ event }),
                    () => Message.ClickedNativeDownload(),
                    (files) => Message.ChoseNativeEvidenceFiles({ files }),
                  ),
                  ...(state.review
                    ? [
                        h.h2.children(`Review: ${state.review.edition.name}`),
                        button('Return to working model', Message.ClickedWorking()),
                        button('Restore checkpoint', Message.ClickedRestore()),
                        h.p.children(
                          `${comparison?.nodes.length ?? 0} node changes; ${comparison?.edges.length ?? 0} connection changes. Mode changed: ${comparison?.modeChange.changed ? 'yes' : 'no'}. Capability changed: ${comparison?.capabilityChange.changed ? 'yes' : 'no'}.`,
                        ),
                      ]
                    : [groupInspectorV3(h, current, options)]),
                  h.details
                    .key('clipboard')
                    .attr('data-zloz-clipboard-panel', '')
                    .children(
                      h.summary.children('Clipboard'),
                      groupClipboardV3(h, current, options, { x: 0, y: 380 }),
                    ),
                  h.h2.children('Native v3 ELK layout'),
                  button(
                    'Arrange right',
                    Message.ClickedLayout({ direction: 'RIGHT' }),
                    state.review !== null || current.gesture.type !== 'idle',
                  ),
                  button(
                    'Arrange down',
                    Message.ClickedLayout({ direction: 'DOWN' }),
                    state.review !== null || current.gesture.type !== 'idle',
                  ),
                  ...(state.pendingLayout
                    ? [button('Cancel layout', Message.ClickedCancelLayout())]
                    : []),
                  h.p.children(
                    'Keeps group ports, connections and camera. Each accepted layout is one Undo; current protections are checked again before Apply.',
                  ),
                  h.details.key('svg-export').children(
                    h.summary.children('SVG export review'),
                    button(
                      state.svgCustom ? 'Use canonical shells' : 'Show custom workshop shells',
                      Message.ClickedSvgCustom(),
                    ),
                    button(
                      state.svgRetained ? 'Use canonical edge paths' : 'Use retained ELK routes',
                      Message.ClickedSvgRetained(),
                    ),
                    button(
                      state.protectSvg ? 'Allow SVG downloads' : 'Protect SVG downloads',
                      Message.ClickedSvgProtection(),
                    ),
                    svgReview(
                      h,
                      groupSvgControls(state),
                      (request) => Message.ObservedSvgReview({ request }),
                      {
                        idPrefix: 'group-v3-svg',
                        diagnostics: {
                          instructions: !state.minimal,
                          measurements: !state.minimal,
                        },
                      },
                    ),
                  ),
                  h.details
                    .key('png-export')
                    .attr('data-native-png-review', '')
                    .children(
                      h.summary.children('PNG export review'),
                      button(
                        state.svgCustom
                          ? 'Use canonical PNG shells'
                          : 'Show custom workshop shells for PNG',
                        Message.ClickedSvgCustom(),
                      ),
                      button(
                        state.pngRetained
                          ? 'Use canonical PNG paths'
                          : 'Use retained ELK routes for PNG',
                        Message.ClickedPngRetained(),
                      ),
                      button(
                        state.protectPng ? 'Allow PNG export' : 'Protect PNG export',
                        Message.ClickedPngProtection(),
                      ),
                      pngReview(
                        h,
                        groupPngControls(state),
                        (request) => Message.ObservedPngReview({ request }),
                        {
                          idPrefix: 'group-v3-png',
                          diagnostics: {
                            instructions: !state.minimal,
                            measurements: !state.minimal,
                          },
                        },
                      ),
                    ),
                  h.details.key('mermaid-export').children(
                    h.summary.children('Mermaid export review'),
                    button(
                      state.protectMermaid ? 'Allow Mermaid export' : 'Protect Mermaid export',
                      Message.ClickedMermaidProtection(),
                    ),
                    groupMermaidReviewV3(
                      h,
                      groupMermaidControls(state),
                      (request) => Message.ObservedMermaidReview({ request }),
                      {
                        id: 'native-v3-mermaid',
                        minimalMode: state.minimal,
                        findingLabel: (finding) => groupMermaidFindingLabel(state, finding),
                      },
                    ),
                  ),
                  h.h2.children('Editions'),
                  button(
                    'Save checkpoint',
                    Message.ClickedCheckpoint(),
                    state.review !== null || state.workbench.gesture.type !== 'idle',
                  ),
                  ...state.catalogue.editions.map((edition) =>
                    button(`Review ${edition.name}`, Message.ClickedReview({ id: edition.id })),
                  ),
                  h.details.key('portable-model').children(
                    h.summary.children('Portable v3 model'),
                    button('Download model', Message.ClickedDownload()),
                    h.label.children(
                      'Paste canonical v3 model JSON',
                      h.textarea
                        .attr('aria-label', 'Canonical v3 model JSON')
                        .value(state.text)
                        .on('input', ({ value: text }) => Message.ChangedText({ text }))
                        .children(),
                    ),
                    button('Open in new session', Message.ClickedOpen()),
                    h.p.children(
                      'Workbench input limit: 1 MiB UTF-8. Opening validates every checkpoint before replacing the working session.',
                    ),
                  ),
                  h.details
                    .key('compatibility')
                    .children(
                      h.summary.children('Compatibility and release limits'),
                      h.ul.children(
                        ...report.adapters.map((adapter) =>
                          h.li.children(`${adapter.adapter}: ${adapter.status}. ${adapter.reason}`),
                        ),
                      ),
                      ...report.limits.map((limit) => h.p.children(limit)),
                    ),
                ),
              ),
            h.section
              .class('group-v3-stage')
              .attr(
                'aria-label',
                state.evidenceReview
                  ? 'Read-only evidence canvas'
                  : state.review
                    ? 'Read-only edition canvas'
                    : 'Working group canvas',
              )
              .children(groupSurfaceV3(h, current, options)),
          ),
        );
    },
  });
}

export default Html.component({
  name: 'ZlozGroupWorkbench',
  model: Model,
  message: Message,
}).make({
  init: ($) => {
    const initial = init();
    return $.set(initial.model).run(...initial.commands);
  },
  update: ($, message) => {
    const next = update($.model, message);
    return $.set(next.model).run(...(next.commands ?? []));
  },
  view,
});
