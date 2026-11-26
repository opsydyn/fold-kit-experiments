import { Command, UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Schema } from 'effect';

import { createElkGroupLayoutV3 } from '../../../../../packages/foldkit-zloz-elk/src/index';
import { groupMermaidReviewV3 } from '../../../../../packages/foldkit-zloz-mermaid/src/effect-ui';
import {
  createGroupMermaidReviewV3,
  resolveGroupMermaidReviewV3,
  updateGroupMermaidReviewV3,
  type ZlozGroupMermaidDownloadV3,
  type ZlozGroupMermaidReviewRequestV3,
  type ZlozGroupMermaidReviewStateV3,
} from '../../../../../packages/foldkit-zloz-mermaid/src/group-review-v3';
import {
  groupClipboardV3,
  groupInspectorV3,
  groupSurfaceV3,
} from '../../../../../packages/foldkit-zloz/src/effect-ui';
import { captureGroupDocumentV3 } from '../../../../../packages/foldkit-zloz/src/group-document-v3';
import {
  groupLayoutRequestV3,
  type ZlozGroupLayoutRequestV3,
  type ZlozGroupLayoutResultV3,
} from '../../../../../packages/foldkit-zloz/src/group-layout-v3';
import {
  applyGroupWorkbenchLayoutV3,
  captureGroupWorkbenchDocumentV3,
  createGroupWorkbenchV3,
  updateGroupWorkbenchV3,
  type ZlozGroupWorkbenchEventV3,
  type ZlozGroupWorkbenchV3,
} from '../../../../../packages/foldkit-zloz/src/group-workbench-v3';
import wire from '../../../../../packages/foldkit-zloz/test/fixtures/group-document-v3-ported.json';

const scope = 'group-fixture';
type State = Readonly<{
  editor: ZlozGroupWorkbenchV3;
  review: ZlozGroupMermaidReviewStateV3;
  pending: ZlozGroupLayoutRequestV3 | null;
  layoutError: string | null;
  blocked: boolean;
}>;

const Message = UiSchema.TaggedEnum({
  Input: { event: Schema.Unknown },
  ArrangeClicked: {},
  LayoutSettled: {
    requestId: Schema.String,
    result: Schema.Unknown,
    error: Schema.NullOr(Schema.String),
  },
  ProtectionToggled: {},
  ReviewRequested: { request: Schema.Unknown },
  DownloadSettled: { request: Schema.Unknown },
});

const arrange = Command.make(
  'ArrangeGroup',
  { args: { request: Schema.Unknown } },
  ({ request: raw }) => {
    // SAFETY: Only the native v3 request constructor reaches this command.
    const request = raw as ZlozGroupLayoutRequestV3;
    return Effect.tryPromise(() => createElkGroupLayoutV3({ direction: 'DOWN' })(request)).pipe(
      Effect.match({
        onSuccess: (result) =>
          Message.LayoutSettled({ requestId: request.requestId, result, error: null }),
        onFailure: (error) =>
          Message.LayoutSettled({
            requestId: request.requestId,
            result: null,
            error: String(error),
          }),
      }),
    );
  },
);

const download = Command.make(
  'DownloadGroup',
  { args: { payload: Schema.Unknown } },
  ({ payload: raw }) => {
    // SAFETY: Only detached payloads returned by the Mermaid review reducer are issued.
    const { scope, generation, key, run, fileName, text } = raw as ZlozGroupMermaidDownloadV3;
    return Effect.gen(function* () {
      const allocate = Effect.sync(() =>
        URL.createObjectURL(new Blob([text], { type: 'application/json' })),
      );
      const url = yield* Effect.acquireRelease(allocate, (url) =>
        Effect.sync(() => URL.revokeObjectURL(url)),
      );
      yield* Effect.sync(() =>
        Object.assign(document.createElement('a'), { href: url, download: fileName }).click(),
      );
      yield* Effect.sleep('100 millis');
    }).pipe(
      Effect.scoped,
      Effect.matchCause({
        onSuccess: () =>
          Message.DownloadSettled({
            request: {
              type: 'MermaidDownloadSettled',
              scope,
              generation,
              key,
              run,
              outcome: 'succeeded',
            },
          }),
        onFailure: () =>
          Message.DownloadSettled({
            request: {
              type: 'MermaidDownloadSettled',
              scope,
              generation,
              key,
              run,
              outcome: 'failed',
            },
          }),
      }),
    );
  },
);

