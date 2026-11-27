import type { Html } from '@effect/ui/html';
import { createEditor, updateHistoryReview, type EditorEvent } from '@opsydyn/foldkit-zloz';
import {
  resolveAlchemyFindingNavigator,
  resolveAlchemyFindingReveal,
} from '@opsydyn/foldkit-zloz-alchemy';
import { Match } from 'effect';

import example from './alchemy-example.json';
import {
  alchemyLayoutControls,
  alchemyLabelContext,
  alchemyHeadingContext,
  cancelAlchemyLayout,
  isAlchemyLayoutMessage,
  updateAlchemyLayout,
} from './alchemy-layout';
import type { AlchemyReviewState } from './alchemy-state';
import { alchemyTextLimits, decodeAlchemyText } from './alchemy-text';
import { ReadAlchemyDescriptor } from './command';
import { Message } from './message';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { nativeAlchemyCanvas } from './native-alchemy';
import { architectureNativePanel } from './native-panel';
import type { Return } from './transition';
const own = new Set([
  'ChangedAlchemyText',
  'ClickedAlchemyReview',
  'ClickedAlchemyFinding',
  'ClickedAlchemyExample',
  'ChoseAlchemyFiles',
  'SucceededAlchemyRead',
  'FailedAlchemyRead',
  'ClickedCancelAlchemyRead',
  'ClickedCloseAlchemyReview',
  'ObservedAlchemyInput',
]);
export const isAlchemyMessage = (message: Message) =>
  own.has(message._tag) || isAlchemyLayoutMessage(message);
