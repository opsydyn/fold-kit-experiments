import { datasetIds, datasets } from '@opsydyn/dataset-explorer/data';

import type { SourceFile } from './example-project';

/** Adapt the common Vite scaffold to the maintained KeyedQuery example. */
export function datasetProject(
  template: Readonly<Record<string, string>>,
  sources: ReadonlyArray<SourceFile>,
) {
  const imports = sources
    .map(({ name }, index) => `import source${index} from './${name}?raw';`)
    .join('\n');
  const sourceList = sources
    .map(({ name }, index) => `{ name: '${name}', content: source${index} }`)
    .join(',\n');
  const fixtures = Object.fromEntries(
    datasetIds.map((dataset) => [
      `public/datasets/${dataset}.json`,
      JSON.stringify(
        {
          dataset,
          points: datasets[dataset].values.map((value, index) => ({ hour: index * 2, value })),
        },
        null,
        2,
      ),
    ]),
  );
  return {
    ...template,
    ...fixtures,
    'package.json': JSON.stringify(
      {
        name: 'foldkit-viz-dataset-explorer',
        private: true,
        type: 'module',
        scripts: {
          start: 'vite --host 0.0.0.0',
          dev: 'vite --host 127.0.0.1',
          build: 'vite build',
          preview: 'vite preview --host 127.0.0.1',
          typecheck: 'tsc --noEmit',
        },
        dependencies: {
          '@opsydyn/foldkit-viz': 'file:./vendor/foldkit-viz',
          foldkit: '0.166.0',
          effect: '4.0.0',
        },
        devDependencies: { vite: '8.3.1', typescript: '6.0.3', '@foldkit/vite-plugin': '0.26.1' },
        stackblitz: { installDependencies: true, startCommand: 'npm start' },
      },
      null,
      2,
    ),
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2023',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          noUncheckedIndexedAccess: true,
          skipLibCheck: true,
          types: ['vite/client'],
          lib: ['ES2023', 'DOM'],
        },
        include: ['src', 'vite.config.ts'],
      },
      null,
      2,
    ),
    'index.html':
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dataset explorer — Foldkit Viz</title></head><body><main><header><p class="eyebrow">FOLDKIT / KEYEDQUERY</p><h1>Data that remembers.</h1><p>Switch stations, refresh the chart and inspect the running source.</p><p>Illustrative observations fetched from static JSON. Latency and failed refreshes are simulated in the client.</p></header><div id="app"></div></main><script type="module" src="/src/entry.ts"></script></body></html>',
    'src/entry.ts':
      "import { Runtime } from 'foldkit';\nimport * as app from './main';\nimport './explorer.css';\nimport './standalone.css';\n" +
      imports +
      "\nconst container = document.getElementById('app');\nif (!container) throw new Error('Missing example container');\nconst sources = [\n" +
      sourceList +
      "\n] as const;\nRuntime.embed(Runtime.makeApplication({ ...app, container, devTools: false, init: () => app.init({ transport: 'fixtures', sources }) }));\n",
    'src/standalone.css': standaloneStyles,
    'README.md': readme,
    'vendor/foldkit-viz/LICENSE': mitLicence,
  };
}

const standaloneStyles = `:root {
  color-scheme: light; --page:#faf9f6; --surface:#fffefa; --text:#151619;
  --muted:#5d6574; --border:#d9dce1; --rule:#bcc2cc;
  --chart-grid:var(--border); --chart-axis:var(--rule);
  background:var(--page); color:var(--text); font-family:system-ui,sans-serif;
}
* { box-sizing:border-box; }
body { margin:0; }
main { max-width:1160px; margin:auto; padding:32px 20px; }
header { margin-bottom:40px; max-width:720px; }
h1 { letter-spacing:-.04em; font-size:clamp(32px,6vw,56px); }
p { line-height:1.6; }
.eyebrow { font:12px ui-monospace,monospace; letter-spacing:.12em; }
.query-log { padding-left:0; }
@media (prefers-color-scheme:light) {
  .query-explorer { --dataset-north:#1c5cd5; --dataset-coast:#bc452d; --dataset-upland:#087c60; }
}
@media (prefers-color-scheme:dark) {
  :root { color-scheme:dark; --page:#111319; --surface:#191c24; --text:#f4f2ed;
    --muted:#adb6c7; --border:#303641; --rule:#3b4554; }
}
`;

const readme = `# Foldkit Viz dataset explorer

Requires Node.js 22.12 or newer (or Bun).

\`\`\`sh
npm install
npm run dev
\`\`\`

\`npm run typecheck\` checks the source; \`npm run build\` produces a static site.
\`npm run preview\` serves the build locally. The appearance follows your browser's
light/dark preference.

Starts on North station. All three illustrative datasets are included under
\`public/datasets/\`; they are not live weather observations. The Query Command
simulates latency and deliberate failures locally. Refresh preserves the chart;
reset invalidates late responses without cancelling their requests.

These are the same maintained FoldKit sources as the promo example:

- \`src/query.ts\`: experimental KeyedQuery, HTTP decoding and cache identity.
- \`src/model.ts\`, \`src/message.ts\`, \`src/update.ts\`: native Model/Message/update flow.
- \`src/chart.ts\`: data accessors, geometry, frame, theme and colour overrides.
- \`src/frame.ts\`, \`src/measurement.ts\`: responsive chart frames and a scoped ResizeObserver Mount.
- \`src/view.ts\`: chart layers, controls, raw observations and response log.
- \`src/source.ts\`, \`src/source-view.ts\`: running source and live snapshot JSON.
- \`src/standalone.css\`: page tokens and browser colour-scheme adaptation.

The source panel reads these local files through Vite. Edit a file and the viewer
and application rebuild together. Replace the static fixtures or adapt the fetch
Command to your API. Query is experimental in FoldKit 0.166.0.

The compiled Viz modules and their declarations are included under \`vendor/\`,
so this project does not require the monorepo or an unpublished Viz release.
Foldkit Viz is MIT, copyright Alan P Currie; its licence is included. FoldKit,
Effect and Vite retain their respective licences.
`;

const mitLicence = `MIT License

Copyright (c) Alan P Currie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;
