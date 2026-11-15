import { Effect, Schema } from 'effect';
import { Mount } from 'foldkit';
import type { HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';

import { bindBoxMeasurement, type BoxMeasurementBatch } from './box-measurement-mount';
import { ZlozError } from './graph';
import type { ZlozLabelMeasurementRequest, ZlozLabelMeasurementResult } from './label-measurement';

// oxlint-disable-next-line linteffect/no-raw-time-domain-field -- Browser deadline in explicit milliseconds, consumed by setTimeout here; not a persisted domain duration.
export type ZlozLabelMeasurementOptions = Readonly<{ timeoutMs?: number }>;

export function bindLabelMeasurement(
  probe: Element,
  edgeIds: readonly string[],
  emit: (batch: BoxMeasurementBatch) => void,
  timeoutMs = 3000,
): () => void {
  return bindBoxMeasurement(probe, edgeIds, emit, timeoutMs, {
    attribute: 'data-zloz-measured-label',
    scope: 'data-zloz-label-measurement-scope',
    noun: 'label',
    plural: 'labels',
    title: 'Label',
  });
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