const common = new Set([
  'SelectedThemePreference',
  'ChangedSystemColorScheme',
  'LoadedThemePreference',
  'CompletedColorSchemeSave',
  'FailedColorSchemeSave',
  'ClickedWorkbenchSidebar',
  'ClickedMinimalMode',
  'ClickedDiagnosticsPanel',
  'ClickedDiagnosticsEnabled',
  'ClickedDiagnostic',
  'CompletedSvgDownload',
  'FailedSvgDownload',
  'CompletedConversionReceiptDownload',
  'FailedConversionReceiptDownload',
]);
export function alchemyAllowsMessage(message: Message) {
  return (
    isAlchemyMessage(message) ||
    isAlchemyLayoutMessage(message) ||
    common.has(message._tag) ||
    (message._tag === 'SelectedWorkbenchSection' &&
      (message.section === 'alchemy' || message.section === 'diagnostics'))
  );
}
function openReason(model: Model, requirePanel = true): string | null {
  return requirePanel && (model.sidebarSection !== 'alchemy' || model.sidebarCollapsed)
    ? 'Show Domain review before reviewing a descriptor.'
    : modelSessionBusy(model) ||
        model.placement.type !== 'idle' ||
        model.receiptRead ||
        model.packetReader.pending ||
        model.patchWorkbench.pending ||
        model.historyReview ||
        model.historyPlayback?.cursor.status === 'playing' ||
        model.pngReview.rendering.type === 'pending'
      ? 'Finish active edits, reads or renders and return to the working model before reviewing a descriptor.'
      : null;
}
function publish(model: Model, text: string): Model {
  const state = model.alchemyReview,
    result = decodeAlchemyText(text),
    run = state.run + 1;
  return {
    ...model,
    alchemyReview:
      result.type === 'blocked'
        ? {
            ...state,
            text,
            run,
            pending: null,
            review: cancelAlchemyLayout(state.review),
            notice: `Rejected: ${result.findings.map((f) => f.reason).join(' ')} Previous review and working model preserved.`,
          }
        : {
            ...state,
            text,
            run,
            pending: null,
            review: {
              id: run,
              projection: result,
              editor: createEditor(result.graph, { readOnly: true }),
              layout: {
                run: 0,
                direction: 'RIGHT',
                displayed: 'original',
                header: 'default',
                heading: { detail: 'summary', run: 0, measurement: { type: 'idle' } },
                pending: null,
                labels: {
                  mode: 'declared',
                  detail: 'compact',
                  run: 0,
                  measurement: { type: 'idle' },
                },
              },
            },
            notice: 'Read-only descriptor review opened. Working model and Undo preserved.',
          },
  };
}
function matches(model: Model, run: number) {
  const pending = model.alchemyReview.pending;
  return (
    pending?.run === run &&
    pending.modelId === model.modelIdentity.id &&
    pending.epoch === model.modelEpoch
  );
}
function findingOptions(model: Model) {
  return {
    scope: `alchemy:${model.alchemyReview.review?.id ?? 'none'}`,
    blockedReason: model.alchemyReview.review?.layout.pending
      ? 'Finish or cancel the preview layout before revealing findings.'
      : model.alchemyReview.pending
        ? 'Finish or cancel the descriptor read before revealing findings.'
        : model.sidebarCollapsed || model.sidebarSection !== 'alchemy'
          ? 'Show Domain review before revealing a finding.'
          : null,
  };
}
export function workbenchAlchemyFindings(model: Model) {
  const review = model.alchemyReview.review;
  return review
    ? resolveAlchemyFindingNavigator(review.projection, review.editor, findingOptions(model))
    : null;
}
export function updateAlchemyReview(model: Model, message: Message): Return<Model, Message> {
  if (isAlchemyLayoutMessage(message)) return updateAlchemyLayout(model, message);
  const state = model.alchemyReview;
  const write = (next: AlchemyReviewState): Return<Model, Message> => ({
    model: { ...model, alchemyReview: next },
  });
  return Match.value(message).pipe(
    Match.tag('ChangedAlchemyText', ({ text }) =>
      text.length > alchemyTextLimits.maxBytes ||
      new TextEncoder().encode(text).byteLength > alchemyTextLimits.maxBytes
        ? write({
            ...state,
            run: state.run + 1,
            pending: null,
            review: cancelAlchemyLayout(state.review),
            notice:
              'Rejected: descriptor exceeds 1 MiB of UTF-8 text. Previous draft and review preserved.',
          })
        : write({
            ...state,
            text,
            run: state.run + 1,
            pending: null,
            review: cancelAlchemyLayout(state.review),
            notice: 'Draft changed. Choose Review descriptor to replace the preview.',
          }),
    ),
    Match.tag('ClickedAlchemyFinding', ({ id, request }) => {
      const review = state.review;
      if (!review || review.id !== id) return { model };
      const decision = resolveAlchemyFindingReveal(
        review.projection,
        review.editor,
        request,
        findingOptions(model),
      );
      if (decision.type === 'blocked') return write({ ...state, notice: decision.reason });
      let next = { editionId: String(id), editor: review.editor };
      for (const event of decision.events) next = updateHistoryReview(next, event);
      return write({
        ...state,
        review: { ...review, editor: next.editor },
        notice: `Revealed ${decision.label}. Working model and Undo preserved.`,
      });
    }),
    Match.tag('ClickedAlchemyReview', () => {
      const reason = openReason(model);
      return reason ? write({ ...state, notice: reason }) : { model: publish(model, state.text) };
    }),
    Match.tag('ClickedAlchemyExample', () => {
      const reason = openReason(model);
      return reason
        ? write({ ...state, notice: reason })
        : { model: publish(model, JSON.stringify(example, null, 2)) };
    }),
    Match.tag('ChoseAlchemyFiles', ({ files }): Return<Model, Message> => {
      if (!files.length) return { model };
      const reason = openReason(model);
      if (reason) return write({ ...state, notice: reason });
      const file = files[0],
        run = state.run + 1;
      if (files.length !== 1 || !file || file.size > alchemyTextLimits.maxBytes)
        return write({
          ...state,
          run,
          pending: null,
          review: cancelAlchemyLayout(state.review),
          notice:
            'Rejected: choose one UTF-8 JSON descriptor, at most 1 MiB. Previous review preserved.',
        });
      return {
        model: {
          ...model,
          alchemyReview: {
            ...state,
            run,
            pending: { run, modelId: model.modelIdentity.id, epoch: model.modelEpoch },
            review: cancelAlchemyLayout(state.review),
            notice: 'Reading descriptor for read-only review…',
          },
        },
        commands: [ReadAlchemyDescriptor.make({ run, file })],
      };
    }),
    Match.tag('SucceededAlchemyRead', ({ run, json }) =>
      !matches(model, run)
        ? { model }
        : openReason(model, false)
          ? write({
              ...state,
              pending: null,
              notice: 'Rejected: working context is busy. Reopen the descriptor.',
            })
          : { model: publish(model, json) },
    ),
    Match.tag('FailedAlchemyRead', ({ run }) =>
      matches(model, run)
        ? write({
            ...state,
            pending: null,
            notice: 'Rejected: could not read UTF-8 JSON within 1 MiB. Previous review preserved.',
          })
        : { model },
    ),
    Match.tag('ClickedCancelAlchemyRead', () =>
      write({
        ...state,
        run: state.run + 1,
        pending: null,
        notice: 'Read cancelled. Previous review and working model preserved.',
      }),
    ),
    Match.tag('ClickedCloseAlchemyReview', () =>
      write({
        ...state,
        run: state.run + 1,
        pending: null,
        review: null,
        notice: 'Review closed. Working model and Undo history preserved.',
      }),
    ),
    Match.tag('ObservedAlchemyInput', ({ id, message: raw }) => {
      const review = state.review;
      if (!review || review.id !== id) return { model };
      // SAFETY: only the detached typed view emits this message; the core history-review reducer admits navigation only.
      const event = raw as EditorEvent;
      let next = updateHistoryReview({ editionId: String(id), editor: review.editor }, event);
      if (event.type === 'SurfaceMeasured' && review.editor.surface === null)
        next = updateHistoryReview(next, { type: 'FitViewClicked' });
      return next.editor === review.editor
        ? { model }
        : write({
            ...state,
            review: {
              ...review,
              editor: next.editor,
              layout:
                review.layout.pending && event.type !== 'SurfaceMeasured'
                  ? { ...review.layout, pending: null }
                  : review.layout,
            },
            notice:
              review.layout.pending && event.type !== 'SurfaceMeasured'
                ? 'Preview navigation cancelled the pending layout. Previous geometry preserved.'
                : state.notice,
          });
    }),
    Match.orElse(() => ({ model })),
  );
}
function renderAlchemyReview<M>(h: Html.H<M>, model: Model, send: (message: Message) => M) {
  const state = model.alchemyReview,
    review = state.review,
    reason = openReason(model),
    navigator = workbenchAlchemyFindings(model);
  return h.div.class('alchemy-review').children(
    h.p.children(
      'Review portable Domain declarations without importing a working model. No SDK, TypeScript, handlers or providers are loaded by this view.',
    ),
    h.p
      .id('alchemy-input-help')
      .children('UTF-8 JSON · 1 MiB · depth 16 · 16,384 values. Duplicate keys are rejected.'),
    h.label.children(
      'Descriptor JSON',
      h.textarea
        .value(state.text)
        .attr('rows', '7')
        .attr('aria-label', 'Descriptor JSON')
        .attr('aria-describedby', 'alchemy-input-help')
        .on('input', ({ value: text }) => send(Message.ChangedAlchemyText({ text }))),
    ),
    h.label.children(
      'Open descriptor file',
      h.input
        .key(`alchemy-file:${state.run}`)
        .attr('type', 'file')
        .attr('accept', '.json,application/json')
        .attr('aria-label', 'Open descriptor file')
        .disabled(reason !== null)
        .value('')
        .on('change', ({ files }) => send(Message.ChoseAlchemyFiles({ files }))),
    ),
    h.div.class('alchemy-actions').children(
      h.button
        .attr('type', 'button')
        .disabled(reason !== null || !!state.pending || !state.text.trim())
        .on('click', send(Message.ClickedAlchemyReview()))
        .children('Review descriptor'),
      h.button
        .attr('type', 'button')
        .disabled(reason !== null || !!state.pending)
        .on('click', send(Message.ClickedAlchemyExample()))
        .children('Review bank example'),
    ),
    ...(reason ? [h.p.children(reason)] : []),
    ...(state.pending
      ? [
          h.button
            .attr('type', 'button')
            .on('click', send(Message.ClickedCancelAlchemyRead()))
            .children('Cancel descriptor read'),
        ]
      : []),
    h.p.attr('role', 'status').attr('aria-live', 'polite').children(state.notice),
    ...(review
      ? [
          alchemyLayoutControls(model, h, send),
          h.h3.children('Source provenance'),
          h.dl.class('alchemy-provenance').children(
            ...Object.entries({
              'Domain version': review.projection.source.source.packageVersion,
              Namespace: review.projection.source.source.namespace,
              Model: review.projection.source.source.modelName,
              Revision: review.projection.source.source.revision,
            }).flatMap(([key, value]) => [h.dt.children(key), h.dd.children(value)]),
          ),
          h.p.children(
            'Host-declared provenance and state claims; authorship and runtime behaviour are unverified. This preview grants no editing or execution authority.',
          ),
          h.p.children(
            'Compatibility: exact Domain/Alchemy beta.85; native core from this branch. Published core 0.3.0 is not qualified. Omitted-read and stateless-view strict typing remain upstream gates.',
          ),
          h.h3.children('Projection coverage'),
          h.p.children(
            `${review.projection.coverage.length} source facts · ${review.projection.nativeReadModels.length} native read-model · ${review.projection.nativeConsumption.length} declared feed`,
          ),
          h.h3.children('Losses and unverified meaning'),
          h.ul.attr('aria-label', 'Descriptor findings').children(
            ...(navigator?.entries ?? []).map((entry, index) => {
              const f = entry.finding,
                reasonId = `alchemy-finding-${review.id}-${index}-reason`;
              return h.li
                .key(JSON.stringify([f.code, f.sourceId, index]))
                .attr('data-alchemy-finding-selected', String(entry.selected))
                .children(
                  h.strong.children(`${f.severity}: ${f.code}`),
                  h.p.class('alchemy-finding-label').children(entry.label),
                  h.p.children(f.reason),
                  ...(f.sourceId
                    ? [
                        h.details.children(
                          h.summary.children('Source fact'),
                          h.code.children(f.sourceId),
                        ),
                      ]
                    : []),
                  h.button
                    .attr('type', 'button')
                    .attr('aria-label', `Reveal ${entry.label}`)
                    .disabled(entry.reason !== null || entry.request === null)
                    .attr('aria-describedby', entry.reason ? reasonId : undefined)
                    .on('click', () =>
                      entry.request
                        ? send(
                            Message.ClickedAlchemyFinding({
                              id: review.id,
                              request: entry.request,
                            }),
                          )
                        : undefined,
                    )
                    .children(entry.target?.entity === 'edge' ? 'Reveal relation' : 'Reveal node'),
                  ...(entry.reason ? [h.p.id(reasonId).children(entry.reason)] : []),
                );
            }),
          ),
          h.button
            .attr('type', 'button')
            .on('click', send(Message.ClickedCloseAlchemyReview()))
            .children('Return to working model'),
        ]
      : []),
  );
}
export const alchemyReviewPanel = architectureNativePanel<Model>(renderAlchemyReview);

