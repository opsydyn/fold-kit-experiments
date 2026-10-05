import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';

import { init as datasetInit } from '../src/examples/datasets/launcher/model';
import { view as datasetView } from '../src/examples/datasets/launcher/view';
import { init as lineInit } from '../src/examples/line/model';
import { view as lineView } from '../src/examples/line/view';

test('Pages dataset toolbar renders deployed downloads and external editing', async () => {
  const { model } = datasetInit({
    templateUrl: '/fold-kit-experiments/viz/downloads/dataset-template.json',
    downloadUrl: '/fold-kit-experiments/viz/downloads/dataset-explorer.zip',
    embeddedEditor: false,
  });
  const rendered = await Effect.runPromise(
    renderToString(
      { Flags: Schema.Struct({}), init: () => ({ model }), view: datasetView },
      { flags: {}, isHydratable: false },
    ),
  );
  expect(rendered.html).not.toContain('Edit live');
  expect(rendered.html).toContain('Open in StackBlitz');
  expect(rendered.html).toContain(
    'href="/fold-kit-experiments/viz/downloads/dataset-explorer.zip"',
  );
});

test('Pages line view keeps its chart and exports without orphaned editor tabs', async () => {
  const { model } = lineInit({
    sources: [],
    templateUrl: '/fold-kit-experiments/viz/downloads/line-template.json',
    embeddedEditor: false,
  });
  const rendered = await Effect.runPromise(
    renderToString(
      { Flags: Schema.Struct({}), init: () => ({ model }), view: lineView },
      { flags: {}, isHydratable: false },
    ),
  );
  expect(rendered.html).not.toContain('Edit live');
  expect(rendered.html).not.toContain('role="tabpanel"');
  expect(rendered.html).toContain('Open in StackBlitz');
  expect(rendered.html).toContain('chart-frame');
});
