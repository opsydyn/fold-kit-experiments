import { Option } from 'effect';
import type { Document } from 'foldkit/html';
import { html } from 'foldkit/html';

import * as DonutChart from '../../ui/donut-chart';
import type { Message } from './message';
import { GotDonutMessage } from './message';
import type { Model } from './model';

import * as styles from './donut.css';

type DonutMessage = DonutChart.Message;

const toParentMessage = (msg: DonutMessage): Message => GotDonutMessage({ message: msg });

const { div, span, Class, Style, DataAttribute } = html<Message>();

export const view = (model: Model): Document => ({
  title: 'Donut Chart — foldkit-viz',
  body: div(
    [Class(styles.layout)],
    [
      div(
        [Class(styles.chartWrapper)],
        [
          DonutChart.view({
            model: model.donut,
            toParentMessage,
            ariaLabel: 'Budget breakdown by department',
          }),
        ],
      ),
      div(
        [Class(styles.legend)],
        model.donut.segments.map((seg, i) => {
          const isActive =
            Option.isSome(model.donut.activeIndex) && model.donut.activeIndex.value === i;
          return div(
            [Class(styles.legendRow), ...(isActive ? [DataAttribute('active', '')] : [])],
            [
              div([Class(styles.swatch), Style({ background: seg.color })], []),
              span([Class(styles.legendLabel)], [seg.label]),
              span([Class(styles.legendValue)], [`${String(seg.value)}%`]),
            ],
          );
        }),
      ),
    ],
  ),
});
