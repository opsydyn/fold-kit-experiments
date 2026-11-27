import {
  createEditor,
  updateHistoryReview,
  type EditorState,
  type EditorEvent,
} from '@opsydyn/foldkit-zloz';
import {
  reviewReaderForScope,
  updateReviewReader,
  type ZlozReviewReaderRequest,
  type ZlozReviewReaderSide,
} from '@opsydyn/foldkit-zloz-mermaid';
import { zlozReviewReader } from '@opsydyn/foldkit-zloz-mermaid/foldkit';
import {
  zlozView,
  zlozC4Node,
  zlozDddNode,
  zlozEventStormingNode,
  zlozC4Group,
  zlozDddGroup,
} from '@opsydyn/foldkit-zloz/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

import { ReadReviewPacket } from './command';
import { Message } from './message';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { nativeDetachedReview } from './native-detached-review';
import { receiptAllowsMessage } from './receipt-review';
import { workbenchThemes } from './theme';
import type { Return } from './transition';
export type PacketReviewPreview = Readonly<{
  scope: string;
  id: number;
  side: ZlozReviewReaderSide;
  editor: EditorState;
}>;
export function packetReaderState(model: Model) {
  return reviewReaderForScope(model.packetReader, `${model.modelIdentity.id}/${model.modelEpoch}`);
}
export function packetReviewActive(model: Model) {
  return packetReaderState(model).review !== null;
}
function policy(model: Model) {
  return {
    blockedReason: model.protectReviewOpening
      ? 'Packet opening is protected in this workspace.'
      : model.sidebarSection !== 'review' || model.sidebarCollapsed
        ? 'Show Review packets before opening a file.'
        : model.receiptReview || model.receiptRead
          ? 'Close or finish the receipt comparison first.'
          : model.historyReview || model.historyPlayback?.cursor.status === 'playing'
            ? 'Return to the present before opening a packet.'
            : modelSessionBusy(model)
              ? 'Finish active edits, imports or layout before opening a packet.'
              : model.packetPreview?.editor.gesture.type !== 'idle' && model.packetPreview !== null
                ? 'Finish the packet canvas gesture before opening another file.'
                : null,
    selectionReason:
      model.packetPreview && model.packetPreview.editor.gesture.type !== 'idle'
        ? 'Finish the packet canvas gesture before changing sides.'
        : null,
  };
}
function preview(model: Model, state: Model['packetReader']): PacketReviewPreview | null {
  const review = state.review;
  if (!review) return null;
  if (
    model.packetPreview?.scope === state.scope &&
    model.packetPreview.id === review.id &&
    model.packetPreview.side === review.side
  )
    return model.packetPreview;
  const snapshot = review.packet[review.side].snapshot,
    zoom = snapshot.viewport?.zoom ?? 1;
  return {
    scope: state.scope,
    id: review.id,
    side: review.side,
    editor: createEditor(snapshot.graph, {
      readOnly: true,
      viewport: snapshot.viewport ?? { x: 0, y: 0, zoom: 1 },
      zoomLimits: { minZoom: Math.min(0.1, zoom), maxZoom: Math.max(4, zoom) },
    }),
  };
}
function request(
  model: Model,
  input: ZlozReviewReaderRequest,
  file?: File,
): Return<Model, Message> {
  const result = updateReviewReader(packetReaderState(model), input, policy(model));
  const next = {
    ...model,
    packetReader: result.state,
    packetPreview: preview(model, result.state),
  };
  return result.read && file
    ? { model: next, commands: [ReadReviewPacket.make({ ...result.read, file })] }
    : { model: next };
}
const tags = new Set([
  'ChoseReviewPacketFiles',
  'ObservedReviewReaderInput',
  'SucceededReviewPacketRead',
  'FailedReviewPacketRead',
  'ObservedPacketCanvasInput',
  'ClickedPacketOpeningProtection',
]);
export function isPacketReaderMessage(message: Message) {
  return tags.has(message._tag);
}
export function packetAllowsMessage(message: Message) {
  return (
    isPacketReaderMessage(message) ||
    message._tag === 'ChangedPlaybackReducedMotion' ||
    message._tag === 'ChangedPlaybackVisibility' ||
    (message._tag === 'SelectedWorkbenchSection'
      ? message.section === 'review' || message.section === 'diagnostics'
      : receiptAllowsMessage(message))
  );
}
export function updatePacketReader(model: Model, message: Message): Return<Model, Message> {
  switch (message._tag) {
    case 'ChoseReviewPacketFiles': {
      const state = packetReaderState(model);
      if (message.scope !== state.scope) return { model };
      const file = message.files[0];
      if (!file || message.files.length !== 1)
        return {
          model: {
            ...model,
            packetReader: {
              ...state,
              notice: 'Choose exactly one review packet JSON file. Previous review preserved.',
            },
          },
        };
      return request(
        model,
        {
          scope: message.scope,
          type: 'ReadRequested',
          file: { name: file.name, byteLength: file.size },
        },
        file,
      );
    }
    case 'ObservedReviewReaderInput':
      // SAFETY: the package controls emit only ZlozReviewReaderRequest facts.
      return request(model, message.request as ZlozReviewReaderRequest);
    case 'SucceededReviewPacketRead':
      return request(model, {
        scope: message.scope,
        type: 'ReadSucceeded',
        run: message.run,
        text: message.json,
      });
    case 'FailedReviewPacketRead':
      return request(model, { scope: message.scope, type: 'ReadFailed', run: message.run });
    case 'ClickedPacketOpeningProtection':
      return { model: { ...model, protectReviewOpening: !model.protectReviewOpening } };
    case 'ObservedPacketCanvasInput': {
      const current = model.packetPreview,
        state = packetReaderState(model);
      if (
        !current ||
        !state.review ||
        current.scope !== message.scope ||
        current.id !== message.id ||
        current.side !== message.side ||
        current.scope !== state.scope
      )
        return { model };
      // SAFETY: this detached zlozView emits EditorEvent; updateHistoryReview admits only read-only inspection events.
      const next = updateHistoryReview(
        { editionId: String(current.id), editor: current.editor },
        message.message as EditorEvent,
      );
      return next.editor === current.editor
        ? { model }
        : { model: { ...model, packetPreview: { ...current, editor: next.editor } } };
    }
    default:
      return { model };
  }
}
export function packetReaderPanel(model: Model, h: HtmlBuilder<Message>) {
  const state = packetReaderState(model),
    counts = !model.minimalMode && model.diagnosticsEnabled && model.diagnostics.measurements;
  return [
    h.label(
      [],
      [
        h.input([
          h.Type('checkbox'),
          h.Checked(model.protectReviewOpening),
          h.OnClick(Message.ClickedPacketOpeningProtection()),
        ]),
        'Protect packet opening',
      ],
    ),
    zlozReviewReader(
      h,
      state,
      (request) => Message.ObservedReviewReaderInput({ request }),
      (files) => Message.ChoseReviewPacketFiles({ scope: state.scope, files: [...files] }),
      policy(model),
      {
        showCounts: counts,
        instructions:
          !model.minimalMode && model.diagnosticsEnabled && model.diagnostics.instructions,
      },
    ),
  ];
}
export function packetReviewCanvas(model: Model, h: HtmlBuilder<Message>, native: boolean) {
  const current = model.packetPreview,
    state = packetReaderState(model);
  if (!current || !state.review) return h.div([], []);
  const scheme =
    model.themePreference === 'system' ? model.systemColorScheme : model.themePreference;
  const onEvent = (message: EditorEvent) =>
    Message.ObservedPacketCanvasInput({
      scope: current.scope,
      id: current.id,
      side: current.side,
      message,
    });
  return h.div(
    [
      h.Key(`packet:${current.scope}:${current.id}:${current.side}`),
      h.Class('receipt-canvas packet-review-canvas'),
    ],
    [
      h.div(
        [h.Class('receipt-canvas-banner'), h.Role('status')],
        [
          `Read-only packet · ${current.side} · Working model preserved`,
          h.button(
            [h.Type('button'), h.OnClick(onEvent({ type: 'FitViewClicked' }))],
            ['Fit packet'],
          ),
          h.button(
            [
              h.Type('button'),
              h.OnClick(
                Message.ObservedReviewReaderInput({
                  request: { scope: state.scope, type: 'ReviewClosed', reviewId: state.review.id },
                }),
              ),
            ],
            ['Close packet review'],
          ),
        ],
      ),
      native
        ? nativeDetachedReview(
            h,
            {
              id: `packet-${current.id}-${current.side}`,
              label: 'Read-only packet diagram',
              editor: current.editor,
              scheme: scheme ?? 'light',
              onEvent,
            },
            'architecture-detached-review',
            `packet-${current.id}-${current.side}`,
          )
        : zlozView(h, current.editor, {
            id: `packet-${current.id}-${current.side}`,
            label: 'Read-only packet diagram',
            height: 'fill',
            theme: workbenchThemes[scheme ?? 'light'],
            diagnostics: false,
            background: { type: 'dots' },
            renderNodeShell: (context, builder) =>
              zlozEventStormingNode(context, builder) ??
              zlozC4Node(context, builder) ??
              zlozDddNode(context, builder),
            renderGroupShell: (context, builder) =>
              zlozC4Group(context, builder) ?? zlozDddGroup(context, builder),
            renderLayout: (parts) => parts.canvas,
            onEvent,
          }),
    ],
  );
}
