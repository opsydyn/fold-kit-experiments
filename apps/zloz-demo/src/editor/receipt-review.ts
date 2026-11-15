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
import {
  zlozView,
  zlozHistoryChangeButton,
  zlozC4Node,
  zlozDddNode,
  zlozEventStormingNode,
  zlozC4Group,
  zlozDddGroup,
} from '@opsydyn/foldkit-zloz/foldkit';
import { Match, Option } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';
import type { Return } from 'foldkit/update';

import { ReadConversionReceipt } from './command';
import { editionArchiveByteLimit } from './history';
import { Message } from './message';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { workbenchThemes } from './theme';

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
        commands: [ReadConversionReceipt({ id, file })],
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
      // SAFETY: only the detached zlozView emits this input. The package adapter rejects non-navigation events.
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
export function receiptReviewPanel(model: Model, h: HtmlBuilder<Message>) {
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
  return h.section(
    [h.AriaLabel('Portable receipt comparison'), h.Class('receipt-review')],
    [
      h.h3([], ['Reopen a conversion receipt']),
      ...(review
        ? [
            h.p(
              [h.Role('status'), h.AriaLabel('Receipt model type')],
              [
                review.receipt.format === 'foldkit-zloz-c4-conversion'
                  ? 'C4 conversion receipt · read-only'
                  : 'DDD conversion receipt · read-only',
              ],
            ),
          ]
        : []),
      h.label(
        [h.Class('workbench-field')],
        [
          'Open conversion receipt',
          h.input([
            h.Key(`receipt-file:${model.receiptReadRun}`),
            h.Type('file'),
            h.Accept('.json,application/json'),
            h.AriaLabel('Open conversion receipt'),
            h.OnFileChange((files) => Message.ChoseConversionReceiptFiles({ files })),
          ]),
        ],
      ),
      h.p(
        [],
        [
          'Read-only comparison. Validated data, not verified authorship; a receipt does not authorize editing.',
        ],
      ),
      ...(model.receiptRead
        ? [
            h.button(
              [h.Type('button'), h.OnClick(Message.ClickedCancelReceiptRead())],
              ['Cancel receipt read'],
            ),
          ]
        : []),
      ...(review && changes
        ? [
            h.h4([], [review.receipt.source.document.name]),
            h.details(
              [],
              [
                h.summary([], ['Source identifiers']),
                h.p(
                  [],
                  [
                    `Model: ${review.receipt.source.document.id} · Source session: ${review.receipt.source.sessionId} · Revision ${review.receipt.source.revision}`,
                  ],
                ),
              ],
            ),
            h.p(
              [],
              [
                `Ancestry: ${review.receipt.source.document.origin ? `${review.receipt.source.document.origin.modelName} · ${review.receipt.source.document.origin.edition.name}` : 'No recorded fork'} · ${review.receipt.source.document.editions.length} retained editions`,
              ],
            ),
            h.p(
              [],
              [
                'Losses were accepted in the recorded conversion. That historical acknowledgement grants no consent here.',
              ],
            ),
            h.div(
              [h.Class('receipt-side-controls'), h.AriaLabel('Receipt comparison side')],
              [
                ...(['before', 'after'] as const).map((side) =>
                  h.button(
                    [
                      h.Type('button'),
                      h.AriaPressed(review.side === side ? 'true' : 'false'),
                      h.Disabled(sideReason !== null),
                      ...(sideReason ? [h.AriaDescribedBy('receipt-navigation-reason')] : []),
                      h.OnClick(Message.SelectedReceiptSide({ id: review.id, side })),
                    ],
                    [side === 'before' ? 'Before conversion' : 'After conversion'],
                  ),
                ),
                h.button(
                  [
                    h.Type('button'),
                    h.Disabled(overviewReason !== null),
                    ...(overviewReason ? [h.AriaDescribedBy('receipt-navigation-reason')] : []),
                    h.OnClick(Message.ClickedReceiptOverview({ id: review.id, side: review.side })),
                  ],
                  ['Show receipt overview'],
                ),
                h.button(
                  [h.Type('button'), h.OnClick(Message.ClickedCloseReceiptReview())],
                  ['Return to working model'],
                ),
              ],
            ),
            ...(sideReason || overviewReason
              ? [h.p([h.Id('receipt-navigation-reason')], [sideReason ?? overviewReason ?? ''])]
              : []),
            h.details(
              [],
              [
                h.summary([], ['Recorded loss reasons']),
                h.ul(
                  [],
                  losses.map((loss) =>
                    h.li([h.Key(`${loss.kind}:${loss.id}`)], [`${loss.id}: ${loss.reason}`]),
                  ),
                ),
              ],
            ),
            h.h4([], ['Recorded changes']),
            h.div(
              [
                h.Class('receipt-change-actions'),
                h.Role('group'),
                h.AriaLabel('Receipt change navigation'),
              ],
              (['previous', 'next'] as const).map((direction) => {
                const decision = steps[direction];
                const reason =
                  decision.type === 'blocked'
                    ? decision.reason
                    : decision.type === 'ignored'
                      ? 'Choose an available change.'
                      : null;
                return h.span(
                  [h.Key(direction)],
                  [
                    h.button(
                      [
                        h.Type('button'),
                        h.AriaLabel(
                          direction === 'previous'
                            ? 'Previous receipt change'
                            : 'Next receipt change',
                        ),
                        h.Disabled(decision.type !== 'ready'),
                        ...(reason ? [h.AriaDescribedBy(`receipt-step-${direction}-reason`)] : []),
                        h.OnClick(
                          Message.ClickedReceiptChangeStep({
                            reviewId: review.id,
                            side: review.side,
                            direction,
                            from: review.focusedChange,
                          }),
                        ),
                      ],
                      [direction === 'previous' ? 'Previous change' : 'Next change'],
                    ),
                    ...(reason ? [h.p([h.Id(`receipt-step-${direction}-reason`)], [reason])] : []),
                  ],
                );
              }),
            ),
            h.p(
              [h.Id('receipt-change-position'), h.AriaLive('polite')],
              [
                steps.position === null
                  ? `No change selected · ${steps.total} changes`
                  : `Change ${steps.position} of ${steps.total}`,
              ],
            ),

            h.p(
              [],
              [
                'Focus a recorded change before or after conversion. Only the read-only receipt camera moves.',
              ],
            ),
            ...(navigation.before.reason
              ? [h.p([h.Id('receipt-change-focus-reason')], [navigation.before.reason])]
              : []),
            h.ul(
              [h.AriaLabel('Receipt changes')],
              [
                ...changes.nodes.map((change) => ({ entity: 'node' as const, change })),
                ...changes.edges.map((change) => ({ entity: 'edge' as const, change })),
              ].map(({ entity, change }) =>
                h.li(
                  [
                    h.Key(`${entity}:${change.id}`),
                    h.Class(
                      review.focusedChange?.entity === entity &&
                        review.focusedChange.id === change.id
                        ? 'receipt-change receipt-change--focused'
                        : 'receipt-change',
                    ),
                  ],
                  [
                    h.strong(
                      [],
                      [
                        `${entity === 'node' ? 'Node' : 'Connection'} · ${change.after?.label || change.before?.label || change.id}`,
                      ],
                    ),
                    h.p(
                      [],
                      [
                        `${change.id} · ${change.kind} · ${change.semanticChanged ? 'Meaning changed' : 'Meaning unchanged'} · ${change.layoutChanged ? 'Layout changed' : 'Layout unchanged'}`,
                      ],
                    ),
                    h.p([], [`Before: ${meaning(change.before)}`]),
                    h.p([], [`After: ${meaning(change.after)}`]),
                    h.div(
                      [h.Class('receipt-change-actions')],
                      (['before', 'after'] as const).flatMap((side) => {
                        const entry = navigation[side].entries.find(
                          (item) => item.entity === entity && item.id === change.id,
                        );
                        return entry
                          ? [
                              h.span(
                                [h.Key(side)],
                                [
                                  zlozHistoryChangeButton(
                                    h,
                                    entry,
                                    (request) =>
                                      Message.ClickedReceiptChange({
                                        reviewId: review.id,
                                        side,
                                        ...request,
                                      }),
                                    [
                                      h.AriaPressed(
                                        review.side === side &&
                                          review.focusedChange?.entity === entity &&
                                          review.focusedChange.id === change.id
                                          ? 'true'
                                          : 'false',
                                      ),
                                    ],
                                    [side === 'before' ? 'Focus before' : 'Focus after'],
                                    {
                                      label: `Focus ${entity === 'node' ? 'node' : 'connection'} ${entry.label} ${side} conversion`,
                                    },
                                  ),
                                ],
                              ),
                            ]
                          : [];
                      }),
                    ),
                  ],
                ),
              ),
            ),
          ]
        : []),
      ...(model.receiptReviewNotice
        ? [
            h.p(
              [h.Role('status'), h.AriaLive('polite'), h.AriaLabel('Receipt review feedback')],
              [model.receiptReviewNotice],
            ),
          ]
        : []),
    ],
  );
}
export function receiptReviewCanvas(model: Model, h: HtmlBuilder<Message>) {
  const review = model.receiptReview;
  if (!review) return h.div([], []);
  const scheme =
    model.themePreference === 'system' ? model.systemColorScheme : model.themePreference;
  return h.div(
    [h.Key(`receipt:${review.id}:${review.side}`), h.Class('receipt-canvas')],
    [
      h.div(
        [h.Class('receipt-canvas-banner'), h.Role('status')],
        [
          `Read-only receipt · ${review.side === 'before' ? 'Before conversion' : 'After conversion'} · Working model preserved`,
          h.button(
            [h.Type('button'), h.OnClick(Message.ClickedCloseReceiptReview())],
            ['Close comparison'],
          ),
        ],
      ),
      zlozView(h, review.editor, {
        id: `receipt-${review.id}-${review.side}`,
        label: 'Read-only receipt diagram',
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
        onEvent: (message) =>
          Message.ObservedReceiptInput({ id: review.id, side: review.side, message }),
      }),
    ],
  );
}
