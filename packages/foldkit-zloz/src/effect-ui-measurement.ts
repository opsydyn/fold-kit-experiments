import { Mount } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Queue, Schema, Stream } from 'effect';

import {
  bindBoxMeasurement,
  groupHeaderMeasurementTarget,
  labelMeasurementTarget,
  type BoxMeasurementBatch,
} from './box-measurement-mount';
import { ZlozError } from './graph';
import type {
  ZlozGroupHeaderMeasurementRequest,
  ZlozGroupHeaderMeasurementResult,
} from './group-header-measurement';
import type { ZlozLabelMeasurementRequest, ZlozLabelMeasurementResult } from './label-measurement';

// oxlint-disable-next-line linteffect/no-raw-time-domain-field -- This is a browser observation deadline, not a model duration.
export type ZlozBoxMeasurementOptions = Readonly<{ timeoutMs?: number }>;

function measurementTimeout(options: ZlozBoxMeasurementOptions): number {
  const timeoutMs = options.timeoutMs ?? 3000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000) {
    throw new ZlozError(
      'invalid-layout',
      'Measurement timeout must be positive, finite and at most 60000 milliseconds.',
    );
  }
  return timeoutMs;
}

const measure = Mount.makeStream(
  'ZlozMeasureGraphBoxes',
  {
    args: {
      ids: Schema.Array(Schema.String),
      target: Schema.Literals(['labels', 'headings']),
      timeoutMs: Schema.Number,
    },
  },
  (element: HTMLElement, { ids, target, timeoutMs }) =>
    Stream.callback<BoxMeasurementBatch>((queue) => {
      const bind = Effect.sync(() =>
        bindBoxMeasurement(
          element,
          ids,
          (batch) => Queue.offerUnsafe(queue, batch),
          timeoutMs,
          target === 'labels' ? labelMeasurementTarget : groupHeaderMeasurementTarget,
        ),
      );
      return Effect.acquireRelease(bind, Effect.sync);
    }).pipe(Stream.take(1)),
);

/** Place inside a data-zloz-label-measurement-scope host with matching rendered labels. */
export function labelMeasurementProbe<M>(
  h: Html.H<M>,
  { edgeIds, requestId, revision, renderKey }: ZlozLabelMeasurementRequest,
  onMeasured: (result: ZlozLabelMeasurementResult) => M,
  options: ZlozBoxMeasurementOptions = {},
) {
  return h.div
    .key(`labels:${requestId}`)
    .attr('hidden', '')
    .onMount(
      Mount.map(
        measure({ ids: [...edgeIds], target: 'labels', timeoutMs: measurementTimeout(options) }),
        (batch) => onMeasured({ ...batch, requestId, revision, renderKey }),
      ),
    )
    .children();
}

/** Place inside a data-zloz-group-header-measurement-scope host with matching rendered headings. */
export function groupHeaderMeasurementProbe<M>(
  h: Html.H<M>,
  { headers, requestId, revision, renderKey }: ZlozGroupHeaderMeasurementRequest,
  onMeasured: (result: ZlozGroupHeaderMeasurementResult) => M,
  options: ZlozBoxMeasurementOptions = {},
) {
  return h.div
    .key(`headings:${requestId}`)
    .attr('hidden', '')
    .onMount(
      Mount.map(
        measure({
          ids: headers.map(({ id }) => id),
          target: 'headings',
          timeoutMs: measurementTimeout(options),
        }),
        (batch) =>
          onMeasured(
            batch.type === 'measured'
              ? { type: 'measured', headers: batch.labels, requestId, revision, renderKey }
              : { ...batch, requestId, revision, renderKey },
          ),
      ),
    )
    .children();
}
