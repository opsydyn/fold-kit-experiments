import type { Html } from '@effect/ui/html';
import { Option } from 'effect';

import { targetsOf } from '../../ui/plot-panel/core';
import { view as panel } from '../../ui/plot-panel/effect-ui';
import { matchingBinIndices, matchingKeys } from '../../ui/shared/inspection';
import { Message } from './message';
import { pointsWithExperience, type Model } from './model';

const instruction = {
  fontSize: '0.75rem',
  color: '#888',
  marginBottom: '0.5rem',
  fontWeight: '600',
} as const;

export const view = (h: Html.H<Message>, model: Model) => {
  const points = pointsWithExperience(model.minimumExperience);
  const keys = Option.match(model.inspection, {
    onNone: () => [],
    onSome: (inspection) => matchingKeys(points, inspection),
  });
  const bins = targetsOf(model.histogram).map((bin) => ({ x0: bin.domain[0], x1: bin.domain[1] }));

  const scatterConfig = {
    model: model.scatter,
    toParentMessage: (message: import('../../ui/plot-panel/core').Message) =>
      Message.ReceivedScatterMessage({ message }),
    ariaLabel: 'Scatter chart — experience vs salary',
  };
  const scatter = panel(
    Option.isSome(model.inspection)
      ? { ...scatterConfig, highlight: { field: 'id', values: keys } }
      : scatterConfig,
    h,
  );
  const histogram = panel(
    {
      model: model.histogram,
      emphasis: matchingBinIndices(points, keys, bins),
      toParentMessage: (message) => Message.ReceivedHistogramMessage({ message }),
      ariaLabel: 'Histogram — salary distribution',
    },
    h,
  );

  return h.div
    .style({ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' })
    .children(
      h.div.style({ flexBasis: '100%' }).children(
        h.label(
          'Minimum years of experience ',
          h.input
            .attrs({ type: 'number', min: '0' })
            .value(String(model.minimumExperience))
            .on('input', ({ value }) => Message.ChangedMinimumExperience({ years: Number(value) })),
        ),
        h.p
          .attr('role', 'status')
          .children(
            points.length === 0
              ? 'No observations match the filter.'
              : `${points.length} observations`,
          ),
      ),
      h.div
        .style({ flex: '1 1 360px' })
        .children(
          h.p
            .style(instruction)
            .children('Experience vs salary. Use the arrow keys to inspect a point.'),
          scatter,
          Option.isSome(model.inspection) &&
            h.p.attr('aria-live', 'polite').children(`${keys.length} matching points`),
        ),
      h.div
        .style({ flex: '1 1 340px' })
        .children(
          h.p
            .style(instruction)
            .children('Salary distribution. Use the arrow keys to inspect a bin.'),
          histogram,
        ),
    );
};
