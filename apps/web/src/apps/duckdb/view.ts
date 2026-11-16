import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { BIN_CHOICES, KINDS, ROWS } from './engine';
import { Message } from './message';
import type { Model, Ran } from './model';

import * as styles from './duckdb.css';

const thousands = (n: number): string => n.toLocaleString('en-US');

const choice = (
  h: HtmlBuilder<Message>,
  label: string,
  pressed: boolean,
  message: Message,
  busy: boolean,
): Html =>
  h.button(
    [
      h.Type('button'),
      h.Class(styles.button),
      h.AriaPressed(pressed ? 'true' : 'false'),
      h.Disabled(busy),
      h.OnClick(message),
    ],
    [label],
  );

// SAFETY: a Ran's specs are the ones engine.run returned, carried through the Message as JSON.
const specOf = (spec: Ran['histogram']): PlotSpec => spec as PlotSpec;

const binsSent = (ran: Ran): number =>
  [ran.histogram, ran.grid].reduce<number>((sum, spec) => {
    const data = specOf(spec).marks[0]?.data;
    return sum + (Array.isArray(data) ? data.length : 0);
  }, 0);

const status = (model: Model): string => {
  switch (model.engine) {
    case 'off':
      return `DuckDB has not been loaded. It runs in a Web Worker in this page; its WebAssembly loads from cdn.jsdelivr.net.`;
    case 'starting':
      return `Loading DuckDB and making ${thousands(ROWS)} rows…`;
    case 'failed':
      return `DuckDB could not start: ${model.failure}`;
    case 'ready':
      if (model.failure !== '') return `The query failed: ${model.failure}`;
      if (model.ran === null || model.querying) return 'Binning in DuckDB…';
      return `Binned ${thousands(ROWS)} rows in DuckDB in ${Math.round(model.ran.ms)} ms; it sent back ${thousands(binsSent(model.ran))} bins and cells, not the rows.`;
  }
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const ready = model.engine === 'ready';
  const busy = model.querying || model.engine === 'starting';
  return {
    title: 'Query a million rows in your browser — foldkit-viz',
    body: h.div(
      [h.Class(styles.page)],
      [
        h.p(
          [],
          [
            'DuckDB, compiled to WebAssembly, holds a million requests in this page. foldkit-viz pushes each chart’s bins into it as SQL, so DuckDB counts and only the counts come back to draw: the same charts binning every row would draw.',
          ],
        ),
        ...(ready
          ? []
          : [
              h.div(
                [h.Class(styles.toolbar)],
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.Class(styles.button),
                      h.Disabled(busy),
                      h.OnClick(Message.ClickedLoad()),
                    ],
                    [model.engine === 'failed' ? 'Try again' : 'Load DuckDB'],
                  ),
                ],
              ),
            ]),
        h.div(
          [h.Class(styles.toolbar), h.Role('group'), h.AriaLabel('Bins')],
          [
            h.span([h.Class(styles.label)], ['Bins']),
            ...BIN_CHOICES.map((bins) =>
              choice(
                h,
                String(bins),
                model.bins === bins,
                Message.SelectedBins({ bins }),
                busy || !ready,
              ),
            ),
          ],
        ),
        h.div(
          [h.Class(styles.toolbar), h.Role('group'), h.AriaLabel('Kind')],
          [
            h.span([h.Class(styles.label)], ['Kind']),
            ...KINDS.map((kind) =>
              choice(h, kind, model.kind === kind, Message.SelectedKind({ kind }), busy || !ready),
            ),
          ],
        ),
        h.p([h.Class(styles.readout), h.AriaLive('polite')], [status(model)]),
        ...(model.ran === null
          ? []
          : [
              h.div(
                [h.Class(styles.surface)],
                [plotChart(h, compilePlot(specOf(model.ran.histogram)))],
              ),
              h.div([h.Class(styles.surface)], [plotChart(h, compilePlot(specOf(model.ran.grid)))]),
              h.details(
                [],
                [
                  h.summary([], [`The ${model.ran.statements.length} statements sent to DuckDB`]),
                  ...model.ran.statements.map((sql) => h.pre([h.Class(styles.sql)], [sql.trim()])),
                ],
              ),
            ]),
      ],
    ),
  };
};
