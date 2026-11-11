import {
  captureEdition,
  compareEditions,
  createModelEditor,
  createEventStormingDddConversionPlan,
  type ZlozNode,
  type ZlozEdge,
  parseEventStormingDddConversion,
  updateHistoryReview,
  type EditorEvent,
  type EditorState,
  type ZlozEventStormingDddConversion,
} from '@opsydyn/foldkit-zloz';
import {
  zlozView,
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
  receipt: ZlozEventStormingDddConversion;
  side: 'before' | 'after';
  editor: EditorState;
}>;
function preview(receipt: ZlozEventStormingDddConversion, side: ReceiptReview['side']) {
  const document = side === 'before' ? receipt.source.document : receipt.document;
  const zoom = document.snapshot.viewport?.zoom ?? 1;
  return createModelEditor(document, {
    readOnly: true,
    zoomLimits: { minZoom: Math.min(0.1, zoom), maxZoom: Math.max(4, zoom) },
  });
}
export function receiptComparison(review: ReceiptReview) {
  return compareEditions(
    captureEdition({
      id: 'receipt-before',
      name: 'Before conversion',
      snapshot: review.receipt.source.document.snapshot,
    }),
    captureEdition({
      id: 'receipt-after',
      name: 'After conversion',
      snapshot: review.receipt.document.snapshot,
    }),
  );
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
  'FailedConversionReceiptDownload',
]);
export function receiptAllowsMessage(message: Message) {
  return (
    allowed.has(message._tag) &&
    (message._tag !== 'SelectedWorkbenchSection' ||
      message.section === 'mapping' ||
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
  'ObservedReceiptInput',
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
      const decoded = Option.liftThrowable(parseEventStormingDddConversion)(input.json);
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
            editor: preview(receipt, 'after'),
          },
          sidebarSection: 'mapping',
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
      return {
        model: {
          ...model,
          receiptReview: {
            ...review,
            side: input.side,
            editor: preview(review.receipt, input.side),
          },
        },
      };
    }),
    Match.tag('ObservedReceiptInput', (input): Return<Model, Message> => {
      const review = model.receiptReview;
      if (!review || review.id !== input.id || review.side !== input.side) return { model };
      // SAFETY: only the detached zlozView emits this input. The package adapter rejects non-navigation events.
      const next = updateHistoryReview(
        { editionId: String(review.id), editor: review.editor },
        input.message as EditorEvent,
      );
      return next.editor === review.editor
        ? { model }
        : { model: { ...model, receiptReview: { ...review, editor: next.editor } } };
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
  const losses = review
    ? createEventStormingDddConversionPlan(review.receipt.source, review.receipt.mappings).preview
        .disclosures
    : [];
  return h.section(
    [h.AriaLabel('Portable receipt comparison'), h.Class('receipt-review')],
    [
      h.h3([], ['Reopen a conversion receipt']),
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
                      h.OnClick(Message.SelectedReceiptSide({ id: review.id, side })),
                    ],
                    [side === 'before' ? 'Before conversion' : 'After conversion'],
                  ),
                ),
                h.button(
                  [
                    h.Type('button'),
                    h.OnClick(
                      Message.ObservedReceiptInput({
                        id: review.id,
                        side: review.side,
                        message: { type: 'FitViewClicked' },
                      }),
                    ),
                  ],
                  ['Fit receipt diagram'],
                ),
                h.button(
                  [h.Type('button'), h.OnClick(Message.ClickedCloseReceiptReview())],
                  ['Return to working model'],
                ),
              ],
            ),
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
            h.ul(
              [h.AriaLabel('Receipt changes')],
              [
                ...changes.nodes.map((change) => ({ entity: 'Node', change })),
                ...changes.edges.map((change) => ({ entity: 'Connection', change })),
              ].map(({ entity, change }) =>
                h.li(
                  [h.Key(`${entity}:${change.id}`)],
                  [
                    h.strong(
                      [],
                      [`${entity} · ${change.after?.label || change.before?.label || change.id}`],
                    ),
                    h.p(
                      [],
                      [
                        `${change.id} · ${change.kind} · ${change.semanticChanged ? 'Meaning changed' : 'Meaning unchanged'} · ${change.layoutChanged ? 'Layout changed' : 'Layout unchanged'}`,
                      ],
                    ),
                    h.p([], [`Before: ${meaning(change.before)}`]),
                    h.p([], [`After: ${meaning(change.after)}`]),
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
