import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { plotChart } from '@opsydyn/foldkit-viz/effect-ui/plot';
import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

import { BIN_CHOICES, KINDS, ROWS } from './engine';
import { Message } from './message';
import type { Model, Ran } from './model';
import { RunDuckDB } from './mount';

import * as styles from './duckdb.css';

const thousands = (n: number): string => n.toLocaleString('en-US');

const choice = (
  h: Html.H<Message>,
  label: string,
  pressed: boolean,
  message: Message,
  busy: boolean,
) =>
  h.button
    .class(styles.button)
    .attrs({ type: 'button', 'aria-pressed': String(pressed) })
    .disabled(busy)
    .on('click', message)
    .children(label);

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

export const view = (h: Html.H<Message>, model: Model) => {
  const ready = model.engine === 'ready';
  const busy = model.querying || model.engine === 'starting';
  const running = ready || model.engine === 'starting';
  const { ran } = model;
  return h.div.class(styles.page).children(
    h.p(
      'DuckDB, compiled to WebAssembly, holds a million requests in this page. Foldkit Viz pushes each chart’s bins into it as SQL, and draws the counts DuckDB returns.',
    ),
    running &&
      h.span
        .attr('hidden', '')
        .onMount(
          Mount.map(
            RunDuckDB({ revision: model.revision, bins: model.bins, kind: model.kind }),
            (message) => message,
          ),
        )
        .children(),
    !ready &&
      h.div.class(styles.toolbar).children(
        h.button
          .class(styles.button)
          .attr('type', 'button')
          .disabled(busy)
          .on('click', Message.ClickedLoad())
          .children(model.engine === 'failed' ? 'Try again' : 'Load DuckDB'),
      ),
    h.div
      .class(styles.toolbar)
      .attrs({ role: 'group', 'aria-label': 'Bins' })
      .children(
        h.span.class(styles.label).children('Bins'),
        ...BIN_CHOICES.map((bins) =>
          choice(
            h,
            String(bins),
            model.bins === bins,
            Message.SelectedBins({ bins }),
            busy || !ready,
          ),
        ),
      ),
    h.div
      .class(styles.toolbar)
      .attrs({ role: 'group', 'aria-label': 'Kind' })
      .children(
        h.span.class(styles.label).children('Kind'),
        ...KINDS.map((kind) =>
          choice(h, kind, model.kind === kind, Message.SelectedKind({ kind }), busy || !ready),
        ),
      ),
    h.p.class(styles.readout).attr('aria-live', 'polite').children(status(model)),
    ran !== null && [
      h.div.class(styles.surface).children(plotChart(h, compilePlot(specOf(ran.histogram)))),
      h.div.class(styles.surface).children(plotChart(h, compilePlot(specOf(ran.grid)))),
      h.details(
        h.summary(`The ${ran.statements.length} statements sent to DuckDB`),
        ...ran.statements.map((sql) => h.pre.class(styles.sql).children(sql.trim())),
      ),
    ],
  );
};
