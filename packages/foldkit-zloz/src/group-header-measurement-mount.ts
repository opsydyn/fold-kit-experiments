import { Effect, Schema } from 'effect';
import { Mount } from 'foldkit';
import type { HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';

import { bindBoxMeasurement, type BoxMeasurementBatch } from './box-measurement-mount';
import { ZlozError } from './graph';
import type {
  ZlozGroupHeaderMeasurementRequest,
  ZlozGroupHeaderMeasurementResult,
} from './group-header-measurement';
// oxlint-disable-next-line linteffect/no-raw-time-domain-field -- Browser deadline in explicit milliseconds; not a persisted domain duration.
export type ZlozGroupHeaderMeasurementOptions = Readonly<{ timeoutMs?: number }>;
export function bindGroupHeaderMeasurement(
  probe: Element,
  ids: readonly string[],
  emit: (batch: BoxMeasurementBatch) => void,
  timeoutMs = 3000,
): () => void {
  return bindBoxMeasurement(probe, ids, emit, timeoutMs, {
    attribute: 'data-zloz-group-header',
    scope: 'data-zloz-group-header-measurement-scope',
    noun: 'group heading',
    plural: 'group headings',
    title: 'Group heading',
  });
}
const Message = defineMessageUnion({ ObservedGroupHeaderMeasurement: { result: Schema.Unknown } });
const Measure = Mount.define('ZlozGroupHeaderMeasurement', {
  args: {
    requestId: Schema.String,
    revision: Schema.Number,
    renderKey: Schema.String,
    ids: Schema.Array(Schema.String),
    timeoutMs: Schema.Number,
  },
  messages: [Message.ObservedGroupHeaderMeasurement],
  execute: ({ element, requestId, revision, renderKey, ids, timeoutMs }) =>
    Effect.callback<ReturnType<typeof Message.ObservedGroupHeaderMeasurement>>((resume) => {
      const release = bindGroupHeaderMeasurement(
        element,
        ids,
        (batch) =>
          resume(
            Effect.succeed(
              Message.ObservedGroupHeaderMeasurement({
                result:
                  batch.type === 'measured'
                    ? { type: 'measured', headers: batch.labels, requestId, revision, renderKey }
                    : { ...batch, requestId, revision, renderKey },
              }),
            ),
          ),
        timeoutMs,
      );
      return Effect.sync(release);
    }),
});
/** Mount directly inside a scoped host containing data-zloz-group-header targets. No automatic layout is started. */
export function zlozGroupHeaderMeasurement<M>(
  h: HtmlBuilder<M>,
  request: ZlozGroupHeaderMeasurementRequest,
  onMeasured: (result: ZlozGroupHeaderMeasurementResult) => M,
  options: ZlozGroupHeaderMeasurementOptions = {},
) {
  const timeoutMs = options.timeoutMs ?? 3000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000)
    throw new ZlozError(
      'invalid-layout',
      'Group heading measurement timeout must be positive, finite and at most 60000 milliseconds',
    );
  return h.div(
    [
      h.Key(`group-header-measurement:${request.requestId}`),
      h.AriaHidden(true),
      h.Style({ display: 'none' }),
      h.OnMount(
        Mount.mapMessage(
          Measure({
            requestId: request.requestId,
            revision: request.revision,
            renderKey: request.renderKey,
            ids: request.headers.map((header) => header.id),
            timeoutMs,
          }),
          (message) => {
            // SAFETY: this private Mount constructs the typed result; core validates complete bounds and current identity.
            return onMeasured(message.result as ZlozGroupHeaderMeasurementResult);
          },
        ),
      ),
    ],
    [],
  );
}
