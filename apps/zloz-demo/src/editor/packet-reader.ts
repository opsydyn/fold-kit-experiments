import type { Html } from '@effect/ui/html';
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
import { reviewReader } from '@opsydyn/foldkit-zloz-mermaid/effect-ui';
import { Match } from 'effect';

import { ReadReviewPacket } from './command';
import { Message } from './message';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { nativeDetachedReview } from './native-detached-review';
import { architectureNativePanel } from './native-panel';
import { settingCheckbox } from './native-settings';
import { receiptAllowsMessage } from './receipt-review';
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
  if (
    review &&
    model.packetPreview?.scope === state.scope &&
    model.packetPreview.id === review.id &&
    model.packetPreview.side === review.side
  )
    return model.packetPreview;
  const snapshot = review?.packet[review.side].snapshot;
  const zoom = snapshot?.viewport?.zoom ?? 1;
  return review && snapshot
    ? {
        scope: state.scope,
        id: review.id,
        side: review.side,
        editor: createEditor(snapshot.graph, {
          readOnly: true,
          viewport: snapshot.viewport ?? { x: 0, y: 0, zoom: 1 },
          zoomLimits: { minZoom: Math.min(0.1, zoom), maxZoom: Math.max(4, zoom) },
        }),
      }
    : null;
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
  return Match.value(message).pipe(
    Match.tag('ChoseReviewPacketFiles', (message) => {
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
    }),
    // SAFETY: the package controls emit only ZlozReviewReaderRequest facts.
    Match.tag('ObservedReviewReaderInput', ({ request: input }) =>
      request(model, input as ZlozReviewReaderRequest),
    ),
    Match.tag('SucceededReviewPacketRead', ({ scope, run, json }) =>
      request(model, { scope, type: 'ReadSucceeded', run, text: json }),
    ),
    Match.tag('FailedReviewPacketRead', ({ scope, run }) =>
      request(model, { scope, type: 'ReadFailed', run }),
    ),
    Match.tag('ClickedPacketOpeningProtection', () => ({
      model: { ...model, protectReviewOpening: !model.protectReviewOpening },
    })),
    Match.tag('ObservedPacketCanvasInput', (message) => {
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
      // SAFETY: this detached canvas emits EditorEvent; updateHistoryReview admits only read-only inspection events.
      const next = updateHistoryReview(
        { editionId: String(current.id), editor: current.editor },
        message.message as EditorEvent,
      );
      return next.editor === current.editor
        ? { model }
        : { model: { ...model, packetPreview: { ...current, editor: next.editor } } };
    }),
    Match.orElse(() => ({ model })),
  );
}
const readerPanel = architectureNativePanel<Model>((h, model, send) => {
  const state = packetReaderState(model);
  const diagnostics = !model.minimalMode && model.diagnosticsEnabled;
  return h.div.children(
    h.label.children(
      settingCheckbox(
        h,
        model.protectReviewOpening,
        send(Message.ClickedPacketOpeningProtection()),
      ),
      'Protect packet opening',
    ),
    reviewReader(
      h,
      state,
      (input) => send(Message.ObservedReviewReaderInput({ request: input })),
      (files) => send(Message.ChoseReviewPacketFiles({ scope: state.scope, files: [...files] })),
      policy(model),
      {
        showCounts: diagnostics && model.diagnostics.measurements,
        instructions: diagnostics && model.diagnostics.instructions,
      },
    ),
  );
});

export function packetReaderPanel<M>(model: Model, h: Html.H<M>, send: (message: Message) => M) {
  return readerPanel(h, model, 'architecture-effect-ui', 'review-packet-reader', send);
}

const packetBanner = architectureNativePanel<
  Readonly<{ side: ZlozReviewReaderSide; close: Message; fit: Message }>
>((h, { side, close, fit }, send) =>
  h.div
    .class('receipt-canvas-banner')
    .attr('role', 'status')
    .children(
      `Read-only packet · ${side} · Working model preserved`,
      h.button.attr('type', 'button').on('click', send(fit)).children('Fit packet'),
      h.button.attr('type', 'button').on('click', send(close)).children('Close packet review'),
    ),
);

export function packetReviewCanvas<M>(model: Model, h: Html.H<M>, send: (message: Message) => M) {
  const current = model.packetPreview,
    state = packetReaderState(model);
  if (!current || !state.review) return h.div.children();
  const scheme =
    model.themePreference === 'system' ? model.systemColorScheme : model.themePreference;
  const onEvent = (message: EditorEvent) =>
    Message.ObservedPacketCanvasInput({
      scope: current.scope,
      id: current.id,
      side: current.side,
      message,
    });
  return h.div
    .key(`packet:${current.scope}:${current.id}:${current.side}`)
    .class('receipt-canvas packet-review-canvas')
    .children(
      packetBanner(
        h,
        {
          side: current.side,
          fit: onEvent({ type: 'FitViewClicked' }),
          close: Message.ObservedReviewReaderInput({
            request: { scope: state.scope, type: 'ReviewClosed', reviewId: state.review.id },
          }),
        },
        'architecture-effect-ui',
        'review-packet-banner',
        send,
      ),
      nativeDetachedReview(
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
        send,
      ),
    );
}