const alchemyReviewBanner = architectureNativePanel<{
  readonly id: number;
  readonly name: string;
  readonly revision: string;
  readonly canFit: boolean;
}>((h, { id, name, revision, canFit }, send) =>
  h.div
    .class('receipt-canvas-banner')
    .attr('role', 'status')
    .children(
      `Read-only Domain descriptor · ${name} · ${revision} · Working model preserved`,
      h.button
        .attr('type', 'button')
        .disabled(!canFit)
        .on(
          'click',
          send(Message.ObservedAlchemyInput({ id, message: { type: 'FitViewClicked' } })),
        )
        .children('Fit descriptor diagram'),
      h.button
        .attr('type', 'button')
        .on('click', send(Message.ClickedCloseAlchemyReview()))
        .children('Return to working model'),
    ),
);

export function alchemyReviewCanvas<M>(model: Model, h: Html.H<M>, send: (message: Message) => M) {
  const review = model.alchemyReview.review;
  if (!review) return h.div.children();
  const scheme =
    model.themePreference === 'system' ? model.systemColorScheme : model.themePreference;
  const labels =
    review.layout.labels.measurement.type === 'pending' &&
    alchemyLabelContext(model).type === 'pending'
      ? review.layout.labels.measurement.request
      : undefined;
  const headings =
    review.layout.header === 'measured' &&
    review.layout.heading.measurement.type === 'pending' &&
    alchemyHeadingContext(model).type === 'pending'
      ? review.layout.heading.measurement.request
      : undefined;
  return h.div
    .key(`alchemy:${review.id}`)
    .class('receipt-canvas alchemy-canvas')
    .children(
      alchemyReviewBanner(
        h,
        {
          id: review.id,
          name: review.projection.source.source.modelName,
          revision: review.projection.source.source.revision,
          canFit: review.editor.surface !== null,
        },
        'architecture-effect-ui',
        'domain-review-banner',
        send,
      ),
      nativeAlchemyCanvas(
        h,
        { review, scheme: scheme ?? 'light', headings, labels },
        'architecture-detached-review',
        `alchemy-${review.id}`,
        send,
      ),
    );
}
