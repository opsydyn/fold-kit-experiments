import {
  applyPreviewLayout,
  startLabelMeasurement,
  updateLabelMeasurements,
  resolveLabelMeasurements,
  type ZlozLabelMeasurementResult,
  layoutRequest,
  serializeGraph,
  updateHistoryReview,
  type LayoutResult,
} from '@opsydyn/foldkit-zloz';
import { Match, Result } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';
import type { Return } from 'foldkit/update';

import { alchemyPreviewLabelSize } from './alchemy-labels';
import type { AlchemyReviewState } from './alchemy-state';
import { ArrangeAlchemyPreview } from './command';
import { Message } from './message';
import type { Model } from './model';
type Review = NonNullable<AlchemyReviewState['review']>;
export function cancelAlchemyLayout(review: Review | null): Review | null {
  return review && (review.layout.pending || review.layout.labels.measurement.type === 'pending')
    ? {
        ...review,
        layout: {
          ...review.layout,
          pending: null,
          labels: { ...review.layout.labels, measurement: { type: 'idle' } },
        },
      }
    : review;
}
export function alchemyLayoutReason(model: Model): string | null {
  const review = model.alchemyReview.review;
  return !review
    ? 'Open a descriptor review first.'
    : model.sidebarCollapsed || model.sidebarSection !== 'alchemy'
      ? 'Show Domain review to arrange its preview.'
      : model.alchemyReview.pending
        ? 'Finish or cancel the descriptor read first.'
        : !review.editor.readOnly
          ? 'Layout requires a read-only preview.'
          : !review.editor.surface
            ? 'Waiting for the preview measurement.'
            : review.editor.gesture.type !== 'idle'
              ? 'Finish the preview gesture first.'
              : null;
}
export function alchemyLabelRenderKey(model: Model): string {
  const labels = model.alchemyReview.review?.layout.labels;
  const scheme =
    model.themePreference === 'system' || model.themePreference === null
      ? model.systemColorScheme
      : model.themePreference;
  return `alchemy-badge:${labels?.mode}:${labels?.detail}:${scheme}`;
}
export function alchemyLabelContext(model: Model) {
  const review = model.alchemyReview.review;
  if (!review) return { type: 'unavailable' as const, reason: 'Open a descriptor review first.' };
  const key = alchemyLabelRenderKey(model),
    measurement = review.layout.labels.measurement;
  const context = resolveLabelMeasurements(review.editor, measurement, key);
  return context.type === 'unavailable' &&
    measurement.type === 'ready' &&
    measurement.request.renderKey === key &&
    review.layout.displayed === 'elk' &&
    review.editor.revision === measurement.request.revision + 1
    ? {
        type: 'unavailable' as const,
        reason: 'Measured label bounds applied. Measure again before arranging.',
      }
    : context;
}
const tags = new Set([
  'SelectedAlchemyLabelMode',
  'SelectedAlchemyLabelDetail',
  'ClickedMeasureAlchemyLabels',
  'ClickedCancelAlchemyLabels',
  'ObservedAlchemyLabels',
  'SelectedAlchemyLayoutDirection',
  'ClickedAlchemyLayout',
  'ClickedCancelAlchemyLayout',
  'ClickedRestoreAlchemyLayout',
  'SucceededAlchemyLayout',
  'FailedAlchemyLayout',
]);
export const isAlchemyLayoutMessage = (message: Message) => tags.has(message._tag);
export function updateAlchemyLayout(model: Model, message: Message): Return<Model, Message> {
  const state = model.alchemyReview,
    review = state.review;
  if (!review || !('id' in message) || message.id !== review.id) return { model };
  const write = (next: Review, notice = state.notice): Return<Model, Message> => ({
    model: { ...model, alchemyReview: { ...state, review: next, notice } },
  });
  const finish = (
    editor: Review['editor'],
    displayed: 'elk' | 'original',
    run = review.layout.run,
  ) =>
    write(
      {
        ...review,
        editor: updateHistoryReview(
          { editionId: String(review.id), editor },
          { type: 'FitViewClicked' },
        ).editor,
        layout: { ...review.layout, run, pending: null, displayed },
      },
      displayed === 'elk'
        ? 'ELK preview layout applied. Source identity, findings and working model preserved.'
        : 'Original preview geometry restored. Source identity and working model preserved.',
    );
  return Match.value(message).pipe(
    Match.tag('SelectedAlchemyLabelMode', ({ mode }) =>
      write({
        ...review,
        layout: {
          ...review.layout,
          pending: null,
          labels: { ...review.layout.labels, mode, measurement: { type: 'idle' } },
        },
      }),
    ),
    Match.tag('SelectedAlchemyLabelDetail', ({ detail }) =>
      write({
        ...review,
        layout: {
          ...review.layout,
          pending: null,
          labels: { ...review.layout.labels, detail, measurement: { type: 'idle' } },
        },
      }),
    ),
    Match.tag('ClickedCancelAlchemyLabels', () =>
      write(
        {
          ...review,
          layout: {
            ...review.layout,
            labels: { ...review.layout.labels, measurement: { type: 'idle' } },
          },
        },
        'Label measurement cancelled. Previous preview preserved.',
      ),
    ),
    Match.tag('ClickedMeasureAlchemyLabels', () => {
      const reason = alchemyLayoutReason(model);
      if (reason || review.layout.pending || review.layout.labels.mode !== 'measured')
        return write(review, reason ?? 'Choose measured labels and finish layout first.');
      const run = review.layout.labels.run + 1;
      return write(
        {
          ...review,
          layout: {
            ...review.layout,
            labels: {
              ...review.layout.labels,
              run,
              measurement: startLabelMeasurement(
                review.editor,
                `alchemy:${review.id}:labels:${run}`,
                alchemyLabelRenderKey(model),
              ),
            },
          },
        },
        'Measuring rendered labels…',
      );
    }),
    Match.tag('ObservedAlchemyLabels', ({ result: raw }) => {
      // SAFETY: the package Mount emits the typed measurement result; core validates the full batch and freshness.
      const measurement = updateLabelMeasurements(
        review.editor,
        review.layout.labels.measurement,
        alchemyLabelRenderKey(model),
        raw as ZlozLabelMeasurementResult,
      );
      if (measurement === review.layout.labels.measurement) return { model };
      return write(
        {
          ...review,
          layout: { ...review.layout, labels: { ...review.layout.labels, measurement } },
        },
        measurement.type === 'ready'
          ? 'Rendered label bounds ready. Arrange explicitly to apply.'
          : measurement.type === 'failed'
            ? measurement.reason
            : 'Measurement pending.',
      );
    }),
    Match.tag('SelectedAlchemyLayoutDirection', ({ direction }) =>
      review.layout.pending
        ? { model }
        : write({ ...review, layout: { ...review.layout, direction } }),
    ),
    Match.tag('ClickedAlchemyLayout', (): Return<Model, Message> => {
      const reason = alchemyLayoutReason(model);
      if (reason) return write(review, reason);
      if (review.layout.pending) return { model };
      const measured = alchemyLabelContext(model);
      if (review.layout.labels.mode === 'measured' && measured.type !== 'ready')
        return write(review, measured.reason);
      const run = review.layout.run + 1,
        active = layoutRequest(review.editor, `alchemy:${review.id}:layout:${run}`, {
          edgeLabels:
            review.layout.labels.mode === 'measured' && measured.type === 'ready'
              ? measured.edgeLabels
              : review.editor.graph.edges.map((edge) => ({
                  id: edge.id,
                  size: alchemyPreviewLabelSize,
                })),
        });
      return {
        model: {
          ...model,
          alchemyReview: {
            ...state,
            review: { ...review, layout: { ...review.layout, run, pending: active } },
            notice: 'Arranging preview with ELK… Cancel or navigate to keep the current preview.',
          },
        },
        commands: [
          ArrangeAlchemyPreview({
            id: review.id,
            requestId: active.requestId,
            revision: active.revision,
            json: serializeGraph(active.graph),
            labels: JSON.stringify(active.edgeLabels ?? []),
            direction: review.layout.direction,
          }),
        ],
      };
    }),
    Match.tag('ClickedCancelAlchemyLayout', () =>
      write(
        { ...review, layout: { ...review.layout, pending: null } },
        'Preview layout cancelled. Previous preview preserved.',
      ),
    ),
    Match.tag('ClickedRestoreAlchemyLayout', () => {
      const reason = alchemyLayoutReason(model);
      if (reason) return write(review, reason);
      const run = review.layout.run + 1,
        active = layoutRequest(review.editor, `alchemy:${review.id}:restore:${run}`);
      const result: LayoutResult = {
        requestId: active.requestId,
        revision: active.revision,
        positions: review.projection.graph.nodes.map((n) => {
          const position = { id: n.id, x: n.position.x, y: n.position.y };
          return n.kind === 'group' ? { ...position, size: n.size } : position;
        }),
        routes: [],
      };
      return Result.match(
        Result.try(() => applyPreviewLayout(review.editor, active, result)),
        {
          onSuccess: (editor) => finish(editor, 'original', run),
          onFailure: () =>
            write(
              { ...review, layout: { ...review.layout, pending: null } },
              'Could not restore preview geometry. Previous preview preserved.',
            ),
        },
      );
    }),
    Match.tag('SucceededAlchemyLayout', ({ result: raw }) => {
      // SAFETY: ArrangeAlchemyPreview emits the existing typed ELK LayoutResult; core validates all geometry before publication.
      const result = raw as LayoutResult,
        active = review.layout.pending;
      if (!active || active.requestId !== result.requestId) return { model };
      if (review.layout.labels.mode === 'measured' && alchemyLabelContext(model).type !== 'ready')
        return write(
          { ...review, layout: { ...review.layout, pending: null } },
          'Renderer changed; layout result discarded. Measure labels again.',
        );
      return Result.match(
        Result.try(() => applyPreviewLayout(review.editor, active, result)),
        {
          onSuccess: (editor) =>
            editor === review.editor
              ? write(
                  { ...review, layout: { ...review.layout, pending: null } },
                  'Preview changed; layout result discarded. Previous preview preserved.',
                )
              : finish(editor, 'elk'),
          onFailure: () =>
            write(
              { ...review, layout: { ...review.layout, pending: null } },
              'Could not arrange preview. Previous preview preserved.',
            ),
        },
      );
    }),
    Match.tag('FailedAlchemyLayout', ({ requestId }) =>
      review.layout.pending?.requestId === requestId
        ? write(
            { ...review, layout: { ...review.layout, pending: null } },
            'Could not arrange preview. Previous preview preserved.',
          )
        : { model },
    ),
    Match.orElse(() => ({ model })),
  );
}
export function alchemyLayoutControls(model: Model, h: HtmlBuilder<Message>) {
  const review = model.alchemyReview.review;
  if (!review) return h.div([], []);
  const { layout } = review,
    reason = alchemyLayoutReason(model),
    measured = alchemyLabelContext(model),
    measuring = measured.type === 'pending',
    labelReason =
      layout.labels.mode === 'measured' && measured.type !== 'ready' ? measured.reason : null;
  return h.section(
    [h.AriaLabel('Descriptor preview layout'), h.Class('alchemy-layout-controls')],
    [
      h.h3([], ['Preview layout']),
      h.p(
        [],
        ['ELK is opt-in. Arrange only this preview; source identity and findings stay unchanged.'],
      ),
      h.label(
        [],
        [
          'Label sizing',
          h.select(
            [
              h.AriaLabel('Label sizing'),
              h.Value(layout.labels.mode),
              h.OnChange((mode) =>
                Message.SelectedAlchemyLabelMode({
                  id: review.id,
                  mode: mode === 'measured' ? 'measured' : 'declared',
                }),
              ),
            ],
            [
              h.option([h.Value('declared')], ['Declared bounds']),
              h.option([h.Value('measured')], ['Measure rendered badges']),
            ],
          ),
        ],
      ),
      ...(layout.labels.mode === 'measured'
        ? [
            h.label(
              [],
              [
                'Badge detail',
                h.select(
                  [
                    h.AriaLabel('Badge detail'),
                    h.Value(layout.labels.detail),
                    h.OnChange((detail) =>
                      Message.SelectedAlchemyLabelDetail({
                        id: review.id,
                        detail: detail === 'expanded' ? 'expanded' : 'compact',
                      }),
                    ),
                  ],
                  [
                    h.option([h.Value('compact')], ['Compact']),
                    h.option([h.Value('expanded')], ['Expanded source badges']),
                  ],
                ),
              ],
            ),
            h.button(
              [
                h.Key('alchemy-measure-action'),
                h.Type('button'),
                h.Disabled(!measuring && (reason !== null || layout.pending !== null)),
                h.OnClick(
                  measuring
                    ? Message.ClickedCancelAlchemyLabels({ id: review.id })
                    : Message.ClickedMeasureAlchemyLabels({ id: review.id }),
                ),
              ],
              [measuring ? 'Cancel label measurement' : 'Measure label bounds'],
            ),
            h.p(
              [h.AriaLabel('Label measurement status'), h.Role('status')],
              [
                measured.type === 'ready'
                  ? `Measured ${measured.edgeLabels.length} rendered labels. Arrange to apply.`
                  : measured.reason,
              ],
            ),
          ]
        : []),
      h.label(
        [],
        [
          'Layout direction',
          h.select(
            [
              h.Value(layout.direction),
              h.Disabled(reason !== null || layout.pending !== null),
              h.OnChange((direction) =>
                Message.SelectedAlchemyLayoutDirection({
                  id: review.id,
                  direction: direction === 'DOWN' ? 'DOWN' : 'RIGHT',
                }),
              ),
            ],
            [
              h.option([h.Value('RIGHT')], ['Left to right']),
              h.option([h.Value('DOWN')], ['Top to bottom']),
            ],
          ),
        ],
      ),
      h.button(
        [
          h.Key('alchemy-layout-action'),
          h.Type('button'),
          h.Disabled(layout.pending === null && reason !== null),
          h.AriaDisabled(layout.pending === null && labelReason !== null),
          ...(labelReason ? [h.AriaDescription(labelReason)] : []),
          h.OnClick(
            layout.pending
              ? Message.ClickedCancelAlchemyLayout({ id: review.id })
              : Message.ClickedAlchemyLayout({ id: review.id }),
          ),
        ],
        [layout.pending ? 'Cancel preview layout' : 'Arrange preview with ELK'],
      ),
      h.button(
        [
          h.Type('button'),
          h.Disabled(
            reason !== null || (layout.displayed === 'original' && layout.pending === null),
          ),
          h.OnClick(Message.ClickedRestoreAlchemyLayout({ id: review.id })),
        ],
        ['Restore original preview'],
      ),
      h.p(
        [h.AriaLabel('Preview layout mode')],
        [layout.displayed === 'elk' ? 'ELK preview geometry' : 'Original descriptor geometry'],
      ),
      ...(reason ? [h.p([], [reason])] : []),
    ],
  );
}
