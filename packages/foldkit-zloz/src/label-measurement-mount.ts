import { Effect, Schema } from 'effect';
import { Mount } from 'foldkit';
import type { HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';

import { ZlozError } from './graph';
import type { ZlozLabelMeasurementRequest, ZlozLabelMeasurementResult } from './label-measurement';
import type { LayoutEdgeLabel } from './types';

// oxlint-disable-next-line linteffect/no-raw-time-domain-field -- Browser deadline in explicit milliseconds, consumed by setTimeout here; not a persisted domain duration.
export type ZlozLabelMeasurementOptions = Readonly<{ timeoutMs?: number }>;

type Batch =
  | { type: 'measured'; labels: readonly LayoutEdgeLabel[] }
  | { type: 'failed'; reason: string };
/** One native, scoped read. Border-box observer sizes are CSS/world units, independent of camera zoom. */
export function bindLabelMeasurement(
  probe: Element,
  edgeIds: readonly string[],
  emit: (batch: Batch) => void,
  timeoutMs = 3000,
): () => void {
  const scope = probe.parentElement,
    win = probe.ownerDocument.defaultView;
  let stopped = false;
  let observer: ResizeObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const release = () => {
    if (stopped) return;
    stopped = true;
    observer?.disconnect();
    if (timer !== undefined) clearTimeout(timer);
  };
  const finish = (batch: Batch) => {
    if (stopped) return;
    release();
    emit(batch);
  };
  if (!scope || !win?.ResizeObserver) {
    finish({ type: 'failed', reason: 'Border-box measurement is unavailable.' });
    return release;
  }
  timer = setTimeout(
    () =>
      finish({
        type: 'failed',
        reason: 'Label measurement timed out. Previous preview preserved.',
      }),
    timeoutMs,
  );
  Promise.resolve(probe.ownerDocument.fonts?.ready)
    .then(() => {
      if (stopped) return;
      const targets = new Map<string, Element>();
      for (const element of scope.querySelectorAll('[data-zloz-measured-label]')) {
        if (element.closest('[data-zloz-label-measurement-scope]') !== scope) continue;
        const id = element.getAttribute('data-zloz-measured-label') ?? '';
        if (edgeIds.includes(id)) {
          if (targets.has(id)) {
            finish({
              type: 'failed',
              reason: 'A requested label has multiple measurement targets.',
            });
            return;
          }
          targets.set(id, element);
        }
      }
      if (targets.size !== edgeIds.length) {
        finish({ type: 'failed', reason: 'Render every requested label before measuring.' });
        return;
      }
      if (edgeIds.length === 0) {
        finish({ type: 'measured', labels: [] });
        return;
      }
      const measured = new Map<string, LayoutEdgeLabel>();
      observer = new win.ResizeObserver((entries) => {
        if (stopped) return;
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-zloz-measured-label') ?? '';
          if (targets.get(id) !== entry.target) continue;
          const boxes = entry.borderBoxSize,
            box = boxes?.[0];
          if (!Array.isArray(boxes) || boxes.length !== 1 || !box) {
            finish({ type: 'failed', reason: 'A single HTML border box is required.' });
            return;
          }
          const vertical =
            win.getComputedStyle(entry.target).writingMode.startsWith('vertical') ||
            win.getComputedStyle(entry.target).writingMode.startsWith('sideways');
          const size = {
            width: vertical ? box.blockSize : box.inlineSize,
            height: vertical ? box.inlineSize : box.blockSize,
          };
          if (
            !entry.target.isConnected ||
            ![size.width, size.height].every((n) => Number.isFinite(n) && n > 0)
          ) {
            finish({
              type: 'failed',
              reason: 'Label bounds must be visible, positive and finite.',
            });
            return;
          }
          measured.set(id, { id, size });
        }
        if (measured.size === edgeIds.length)
          finish({
            type: 'measured',
            labels: [...measured.values()],
          });
      });
      for (const target of targets.values()) observer.observe(target, { box: 'border-box' });
    })
    .catch(() => finish({ type: 'failed', reason: 'Could not measure rendered labels.' }));
  return release;
}
const Message = defineMessageUnion({ ObservedLabelMeasurement: { result: Schema.Unknown } });
const Measure = Mount.define('ZlozLabelMeasurement', {
  args: {
    requestId: Schema.String,
    revision: Schema.Number,
    renderKey: Schema.String,
    edgeIds: Schema.Array(Schema.String),
    timeoutMs: Schema.Number,
  },
  messages: [Message.ObservedLabelMeasurement],
  execute: ({ element, requestId, revision, renderKey, edgeIds, timeoutMs }) =>
    Effect.callback<ReturnType<typeof Message.ObservedLabelMeasurement>>((resume) => {
      const release = bindLabelMeasurement(
        element,
        edgeIds,
        (batch) =>
          resume(
            Effect.succeed(
              Message.ObservedLabelMeasurement({
                result: { ...batch, requestId, revision, renderKey },
              }),
            ),
          ),
        timeoutMs,
      );
      return Effect.sync(release);
    }),
});
/** Place directly inside a data-zloz-label-measurement-scope host containing HTML targets marked data-zloz-measured-label=edge ID. */
export function zlozLabelMeasurement<M>(
  h: HtmlBuilder<M>,
  request: ZlozLabelMeasurementRequest,
  onMeasured: (result: ZlozLabelMeasurementResult) => M,
  options: ZlozLabelMeasurementOptions = {},
) {
  const timeoutMs = options.timeoutMs ?? 3000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000)
    throw new ZlozError(
      'invalid-layout',
      'Label measurement timeout must be between 0 and 60000 milliseconds, exclusive of zero.',
    );
  return h.div(
    [
      h.Key(`label-measurement:${request.requestId}`),
      h.AriaHidden(true),
      h.Style({ display: 'none' }),
      h.OnMount(
        Mount.mapMessage(
          Measure({
            requestId: request.requestId,
            revision: request.revision,
            renderKey: request.renderKey,
            edgeIds: [...request.edgeIds],
            timeoutMs,
          }),
          (message) => {
            // SAFETY: the private Mount constructs this typed result; core performs the final batch/freshness checks.
            return onMeasured(message.result as ZlozLabelMeasurementResult);
          },
        ),
      ),
    ],
    [],
  );
}
