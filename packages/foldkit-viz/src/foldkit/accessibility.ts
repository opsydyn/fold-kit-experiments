import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ChartTheme, SeriesStyle } from '../chart/theme.js';
import { symbolPath } from '../shape/symbol.js';

export type LegendEntry = Readonly<{ key: string; label: string; style: SeriesStyle }>;
export type LegendOptions = Readonly<{ entries: ReadonlyArray<LegendEntry>; theme: ChartTheme }>;
export function legend<M>(h: HtmlBuilder<M>, options: LegendOptions): Html {
  return h.ul(
    [
      h.Class('chart-legend'),
      h.Style({
        display: 'flex',
        'flex-wrap': 'wrap',
        gap: '16px',
        padding: '0',
        margin: '12px 0',
        'list-style': 'none',
        color: options.theme.text,
        'font-family': options.theme.fontFamily,
        'font-size': `${options.theme.labelSize}px`,
      }),
    ],
    options.entries.map((entry) =>
      h.li(
        [h.Key(entry.key), h.Style({ display: 'flex', 'align-items': 'center', gap: '6px' })],
        [
          h.svg(
            [h.Width('20'), h.Height('20'), h.ViewBox('-10 -10 20 20'), h.AriaHidden(true)],
            [
              h.path(
                [
                  h.DataAttribute('symbol', entry.style.symbol),
                  h.D(symbolPath(entry.style.symbol, 64)),
                  h.Fill(entry.style.fill),
                  h.Stroke(entry.style.stroke),
                  h.StrokeWidth(String(entry.style.strokeWidth)),
                  h.Opacity(String(entry.style.opacity)),
                ],
                [],
              ),
            ],
          ),
          entry.label,
        ],
      ),
    ),
  );
}
export type DataTableOptions = Readonly<{
  caption: string;
  headers: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<string>>;
}>;
export function dataTable<M>(h: HtmlBuilder<M>, options: DataTableOptions): Html {
  return h.table(
    [h.Class('chart-data-table')],
    [
      h.caption([], [options.caption]),
      h.thead(
        [],
        [
          h.tr(
            [],
            options.headers.map((header) => h.th([h.Scope('col')], [header])),
          ),
        ],
      ),
      h.tbody(
        [],
        options.rows.map((row) =>
          h.tr(
            [],
            row.map((value) => h.td([], [value])),
          ),
        ),
      ),
    ],
  );
}