const reviewContext = (state: State) => ({
  scope,
  sourceRevision: state.editor.editor.revision,
  document: captureGroupWorkbenchDocumentV3(state.editor),
  canDownload: () => (state.blocked ? 'Export is protected.' : null),
});

export const NativeGroupEditor = Html.component({
  name: 'NativeGroupEditor',
  model: Schema.fromJsonString(Schema.Unknown),
  message: Message,
}).make({
  init: (): State => ({
    editor: createGroupWorkbenchV3(captureGroupDocumentV3(wire), { sessionId: scope }),
    review: createGroupMermaidReviewV3(scope),
    pending: null,
    layoutError: null,
    blocked: false,
  }),
  update: ($, message) => {
    // SAFETY: This fixture owns and serializes its model in init and the transitions below.
    const state = $.model as State;
    return Message.match(message, {
      Input: ({ event }) => {
        // SAFETY: Only the native v3 canvas and fixture controls emit the scoped editor input.
        const input = event as ZlozGroupWorkbenchEventV3;
        return $.set({ ...state, editor: updateGroupWorkbenchV3(state.editor, input) });
      },
      ArrangeClicked: () => {
        if (state.pending || state.editor.gesture.type !== 'idle') return $.set(state);
        const pending = groupLayoutRequestV3(
          state.editor.editor,
          `${scope}:${state.editor.editor.revision}`,
        );
        return $.set({ ...state, pending, layoutError: null }).run(
          arrange.make({ request: pending }),
        );
      },
      LayoutSettled: ({ requestId, result, error }) => {
        if (!state.pending || requestId !== state.pending.requestId) return $.set(state);
        // SAFETY: The result is emitted by the ELK command and checked by the transaction kernel.
        const editor =
          result === null
            ? state.editor
            : applyGroupWorkbenchLayoutV3(
                state.editor,
                state.pending,
                result as ZlozGroupLayoutResultV3,
              );
        return $.set({ ...state, pending: null, editor, layoutError: error });
      },
      ProtectionToggled: () => $.set({ ...state, blocked: !state.blocked }),
      ReviewRequested: ({ request: raw }) => {
        // SAFETY: The Mermaid view emits source-bound requests and the reducer rechecks identity and policy.
        const request = raw as ZlozGroupMermaidReviewRequestV3;
        const { state: review, payload } = updateGroupMermaidReviewV3(
          state.review,
          reviewContext(state),
          request,
        );
        const next = $.set({ ...state, review });
        return payload ? next.run(download.make({ payload })) : next;
      },
      DownloadSettled: ({ request: raw }) => {
        // SAFETY: The download command emits a source-bound completion with the original run.
        const request = raw as ZlozGroupMermaidReviewRequestV3;
        const { state: review } = updateGroupMermaidReviewV3(
          state.review,
          reviewContext(state),
          request,
        );
        return $.set({ ...state, review });
      },
    });
  },
  view: (h, model) => {
    // SAFETY: The model was created by this fixture and transferred as its JSON snapshot.
    const state = model as State;
    const editorView = {
      id: 'fixture-group',
      onEvent: (event: ZlozGroupWorkbenchEventV3) => Message.Input({ event }),
    };
    return h.div(
      h.button
        .disabled(state.pending !== null)
        .on('click', Message.ArrangeClicked())
        .children('Arrange with ELK'),
      h.button.on('click', Message.ProtectionToggled()).children('Toggle export protection'),
      ...(state.layoutError ? [h.p.attr('role', 'alert').children(state.layoutError)] : []),
      groupSurfaceV3(h, state.editor, editorView),
      groupInspectorV3(h, state.editor, editorView),
      groupClipboardV3(h, state.editor, editorView),
      groupMermaidReviewV3(
        h,
        resolveGroupMermaidReviewV3(state.review, reviewContext(state)),
        (request) => Message.ReviewRequested({ request }),
        { id: 'fixture-mermaid' },
      ),
    );
  },
});
