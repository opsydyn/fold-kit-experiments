import { expect, test } from 'bun:test';

import { HtmlServer } from '@effect/ui/html';
import { Effect } from 'effect';

import { DatasetLauncher } from '../src/examples/datasets/launcher/main';
import { Line } from '../src/examples/line/main';

test('Pages dataset toolbar renders deployed downloads and external editing', async () => {
  const rendered = await Effect.runPromise(
    HtmlServer.renderToHtml(DatasetLauncher, {
      templateUrl: '/fold-kit-experiments/viz/downloads/dataset-template.json',
      downloadUrl: '/fold-kit-experiments/viz/downloads/dataset-explorer.zip',
      embeddedEditor: false,
    }),
  );
  expect(rendered.html).not.toContain('Edit live');
  expect(rendered.html).toContain('Open in StackBlitz');
  expect(rendered.html).toContain(
    'href="/fold-kit-experiments/viz/downloads/dataset-explorer.zip"',
  );
});

test('Pages line view keeps its chart and exports without orphaned editor tabs', async () => {
  const rendered = await Effect.runPromise(
    HtmlServer.renderToHtml(Line, {
      sources: [],
      templateUrl: '/fold-kit-experiments/viz/downloads/line-template.json',
      embeddedEditor: false,
    }),
  );
  expect(rendered.html).not.toContain('Edit live');
  expect(rendered.html).not.toContain('role="tabpanel"');
  expect(rendered.html).toContain('Open in StackBlitz');
  expect(rendered.html).toContain('chart-frame');
});
