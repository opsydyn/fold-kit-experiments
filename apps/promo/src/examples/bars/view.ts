import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { barGeometry } from '@opsydyn/foldkit-viz/chart/bars';

import { widthChanges } from '../shared/measurement';
import { barAccessors } from './data';
import { Message } from './message';
import { Mode, Orientation, Paint, type Model } from './model';
import { paintDefinitions } from './paint';

const MeasureBars = Mount.makeStream('MeasureBars', { args: {} }, widthChanges);
const palette = ['var(--blue)', 'var(--coral)', 'var(--mint)'];
const colourAt = (index: number) => palette[index % palette.length] ?? 'currentColor';

export const view = (h: Html.H<Message>, model: Model) => {
  const geometry = barGeometry(model.data, barAccessors, {
    frame: {
      width: model.width,
      height: 350,
      margins: { top: 24, right: 24, bottom: 42, left: 48 },
    },
    mode: model.mode,
    orientation: model.orientation,
  });
  const active = model.data.find((datum) => datum.id === model.activeKey);
  const source = `import { barGeometry } from '@opsydyn/foldkit-viz/chart/bars';\n\nconst geometry = barGeometry(data, {\n  key: d => d.id, category: d => d.month,\n  series: d => d.series, value: d => d.value,\n}, {\n  frame, mode: '${model.mode}',\n  orientation: '${model.orientation}',\n});\n// Render geometry.bars as SVG rectangles.\n// Choose each series' paint in your view.\n`;
  const control = (label: string, selected: boolean, message: Message) =>
    h.button
      .attr('type', 'button')
      .attr('aria-pressed', String(selected))
      .on('click', message)
      .children(label);

  return h.div.class('primitive-demo').children(
    h.div
      .class('primitive-controls')
      .children(
        h.fieldset(
          h.legend('Composition'),
          ...Mode.literals.map((mode) =>
            control(mode, model.mode === mode, Message.SelectedMode({ mode })),
          ),
        ),
        h.fieldset(
          h.legend('Orientation'),
          ...Orientation.literals.map((orientation) =>
            control(
              orientation,
              model.orientation === orientation,
              Message.SelectedOrientation({ orientation }),
            ),
          ),
        ),
        h.fieldset(
          h.legend('Paint'),
          ...Paint.literals.map((paint) =>
            control(paint, model.paint === paint, Message.SelectedPaint({ paint })),
          ),
        ),
        h.button.attr('type', 'button').on('click', Message.ClickedReset()).children('Reset'),
      ),
    h.div
      .class('primitive-plot')
      .onMount(Mount.map(MeasureBars(), (width) => Message.RecordedWidth({ width })))
      .children(
        h
          .el('svg')
          .attrs({
            viewBox: `0 0 ${model.width} 350`,
            role: 'group',
            'aria-label': 'Illustrative monthly activity by series',
          })
          .children(
            h
              .el('defs')
              .children(
                ...geometry.series.flatMap((_series, index) =>
                  paintDefinitions(h, index, colourAt(index)),
                ),
              ),
            ...geometry.ticks.map(({ value, position }) => {
              const coordinate = String(position);
              const vertical = model.orientation === 'vertical';
              const line = vertical
                ? {
                    x1: String(geometry.plot.left),
                    x2: String(geometry.plot.right),
                    y1: coordinate,
                    y2: coordinate,
                  }
                : {
                    x1: coordinate,
                    x2: coordinate,
                    y1: String(geometry.plot.top),
                    y2: String(geometry.plot.bottom),
                  };
              const label = vertical
                ? { x: '38', y: String(position + 4), 'text-anchor': 'end' }
                : { x: coordinate, y: '333', 'text-anchor': 'middle' };
              return h
                .el('g')
                .children(
                  h.el('line').attrs(line).attr('stroke', 'var(--border)').children(),
                  h.el('text').attrs(label).children(String(value)),
                );
            }),
            ...geometry.bars.map(({ key, series, category, value, x, y, width, height }) => {
              const index = geometry.series.indexOf(series);
              const label = `${category}, ${series}: ${value}`;
              const inspected = Message.InspectedBar({ key });
              return h
                .el('rect')
                .key(key)
                .attrs({
                  x: String(x),
                  y: String(y),
                  width: String(width),
                  height: String(height),
                  fill:
                    model.paint === 'solid'
                      ? colourAt(index)
                      : `url(#bars-${model.paint}-${index})`,
                  stroke: key === model.activeKey ? 'var(--text)' : 'none',
                  'stroke-width': '2',
                  tabindex: '0',
                  role: 'img',
                  'aria-label': label,
                })
                .on('focus', inspected)
                .on('mouseenter', inspected)
                .children(h.el('title').children(label));
            }),
            ...geometry.categories.map(({ key, position }) =>
              h
                .el('text')
                .attrs(
                  model.orientation === 'vertical'
                    ? { x: String(position), y: '333', 'text-anchor': 'middle' }
                    : { x: '38', y: String(position + 4), 'text-anchor': 'end' },
                )
                .children(key),
            ),
          ),
      ),
    h.p
      .class('primitive-status')
      .attr('aria-live', 'polite')
      .children(
        active ? `${active.month} · ${active.series}: ${active.value}` : 'No bar selected.',
      ),
    h.ul
      .class('primitive-legend')
      .attr('aria-label', 'Series')
      .children(
        ...geometry.series.map((series, index) =>
          h.li(
            h.span
              .class('primitive-series-swatch')
              .attr('aria-hidden', 'true')
              .style({ backgroundColor: colourAt(index) })
              .children(),
            series,
          ),
        ),
      ),
    h.details(h.summary('Read the geometry code'), h.pre(h.code(source))),
    h.details(
      h.summary('View all data'),
      h.table(
        h.caption('Illustrative monthly activity'),
        h.thead(
          h.tr(
            ...['Month', 'Series', 'Value'].map((label) =>
              h.th.attr('scope', 'col').children(label),
            ),
          ),
        ),
        h.tbody(
          ...model.data.map(({ month, series, value }) =>
            h.tr(h.td(month), h.td(series), h.td(String(value))),
          ),
        ),
      ),
    ),
  );
};
