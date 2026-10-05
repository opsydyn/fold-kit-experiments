import { barGeometry } from '@opsydyn/foldkit-viz/chart/bars';
import { dotPattern, hatchPattern, linearGradient } from '@opsydyn/foldkit-viz/foldkit/paint';
import { Stream } from 'effect';
import { Mount } from 'foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { widthChanges } from '../shared/measurement';
import { barAccessors } from './data';
import { Message } from './message';
import type { Model } from './model';
const MeasureBars = Mount.defineStream('MeasureBars', {
  messages: [Message.RecordedWidth],
  execute: ({ element }) =>
    widthChanges(element).pipe(Stream.map((width) => Message.RecordedWidth({ width }))),
});
const palette = ['var(--blue)', 'var(--coral)', 'var(--mint)'];
export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const geometry = barGeometry(model.data, barAccessors, {
    frame: {
      width: model.width,
      height: 350,
      margins: { top: 24, right: 24, bottom: 42, left: 48 },
    },
    mode: model.mode,
    orientation: model.orientation,
  });
  const active = model.data.find((d) => d.id === model.activeKey);
  const source = `import { barGeometry } from '@opsydyn/foldkit-viz/chart/bars';\n\nconst geometry = barGeometry(data, {\n  key: d => d.id, category: d => d.month,\n  series: d => d.series, value: d => d.value,\n}, {\n  frame, mode: '${model.mode}',\n  orientation: '${model.orientation}',\n});\n// Render geometry.bars as SVG rectangles.\n// Choose each series' paint in your view.\n`;
  return {
    title: 'Grouped and stacked bars — Foldkit Viz',
    body: h.div(
      [h.Class('primitive-demo')],
      [
        h.div(
          [h.Class('primitive-controls')],
          [
            h.fieldset(
              [],
              [
                h.legend([], ['Composition']),
                ...(['grouped', 'stacked'] as const).map((mode) =>
                  h.button(
                    [
                      h.Type('button'),
                      h.AriaPressed(String(model.mode === mode)),
                      h.OnClick(Message.SelectedMode({ mode })),
                    ],
                    [mode],
                  ),
                ),
              ],
            ),
            h.fieldset(
              [],
              [
                h.legend([], ['Orientation']),
                ...(['vertical', 'horizontal'] as const).map((orientation) =>
                  h.button(
                    [
                      h.Type('button'),
                      h.AriaPressed(String(model.orientation === orientation)),
                      h.OnClick(Message.SelectedOrientation({ orientation })),
                    ],
                    [orientation],
                  ),
                ),
              ],
            ),
            h.fieldset(
              [],
              [
                h.legend([], ['Paint']),
                ...(['solid', 'dots', 'hatch', 'gradient'] as const).map((paint) =>
                  h.button(
                    [
                      h.Type('button'),
                      h.AriaPressed(String(model.paint === paint)),
                      h.OnClick(Message.SelectedPaint({ paint })),
                    ],
                    [paint],
                  ),
                ),
              ],
            ),
            h.button([h.Type('button'), h.OnClick(Message.ClickedReset())], ['Reset']),
          ],
        ),
        h.div(
          [h.Class('primitive-plot'), h.OnMount(MeasureBars())],
          [
            h.svg(
              [
                h.ViewBox(`0 0 ${model.width} 350`),
                h.Role('img'),
                h.AriaLabel('Illustrative monthly activity by series'),
              ],
              [
                h.defs(
                  [],
                  geometry.series.flatMap((_series, i) => {
                    const colour = palette[i % palette.length] ?? 'currentColor';
                    return [
                      dotPattern(h, { id: `bars-dots-${i}`, colour, spacing: 7, radius: 1.6 }),
                      hatchPattern(h, {
                        id: `bars-hatch-${i}`,
                        colour,
                        spacing: 6,
                        strokeWidth: 2,
                      }),
                      linearGradient(h, {
                        id: `bars-gradient-${i}`,
                        stops: [
                          { offset: 0, colour, opacity: 0.35 },
                          { offset: 1, colour },
                        ],
                      }),
                    ];
                  }),
                ),
                ...geometry.ticks.flatMap((t) =>
                  model.orientation === 'vertical'
                    ? [
                        h.line(
                          [
                            h.X1(String(geometry.plot.left)),
                            h.X2(String(geometry.plot.right)),
                            h.Y1(String(t.position)),
                            h.Y2(String(t.position)),
                            h.Stroke('var(--border)'),
                          ],
                          [],
                        ),
                        h.text(
                          [h.X('38'), h.Y(String(t.position + 4)), h.TextAnchor('end')],
                          [String(t.value)],
                        ),
                      ]
                    : [
                        h.line(
                          [
                            h.X1(String(t.position)),
                            h.X2(String(t.position)),
                            h.Y1(String(geometry.plot.top)),
                            h.Y2(String(geometry.plot.bottom)),
                            h.Stroke('var(--border)'),
                          ],
                          [],
                        ),
                        h.text(
                          [h.X(String(t.position)), h.Y('333'), h.TextAnchor('middle')],
                          [String(t.value)],
                        ),
                      ],
                ),
                ...geometry.bars.map((b) => {
                  const i = geometry.series.indexOf(b.series);
                  const fill =
                    model.paint === 'solid'
                      ? (palette[i % palette.length] ?? 'currentColor')
                      : `url(#bars-${model.paint}-${i})`;
                  return h.rect(
                    [
                      h.Key(b.key),
                      h.X(String(b.x)),
                      h.Y(String(b.y)),
                      h.Width(String(b.width)),
                      h.Height(String(b.height)),
                      h.Fill(fill),
                      h.Stroke(b.key === model.activeKey ? 'var(--text)' : 'none'),
                      h.StrokeWidth('2'),
                      h.Tabindex(0),
                      h.AriaLabel(`${b.category}, ${b.series}: ${b.value}`),
                      h.OnFocus(Message.InspectedBar({ key: b.key })),
                      h.OnMouseEnter(Message.InspectedBar({ key: b.key })),
                    ],
                    [h.title([], [`${b.category}, ${b.series}: ${b.value}`])],
                  );
                }),
                ...geometry.categories.map((c) =>
                  model.orientation === 'vertical'
                    ? h.text([h.X(String(c.position)), h.Y('333'), h.TextAnchor('middle')], [c.key])
                    : h.text(
                        [h.X('38'), h.Y(String(c.position + 4)), h.TextAnchor('end')],
                        [c.key],
                      ),
                ),
              ],
            ),
          ],
        ),
        h.p(
          [h.Class('primitive-status'), h.AriaLive('polite')],
          [
            active
              ? `${active.month} · ${active.series}: ${active.value}`
              : 'Hover or focus a bar to inspect its value.',
          ],
        ),
        h.ul(
          [h.Class('primitive-legend'), h.AriaLabel('Series')],
          geometry.series.map((s, i) =>
            h.li([h.Style({ color: palette[i % palette.length] ?? 'currentColor' })], [s]),
          ),
        ),
        h.details(
          [],
          [h.summary([], ['Read the geometry code']), h.pre([], [h.code([], [source])])],
        ),
        h.details(
          [],
          [
            h.summary([], ['View all data']),
            h.table(
              [],
              [
                h.caption([], ['Illustrative monthly activity']),
                h.thead(
                  [],
                  [
                    h.tr(
                      [],
                      ['Month', 'Series', 'Value'].map((s) => h.th([h.Scope('col')], [s])),
                    ),
                  ],
                ),
                h.tbody(
                  [],
                  model.data.map((d) =>
                    h.tr(
                      [],
                      [h.td([], [d.month]), h.td([], [d.series]), h.td([], [String(d.value)])],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    ),
  };
};
