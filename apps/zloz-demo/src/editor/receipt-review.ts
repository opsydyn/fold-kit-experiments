import type { Html } from '@effect/ui/html';
import {
  captureEdition,
  resolveHistoryChangeNavigator,
  resolveHistoryChangeFocus,
  resolveHistoryChangeStep,
  type ZlozHistoryChangeCursor,
  type ZlozHistoryChangeFocusDecision,
  compareEditions,
  createModelEditor,
  createEventStormingDddConversionPlan,
  createEventStormingC4ConversionPlan,
  parseEventStormingC4Conversion,
  type ZlozEventStormingC4Conversion,
  type ZlozNode,
  type ZlozHistoryChangeItem,
  type ZlozEdge,
  parseEventStormingDddConversion,
  updateHistoryReview,
  type EditorEvent,
  type EditorState,
  type ZlozEventStormingDddConversion,
} from '@opsydyn/foldkit-zloz';
import { Match, Option, Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';

import { ReadConversionReceipt } from './command';
import { editionArchiveByteLimit } from './history';
import { Message } from './message';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { nativeDetachedReview } from './native-detached-review';
import { architectureNativePanel } from './native-panel';
import type { Return } from './transition';

export type ReceiptReview = Readonly<{
  id: number;
  receipt: ZlozEventStormingDddConversion | ZlozEventStormingC4Conversion;
  side: 'before' | 'after';
  focusedChange: ZlozHistoryChangeCursor | null;
  editor: EditorState;
}>;
function preview(receipt: ReceiptReview['receipt'], side: ReceiptReview['side']) {
  const document = side === 'before' ? receipt.source.document : receipt.document;
  const zoom = document.snapshot.viewport?.zoom ?? 1;
  return createModelEditor(document, {
    readOnly: true,
    zoomLimits: { minZoom: Math.min(0.1, zoom), maxZoom: Math.max(4, zoom) },
  });
}
export function receiptComparison(review: ReceiptReview, side: ReceiptReview['side'] = 'after') {
  const before = captureEdition({
    id: 'receipt-before',
    name: 'Before conversion',
    snapshot: review.receipt.source.document.snapshot,
  });
  const after = captureEdition({
    id: 'receipt-after',
    name: 'After conversion',
    snapshot: review.receipt.document.snapshot,
  });
  return side === 'before' ? compareEditions(after, before) : compareEditions(before, after);
}
function focusOptions(model: Model) {
  return {
    blockedReason: model.receiptRead
      ? 'Finish or cancel the receipt read before focusing changes.'
      : !model.receiptReview?.editor.surface
        ? 'Waiting for the receipt canvas measurement.'
        : model.receiptReview.editor.gesture.type !== 'idle'
          ? 'Finish the receipt canvas gesture before focusing changes.'
          : null,
    focusReason: (item: ZlozHistoryChangeItem) =>
      item.change.kind === 'removed' ? 'This change is absent on this side of the receipt.' : null,
  };
}
function sideAvailability(model: Model): string | null {
  return !model.receiptReview?.focusedChange &&
    !model.receiptRead &&
    model.receiptReview?.editor.gesture.type === 'idle'
    ? null
    : focusOptions(model).blockedReason;
}
export function receiptChangeNavigation(model: Model, side: ReceiptReview['side']) {
  return resolveHistoryChangeNavigator(
    model.receiptReview ? receiptComparison(model.receiptReview, side) : null,
    focusOptions(model),
  );
}
export function receiptChangeSteps(model: Model) {
  const review = model.receiptReview;
  const comparison = review ? receiptComparison(review, review.side) : null;
  const entries = resolveHistoryChangeNavigator(comparison, focusOptions(model)).entries;
  const index = review?.focusedChange
    ? entries.findIndex((entry) => sameCursor(entry, review.focusedChange))
    : -1;
  return {
    previous: resolveHistoryChangeStep(
      comparison,
      review?.focusedChange ?? null,
      'previous',
      focusOptions(model),
    ),
    next: resolveHistoryChangeStep(
      comparison,
      review?.focusedChange ?? null,
      'next',
      focusOptions(model),
    ),
    position: index >= 0 ? index + 1 : null,
    total: entries.length,
  };
}
function sameCursor(
  left: ZlozHistoryChangeCursor | null,
  right: ZlozHistoryChangeCursor | null,
): boolean {
  return left === null || right === null
    ? left === right
    : left.entity === right.entity && left.id === right.id;
}
function focusReceipt(
  model: Model,
  side: ReceiptReview['side'],
  decision: ZlozHistoryChangeFocusDecision,
): Model {
  const review = model.receiptReview;
  if (!review || decision.type === 'ignored') return model;
  if (decision.type === 'blocked') return { ...model, receiptReviewNotice: decision.reason };
  if (decision.target.side !== 'selected') return model;
  const editor =
    review.side === side
      ? review.editor
      : { ...preview(review.receipt, side), surface: review.editor.surface };
  const next = updateHistoryReview({ editionId: String(review.id), editor }, decision.target.event);
  return {
    ...model,
    receiptReview: {
      ...review,
      side,
      focusedChange: { entity: decision.entry.entity, id: decision.entry.id },
      editor: next.editor,
    },
    receiptReviewNotice: `Focused ${decision.entry.entity === 'node' ? 'node' : 'connection'} ${decision.entry.label} ${side} conversion.`,
  };
}
const allowed = new Set<string>([
  'SelectedWorkbenchSection',
  'ClickedWorkbenchSidebar',
  'SelectedThemePreference',
  'ChangedSystemColorScheme',
  'LoadedThemePreference',
  'CompletedColorSchemeSave',
  'FailedColorSchemeSave',
  'ClickedMinimalMode',
  'ClickedDiagnosticsPanel',
  'ClickedDiagnosticsEnabled',
  'ClickedDiagnostic',
  'CompletedConversionReceiptDownload',
  'CompletedC4ReceiptDownload',
  'FailedC4ReceiptDownload',
  'CompletedSvgDownload',
  'FailedSvgDownload',
  'FailedConversionReceiptDownload',
]);
export function receiptAllowsMessage(message: Message) {
  return (
    allowed.has(message._tag) &&
    (message._tag !== 'SelectedWorkbenchSection' ||
      message.section === 'mapping' ||
      message.section === 'c4mapping' ||
      message.section === 'diagnostics')
  );
}
const failure =
  'Could not open receipt. Choose valid conversion JSON (v1, UTF-8, at most 5 MiB). The working model and any previous comparison are preserved.';
function readMatches(model: Model, id: number) {
  return (
    model.receiptRead?.id === id &&
    model.receiptRead.modelId === model.modelIdentity.id &&
    model.receiptRead.epoch === model.modelEpoch
  );
}
/** File input is data-only: no session activation, Apply, consent or retained-receipt publication. */
const receiptMessages = new Set<string>([
  'ChoseConversionReceiptFiles',
  'SucceededConversionReceiptRead',
  'FailedConversionReceiptRead',
  'ClickedCancelReceiptRead',
  'ClickedCloseReceiptReview',
  'SelectedReceiptSide',
  'ClickedReceiptOverview',
  'ObservedReceiptInput',
  'ClickedReceiptChange',
  'ClickedReceiptChangeStep',
]);
export function isReceiptMessage(message: Message) {
  return receiptMessages.has(message._tag);
}
export function updateReceiptReview(model: Model, message: Message): Return<Model, Message> {
  return Match.value(message).pipe(
    Match.tag('ChoseConversionReceiptFiles', (input): Return<Model, Message> => {
      if (!input.files.length) return { model };
      if (modelSessionBusy(model) || model.historyPlayback?.cursor.status === 'playing')
        return {
          model: {
            ...model,
            receiptReviewNotice: 'Finish active edits or pause playback before opening a receipt.',
          },
        };
      const file = input.files[0];
      if (input.files.length !== 1 || !file || file.size > editionArchiveByteLimit)
        return {
          model: {
            ...model,
            receiptRead: null,
            receiptReadRun: model.receiptReadRun + 1,
            receiptReviewNotice: failure,
          },
        };
      const id = model.receiptReadRun + 1;
      return {
        model: {
          ...model,
          receiptRead: { id, modelId: model.modelIdentity.id, epoch: model.modelEpoch },
          receiptReadRun: id,
          receiptReviewNotice: 'Opening receipt for read-only comparison…',
        },
        commands: [ReadConversionReceipt.make({ id, file })],
      };
    }),
    Match.tag('ClickedCancelReceiptRead', (_input): Return<Model, Message> => {
      return {
        model: {
          ...model,
          receiptRead: null,
          receiptReadRun: model.receiptReadRun + 1,
          receiptReviewNotice: 'Receipt read cancelled. The working model is unchanged.',
        },
      };
    }),
    Match.tag('FailedConversionReceiptRead', (input): Return<Model, Message> => {
      return readMatches(model, input.id)
        ? { model: { ...model, receiptRead: null, receiptReviewNotice: failure } }
        : { model };
    }),
    Match.tag('SucceededConversionReceiptRead', (input): Return<Model, Message> => {
      if (!readMatches(model, input.id)) return { model };
      if (modelSessionBusy(model) || model.historyPlayback?.cursor.status === 'playing')
        return {
          model: {
            ...model,
            receiptRead: null,
            receiptReviewNotice:
              'Finish active edits, then reopen the receipt. The working model is unchanged.',
          },
        };
      const ddd: Option.Option<ReceiptReview['receipt']> = Option.liftThrowable(
        parseEventStormingDddConversion,
      )(input.json);
      const decoded = Option.orElse(ddd, () =>
        Option.liftThrowable(parseEventStormingC4Conversion)(input.json),
      );
      if (Option.isNone(decoded))
        return { model: { ...model, receiptRead: null, receiptReviewNotice: failure } };
      const receipt = decoded.value;
      return {
        model: {
          ...model,
          receiptRead: null,
          receiptReview: {
            id: input.id,
            receipt,
            side: 'after',
            focusedChange: null,
            editor: preview(receipt, 'after'),
          },
          sidebarSection: receipt.format === 'foldkit-zloz-c4-conversion' ? 'c4mapping' : 'mapping',
          sidebarCollapsed: false,
          notice: 'Read-only receipt comparison. Working model preserved.',
          receiptReviewNotice: 'Receipt opened for read-only comparison. Working model preserved.',
        },
      };
    }),
    Match.tag('ClickedCloseReceiptReview', (_input): Return<Model, Message> => {
      return {
        model: {
          ...model,
          receiptReview: null,
          receiptRead: null,
          receiptReadRun: model.receiptReadRun + 1,
          notice: 'Comparison closed. Working model and Undo history preserved.',
          receiptReviewNotice: 'Comparison closed. Working model and Undo history preserved.',
        },
      };
    }),
    Match.tag('SelectedReceiptSide', (input): Return<Model, Message> => {
      const review = model.receiptReview;
      if (!review || review.id !== input.id || review.side === input.side) return { model };
      if (
        (model.sidebarSection !== 'mapping' && model.sidebarSection !== 'c4mapping') ||
        model.sidebarCollapsed
      )
        return { model };
      const reason = sideAvailability(model);
      if (reason) return { model: { ...model, receiptReviewNotice: reason } };
      if (review.focusedChange) {
        const comparison = receiptComparison(review, input.side);
        const decision = resolveHistoryChangeFocus(
          comparison,
          {
            baselineId: comparison.baseline.id,
            selectedId: comparison.selected.id,
            ...review.focusedChange,
          },
          focusOptions(model),
        );
        return { model: focusReceipt(model, input.side, decision) };
      }

      return {
        model: {
          ...model,
          receiptReview: {
            ...review,
            side: input.side,
            focusedChange: null,
            editor: preview(review.receipt, input.side),
          },
        },
      };
    }),
    Match.tag('ClickedReceiptOverview', (input): Return<Model, Message> => {
      const review = model.receiptReview;
      if (
        !review ||
        review.id !== input.id ||
        review.side !== input.side ||
        (model.sidebarSection !== 'mapping' && model.sidebarSection !== 'c4mapping') ||
        model.sidebarCollapsed
      )
        return { model };
      const reason = focusOptions(model).blockedReason;
      if (reason) return { model: { ...model, receiptReviewNotice: reason } };
      const next = updateHistoryReview(
        { editionId: String(review.id), editor: review.editor },
        { type: 'FitViewClicked' },
      );
      return {
        model: {
          ...model,
          receiptReview: { ...review, focusedChange: null, editor: next.editor },
          receiptReviewNotice: `Showing receipt overview ${review.side} conversion. Selection cleared; working model preserved.`,
        },
      };
    }),
    Match.tag('ClickedReceiptChange', (input): Return<Model, Message> => {
      const review = model.receiptReview;
      if (
        !review ||
        review.id !== input.reviewId ||
        (model.sidebarSection !== 'mapping' && model.sidebarSection !== 'c4mapping') ||
        model.sidebarCollapsed
      )
        return { model };
      const decision = resolveHistoryChangeFocus(
        receiptComparison(review, input.side),
        input,
        focusOptions(model),
      );
      return { model: focusReceipt(model, input.side, decision) };
    }),
    Match.tag('ClickedReceiptChangeStep', (input): Return<Model, Message> => {
      const review = model.receiptReview;
      if (
        !review ||
        review.id !== input.reviewId ||
        review.side !== input.side ||
        !sameCursor(input.from, review.focusedChange) ||
        (model.sidebarSection !== 'mapping' && model.sidebarSection !== 'c4mapping') ||
        model.sidebarCollapsed
      )
        return { model };
      return {
        model: focusReceipt(
          model,
          review.side,
          resolveHistoryChangeStep(
            receiptComparison(review, review.side),
            review.focusedChange,
            input.direction,
            focusOptions(model),
          ),
        ),
      };
    }),
    Match.tag('ObservedReceiptInput', (input): Return<Model, Message> => {
      const review = model.receiptReview;
      if (!review || review.id !== input.id || review.side !== input.side) return { model };
      // SAFETY: only the detached canvas emits this input. The package adapter rejects non-navigation events.
      const event = input.message as EditorEvent;
      const next = updateHistoryReview(
        { editionId: String(review.id), editor: review.editor },
        event,
      );
      return next.editor === review.editor
        ? { model }
        : {
            model: {
              ...model,
              receiptReview: {
                ...review,
                editor: next.editor,
                focusedChange:
                  event.type === 'SurfaceMeasured' ||
                  event.type === 'FitViewAnimationFrame' ||
                  (next.editor.viewport === review.editor.viewport &&
                    next.editor.gesture.type === 'idle')
                    ? review.focusedChange
                    : null,
              },
            },
          };
    }),
    Match.orElse(() => ({ model })),
  );
}

function meaning(value: ZlozNode | ZlozEdge | null): string {
  if (!value) return 'Absent';
  const architecture = value.architecture;
  if (!architecture) return 'Untyped';
  return `${architecture.family} · ${architecture.role}${architecture.description ? ` · ${architecture.description}` : ''}`;
}
export function receiptReviewPanel<M>(model: Model, h: Html.H<M>, send: (message: Message) => M) {
  const review = model.receiptReview;
  const changes = review ? receiptComparison(review) : null;
  const steps = receiptChangeSteps(model);
  const sideReason = sideAvailability(model);
  const overviewReason = focusOptions(model).blockedReason;
  const navigation = {
    before: receiptChangeNavigation(model, 'before'),
    after: receiptChangeNavigation(model, 'after'),
  };
  const losses = review
    ? review.receipt.format === 'foldkit-zloz-c4-conversion'
      ? createEventStormingC4ConversionPlan(review.receipt.source, review.receipt.options)
          .disclosures
      : createEventStormingDddConversionPlan(review.receipt.source, review.receipt.mappings).preview
          .disclosures
    : [];
  return h.section
    .attr('aria-label', 'Portable receipt comparison')
    .class('receipt-review')
    .children(
      h.h3.children('Reopen a conversion receipt'),
      ...(review
        ? [
            h.p
              .attr('role', 'status')
              .attr('aria-label', 'Receipt model type')
              .children(
                review.receipt.format === 'foldkit-zloz-c4-conversion'
                  ? 'C4 conversion receipt · read-only'
                  : 'DDD conversion receipt · read-only',
              ),
          ]
        : []),
      h.label.class('workbench-field').children(
        'Open conversion receipt',
        h.input
          .key(`receipt-file:${model.receiptReadRun}`)
          .attr('type', 'file')
          .attr('accept', '.json,application/json')
          .attr('aria-label', 'Open conversion receipt')
          .value('')
          .on('change', ({ files }) => send(Message.ChoseConversionReceiptFiles({ files }))),
      ),
      h.p.children(
        'Read-only comparison. Validated data, not verified authorship; a receipt does not authorize editing.',
      ),
      ...(model.receiptRead
        ? [
            h.button
              .attr('type', 'button')
              .on('click', send(Message.ClickedCancelReceiptRead()))
              .children('Cancel receipt read'),
          ]
        : []),
      ...(review && changes
        ? [
            h.h4.children(review.receipt.source.document.name),
            h.details.children(
              h.summary.children('Source identifiers'),
              h.p.children(
                `Model: ${review.receipt.source.document.id} · Source session: ${review.receipt.source.sessionId} · Revision ${review.receipt.source.revision}`,
              ),
            ),
            h.p.children(
              `Ancestry: ${review.receipt.source.document.origin ? `${review.receipt.source.document.origin.modelName} · ${review.receipt.source.document.origin.edition.name}` : 'No recorded fork'} · ${review.receipt.source.document.editions.length} retained editions`,
            ),
            h.p.children(
              'Losses were accepted in the recorded conversion. That historical acknowledgement grants no consent here.',
            ),
            h.div
              .class('receipt-side-controls')
              .attr('aria-label', 'Receipt comparison side')
              .children(
                ...(['before', 'after'] as const).map((side) =>
                  h.button
                    .attr('type', 'button')
                    .attr('aria-pressed', review.side === side ? 'true' : 'false')
                    .disabled(sideReason !== null)
                    .attr('aria-describedby', sideReason ? 'receipt-navigation-reason' : undefined)
                    .on('click', send(Message.SelectedReceiptSide({ id: review.id, side })))
                    .children(side === 'before' ? 'Before conversion' : 'After conversion'),
                ),
                h.button
                  .attr('type', 'button')
                  .disabled(overviewReason !== null)
                  .attr(
                    'aria-describedby',
                    overviewReason ? 'receipt-navigation-reason' : undefined,
                  )
                  .on(
                    'click',
                    send(Message.ClickedReceiptOverview({ id: review.id, side: review.side })),
                  )
                  .children('Show receipt overview'),
                h.button
                  .attr('type', 'button')
                  .on('click', send(Message.ClickedCloseReceiptReview()))
                  .children('Return to working model'),
              ),
            ...(sideReason || overviewReason
              ? [h.p.id('receipt-navigation-reason').children(sideReason ?? overviewReason ?? '')]
              : []),
            h.details.children(
              h.summary.children('Recorded loss reasons'),
              h.ul.children(...losses.map((loss) => h.li.children(`${loss.id}: ${loss.reason}`))),
            ),
            h.h4.children('Recorded changes'),
            h.div
              .class('receipt-change-actions')
              .attr('role', 'group')
              .attr('aria-label', 'Receipt change navigation')
              .children(
                ...(['previous', 'next'] as const).map((direction) => {
                  const decision = steps[direction];
                  const reason =
                    decision.type === 'blocked'
                      ? decision.reason
                      : decision.type === 'ignored'
                        ? 'Choose an available change.'
                        : null;
                  return h.span.key(direction).children(
                    h.button
                      .attr('type', 'button')
                      .attr(
                        'aria-label',
                        direction === 'previous'
                          ? 'Previous receipt change'
                          : 'Next receipt change',
                      )
                      .disabled(decision.type !== 'ready')
                      .attr(
                        'aria-describedby',
                        reason ? `receipt-step-${direction}-reason` : undefined,
                      )
                      .on(
                        'click',
                        send(
                          Message.ClickedReceiptChangeStep({
                            reviewId: review.id,
                            side: review.side,
                            direction,
                            from: review.focusedChange,
                          }),
                        ),
                      )
                      .children(direction === 'previous' ? 'Previous change' : 'Next change'),
                    ...(reason
                      ? [h.p.id(`receipt-step-${direction}-reason`).children(reason)]
                      : []),
                  );
                }),
              ),
            h.p
              .id('receipt-change-position')
              .attr('aria-live', 'polite')
              .children(
                steps.position === null
                  ? `No change selected · ${steps.total} changes`
                  : `Change ${steps.position} of ${steps.total}`,
              ),

            h.p.children(
              'Focus a recorded change before or after conversion. Only the read-only receipt camera moves.',
            ),
            ...(navigation.before.reason
              ? [h.p.id('receipt-change-focus-reason').children(navigation.before.reason)]
              : []),
            h.ul.attr('aria-label', 'Receipt changes').children(
              ...[
                ...changes.nodes.map((change) => ({ entity: 'node' as const, change })),
                ...changes.edges.map((change) => ({ entity: 'edge' as const, change })),
              ].map(({ entity, change }) =>
                h.li
                  .key(`${entity}:${change.id}`)
                  .class(
                    review.focusedChange?.entity === entity && review.focusedChange.id === change.id
                      ? 'receipt-change receipt-change--focused'
                      : 'receipt-change',
                  )
                  .children(
                    h.strong.children(
                      `${entity === 'node' ? 'Node' : 'Connection'} · ${change.after?.label || change.before?.label || change.id}`,
                    ),
                    h.p.children(
                      `${change.id} · ${change.kind} · ${change.semanticChanged ? 'Meaning changed' : 'Meaning unchanged'} · ${change.layoutChanged ? 'Layout changed' : 'Layout unchanged'}`,
                    ),
                    h.p.children(`Before: ${meaning(change.before)}`),
                    h.p.children(`After: ${meaning(change.after)}`),
                    h.div.class('receipt-change-actions').children(
                      ...(['before', 'after'] as const).flatMap((side) => {
                        const entry = navigation[side].entries.find(
                          (item) => item.entity === entity && item.id === change.id,
                        );
                        return entry
                          ? [
                              h.span.key(side).children(
                                h.button
                                  .attr('type', 'button')
                                  .attr(
                                    'aria-label',
                                    `Focus ${entity === 'node' ? 'node' : 'connection'} ${entry.label} ${side} conversion`,
                                  )
                                  .attr(
                                    'aria-pressed',
                                    String(
                                      review.side === side &&
                                        review.focusedChange?.entity === entity &&
                                        review.focusedChange.id === change.id,
                                    ),
                                  )
                                  .disabled(entry.reason !== null)
                                  .attr('aria-description', entry.reason ? entry.reason : undefined)
                                  .attr('title', entry.reason ? entry.reason : undefined)
                                  .on(
                                    'click',
                                    send(
                                      Message.ClickedReceiptChange({
                                        reviewId: review.id,
                                        side,
                                        ...entry.request,
                                      }),
                                    ),
                                  )
                                  .children(side === 'before' ? 'Focus before' : 'Focus after'),
                              ),
                            ]
                          : [];
                      }),
                    ),
                  ),
              ),
            ),
          ]
        : []),
      ...(model.receiptReviewNotice
        ? [
            h.p
              .attr('role', 'status')
              .attr('aria-live', 'polite')
              .attr('aria-label', 'Receipt review feedback')
              .children(model.receiptReviewNotice),
          ]
        : []),
    );
}
const receiptBanner = architectureNativePanel<ReceiptReview['side']>(
  'ArchitectureReceiptBanner',
  Schema.is(Message.cases.ClickedCloseReceiptReview),
  (h, side, send) =>
    h.div
      .class('receipt-canvas-banner')
      .attr('role', 'status')
      .children(
        `Read-only receipt · ${side === 'before' ? 'Before conversion' : 'After conversion'} · Working model preserved`,
        h.button
          .attr('type', 'button')
          .on('click', send(Message.ClickedCloseReceiptReview()))
          .children('Close comparison'),
      ),
);

export function receiptReviewCanvas(model: Model, h: HtmlBuilder<Message>) {
  const review = model.receiptReview;
  if (!review) return h.div([], []);
  const onEvent = (message: EditorEvent) =>
    Message.ObservedReceiptInput({ id: review.id, side: review.side, message });
  const scheme =
    model.themePreference === 'system' ? model.systemColorScheme : model.themePreference;
  return h.div(
    [h.Key(`receipt:${review.id}:${review.side}`), h.Class('receipt-canvas')],
    [
      receiptBanner(h, review.side, 'architecture-effect-ui', 'receipt-banner'),
      nativeDetachedReview(
        h,
        {
          id: `receipt-${review.id}-${review.side}`,
          label: 'Read-only receipt diagram',
          editor: review.editor,
          scheme: scheme ?? 'light',
          onEvent,
        },
        'architecture-detached-review',
        `receipt-${review.id}-${review.side}`,
      ),
    ],
  );
}
