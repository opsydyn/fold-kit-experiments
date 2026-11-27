import { UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { barGeometry } from '@opsydyn/foldkit-viz/chart/bars';
import { Schema } from 'effect';

const Row = Schema.Struct({ key: Schema.String, label: Schema.String, value: Schema.Finite });
const Props = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  categoryHeading: Schema.String,
  valueHeading: Schema.String,
  unit: Schema.String,
  rows: Schema.Array(Row),
  interactive: Schema.Boolean,
});

const Message = UiSchema.TaggedEnum({ SelectedBar: { key: Schema.String } });

export const VizBarChart = Html.component({
  name: 'VizBarChart',
  props: Props,
  model: Schema.NullOr(Schema.String),
  message: Message,
}).make({
  init: () => null,
  update: { SelectedBar: (_, { key }) => key },
  view: (h, selectedKey) => {
    const { title, description, categoryHeading, valueHeading, unit, rows, interactive } = h.props;
    const chart = barGeometry(
      rows,
      {
        key: (row) => row.key,
        category: (row) => row.key,
        series: () => valueHeading,
        value: (row) => row.value,
      },
      {
        frame: { width: 240, height: 96, margins: { top: 0, right: 0, bottom: 0, left: 0 } },
        mode: 'grouped',
        orientation: 'vertical',
      },
    );
    const selected = rows.find(({ key }) => key === selectedKey);
    return h.figure(
      h.figcaption(title),
      h
        .el('svg')
        .attr('role', 'img')
        .attr('aria-label', title)
        .attr('aria-description', description)
        .attr('viewBox', `0 0 ${chart.frame.width} ${chart.frame.height}`)
        .attr('width', String(chart.frame.width))
        .children(
          ...chart.bars.map((bar) =>
            h
              .el('rect')
              .attr('data-bar-key', bar.key)
              .attr('x', String(bar.x))
              .attr('y', String(bar.y))
              .attr('width', String(bar.width))
              .attr('height', String(bar.height))
              .attr('fill', '#2563eb')
              .attr('stroke', bar.key === selectedKey ? 'currentColor' : 'none')
              .attr('stroke-width', '3')
              .children(),
          ),
        ),
      h.table(
        h.caption(title),
        h.thead(
          h.tr(
            h.th.attr('scope', 'col').children(categoryHeading),
            h.th.attr('scope', 'col').children(valueHeading),
          ),
        ),
        h.tbody(
          ...rows.map(({ key, label, value }) =>
            h.tr(
              h.th.attr('scope', 'row').children(
                interactive
                  ? h.button
                      .attr('type', 'button')
                      .attr('data-bar-key', key)
                      .attr('aria-pressed', String(key === selectedKey))
                      .on('click', Message.SelectedBar({ key }))
                      .children(label)
                  : label,
              ),
              h.td(String(value)),
            ),
          ),
        ),
      ),
      interactive &&
        h.output
          .attr('aria-live', 'polite')
          .children(selected ? `${selected.label}: ${selected.value} ${unit}` : 'No selection'),
    );
  },
});
