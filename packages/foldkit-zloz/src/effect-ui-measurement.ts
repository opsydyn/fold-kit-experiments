import { Mount } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Queue, Schema, Stream } from 'effect';

import {
  bindBoxMeasurement,
  groupHeaderMeasurementTarget,
  labelMeasurementTarget,
  type BoxMeasurementBatch,
} from './box-measurement-mount';
import type {
  ZlozGroupHeaderMeasurementRequest,
  ZlozGroupHeaderMeasurementResult,
} from './group-header-measurement';
import type { ZlozLabelMeasurementRequest, ZlozLabelMeasurementResult } from './label-measurement';

const measure = Mount.makeStream(
  'ZlozMeasureGraphBoxes',
  { args: { ids: Schema.Array(Schema.String), target: Schema.Literals(['labels', 'headings']) } },
  (element: HTMLElement, { ids, target }) =>
    Stream.callback<BoxMeasurementBatch>((queue) => {
      const bind = Effect.sync(() =>
        bindBoxMeasurement(
          element,
          ids,
          (batch) => Queue.offerUnsafe(queue, batch),
          3000,
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
) {
  return h.div
    .key(`labels:${requestId}`)
    .attr('hidden', '')
    .onMount(
      Mount.map(measure({ ids: [...edgeIds], target: 'labels' }), (batch) =>
        onMeasured({ ...batch, requestId, revision, renderKey }),
      ),
    )
    .children();
}

/** Place inside a data-zloz-group-header-measurement-scope host with matching rendered headings. */
export function groupHeaderMeasurementProbe<M>(
  h: Html.H<M>,
  { headers, requestId, revision, renderKey }: ZlozGroupHeaderMeasurementRequest,
  onMeasured: (result: ZlozGroupHeaderMeasurementResult) => M,
) {
  return h.div
    .key(`headings:${requestId}`)
    .attr('hidden', '')
    .onMount(
      Mount.map(measure({ ids: headers.map(({ id }) => id), target: 'headings' }), (batch) =>
        onMeasured(
          batch.type === 'measured'
            ? { type: 'measured', headers: batch.labels, requestId, revision, renderKey }
            : { ...batch, requestId, revision, renderKey },
        ),
      ),
    )
    .children();
}
