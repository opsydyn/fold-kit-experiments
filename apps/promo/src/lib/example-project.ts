import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import vizPackage from '../../../../packages/foldkit-viz/package.json' with { type: 'json' };
import { assertVizSubpath, staticImports } from './comparison-sources';
import { datasetProject } from './dataset-project';

export type SourceFile = Readonly<{ name: string; content: string }>;

export async function collectVizModules(
  libraryRoot: string,
  modules: ReadonlyArray<string>,
): Promise<Record<string, string>> {
  modules.forEach(assertVizSubpath);
  const canonicalRoot = await realpath(libraryRoot);
  const files: Record<string, string> = {};
  const pending = modules.flatMap((module) => [module + '.mjs', module + '.d.mts']);
  const included = new Set<string>();
  while (pending.length > 0) {
    const modulePath = pending.pop();
    if (modulePath === undefined || included.has(modulePath)) continue;
    assertVizSubpath(modulePath);
    const canonicalPath = await realpath(join(canonicalRoot, modulePath));
    const containedPath = relative(canonicalRoot, canonicalPath);
    if (
      containedPath === '' ||
      containedPath === '..' ||
      containedPath.startsWith('..' + sep) ||
      isAbsolute(containedPath)
    ) {
      throw new RangeError('Compiled Viz import escapes the distribution: ' + modulePath);
    }
    included.add(modulePath);
    const content = await readFile(canonicalPath, 'utf8');
    files['vendor/foldkit-viz/dist/' + modulePath] = content;
    // tsdown emits relative ESM edges. Declaration .mjs specifiers resolve to adjacent .d.mts.
    const imports = content.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/g);
    for (const match of imports) {
      const specifier = match[1];
      if (specifier === undefined) continue;
      const resolved = posix.normalize(posix.join(posix.dirname(modulePath), specifier));
      if (resolved.startsWith('../'))
        throw new RangeError('Compiled Viz import escapes the distribution');
      pending.push(modulePath.endsWith('.d.mts') ? resolved.replace(/\.mjs$/, '.d.mts') : resolved);
    }
  }
  return files;
}

export async function buildExampleTemplate(
  sources: ReadonlyArray<SourceFile>,
  example: 'line' | 'histogram' | 'scatter' | 'comparison' | 'datasets',
): Promise<Record<string, string>> {
  const libraryRoot = dirname(
    dirname(fileURLToPath(import.meta.resolve('@opsydyn/foldkit-viz/math/scale'))),
  );
  const files: Record<string, string> = Object.fromEntries(
    sources.map(({ name, content }) => ['src/' + name, content]),
  );
  // Bundle the private shared renderer so exported examples do not require a workspace.
  if (example !== 'datasets') {
    const highlightingRoot = dirname(
      fileURLToPath(import.meta.resolve('@opsydyn/dataset-explorer/highlighting')),
    );
    for (const name of [
      'highlighting.ts',
      'highlighting-engine.ts',
      'highlighting-browser.ts',
      'highlighting-assets.d.ts',
      'highlighting.css',
    ]) {
      files['vendor/source-highlighting/' + name] = await readFile(
        join(highlightingRoot, name),
        'utf8',
      );
    }
    files['vendor/source-highlighting/package.json'] = JSON.stringify(
      {
        name: '@opsydyn/dataset-explorer',
        private: true,
        type: 'module',
        exports: {
          './highlighting': './highlighting.ts',
          './highlighting.css': './highlighting.css',
        },
        dependencies: {
          '@wooorm/starry-night': '3.11.0',
          'vscode-oniguruma': '2.0.1',
          '@types/hast': '3.0.5',
          foldkit: '0.167.0',
          effect: '4.0.0',
        },
      },
      null,
      2,
    );
  }
  const modules = [
    'chart/cartesian',
    'chart/theme',
    'foldkit/cartesian',
    ...{
      line: ['math/scale', 'shape/line', 'shape/path'],
      datasets: ['math/scale', 'shape/line', 'shape/path'],
      histogram: ['math/scale', 'math/bin'],
      scatter: ['math/scale'],
      comparison: [
        ...new Set(
          sources.flatMap(({ name, content }) =>
            name.endsWith('.ts')
              ? staticImports(name, content)
                  .filter((specifier) => specifier.startsWith('@opsydyn/foldkit-viz/'))
                  .map((specifier) => specifier.slice('@opsydyn/foldkit-viz/'.length))
              : [],
          ),
        ),
      ],
    }[example],
  ];
  Object.assign(files, await collectVizModules(libraryRoot, modules));
  files['vendor/foldkit-viz/package.json'] = JSON.stringify(
    {
      name: '@opsydyn/foldkit-viz',
      version: vizPackage.version,
      type: 'module',
      license: 'MIT',
      exports: Object.fromEntries(
        modules.map((module) => [
          './' + module,
          { types: './dist/' + module + '.d.mts', import: './dist/' + module + '.mjs' },
        ]),
      ),
    },
    null,
    2,
  );
  files['package.json'] = JSON.stringify(
    {
      name: 'foldkit-viz-live-' + example,
      private: true,
      type: 'module',
      imports:
        example === 'comparison'
          ? undefined
          : {
              '#example/measurement': './src/shared/measurement.ts',
              '#example/frame': './src/shared/frame.ts',
            },
      scripts: {
        dev: 'vite --host 0.0.0.0',
        start: 'vite --host 0.0.0.0',
        build: 'vite build',
        typecheck: 'tsc --noEmit',
      },
      dependencies: {
        '@opsydyn/foldkit-viz': 'file:./vendor/foldkit-viz',
        '@opsydyn/dataset-explorer': 'file:./vendor/source-highlighting',
        foldkit: '0.167.0',
        effect: '4.0.0',
        fflate: '0.8.3',
        '@stackblitz/sdk': '1.11.0',
      },
      devDependencies: { vite: '8.3.1', typescript: '6.0.3', '@foldkit/vite-plugin': '0.27.0' },
      stackblitz: { installDependencies: true, startCommand: 'npm start' },
    },
    null,
    2,
  );
  files['vite.config.ts'] =
    "import { defineConfig } from 'vite';\nimport { foldkit } from '@foldkit/vite-plugin';\nexport default defineConfig({ plugins: [foldkit()] });\n";
  files['tsconfig.json'] = JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        noUncheckedIndexedAccess: true,
        skipLibCheck: true,
        types: ['vite/client'],
        lib: ['ES2022', 'DOM'],
      },
      include: ['src', 'vite.config.ts'],
    },
    null,
    2,
  );
  files['index.html'] =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foldkit Viz — Live ' +
    example +
    '</title></head><body><main><h1>Give your data shape.</h1><p>Change the controls, inspect the code, make it yours.</p><div id="app"></div></main><script type="module" src="/src/entry.ts"></script></body></html>';
  if (example === 'comparison') {
    files['index.html'] =
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chart comparison</title></head><body><main><h1>Chart comparison</h1><div id="app"></div></main><script type="module" src="/src/entry.ts"></script></body></html>';
  }
  const imports = sources
    .map(({ name }, index) => `import source${index} from './${name}?raw';`)
    .join('\n');
  const sourceList = sources
    .map(({ name }, index) => `{ name: '${name}', content: source${index} }`)
    .join(',\n');
  files['src/entry.ts'] =
    "import { Runtime } from 'foldkit';\n" +
    (example === 'comparison'
      ? "import * as app from './promo/src/examples/comparison/main';\n"
      : "import * as app from './main';\nimport './chart.css';\n") +
    "import './standalone.css';\n" +
    imports +
    "\nconst container = document.getElementById('app');\nif (!container) throw new Error('Missing example container');\nconst sources = [\n" +
    sourceList +
    '\n] as const;\nRuntime.embed(Runtime.makeApplication({ ...app, container, devTools: false, init: () => app.init({ sources, templateUrl: null }) }));\n';
  files['src/standalone.css'] =
    ':root { color-scheme: light dark; --text:#151619; --muted:#5d6574; --border:#d9dce1; --surface:#fffefa; background:#f8f7f3; color:var(--text); font-family:system-ui,sans-serif; } * { box-sizing:border-box; } body { margin:0; } main { max-width:1160px; margin:auto; padding:32px 20px; } h1 { letter-spacing:-.04em; font-size:clamp(32px,6vw,56px); } p { line-height:1.6; } @media(prefers-color-scheme:dark) { :root { --text:#f4f2ed; --muted:#adb6c7; --border:#303641; --surface:#191c24; background:#111317; } }';
  files['README.md'] =
    '# Foldkit Viz live ' +
    example +
    '\n\nRequires Node.js 22.12 or newer (or Bun).\n\n```sh\nnpm install\nnpm run dev\n```\n\nEdit `src/settings.ts` for initial values or `src/chart.ts` for geometry. `src/view.ts` renders the chart and controls. Settings are captured from the promo page at export time. Change data/accessors in `src/chart.ts` and `src/data.ts` (where present), brand paints and keyed styles in `src/chart.ts`, surface tokens in `src/shared/frame.ts`, ordered layers and custom tooltips/annotations in `src/view.ts`. The Model owns measured width, controls and inspection; the scoped observer in `src/shared/measurement.ts` reports facts through Messages. Use the data table for complete raw values; numeric axes use concise caller-supplied formatting. Palette assignment is stable over an explicit domain and cycles deterministically.\n\nThe same maintained sources power the promo island. The geometry, semantic themes and optional FoldKit layers plus their compiled dependencies are included under `vendor/` so this project does not depend on an unpublished package version.\n\nFoldkit Viz: MIT, copyright Alan P Currie. FoldKit, Effect, fflate, StackBlitz SDK and Vite retain their respective licences.\n';
  if (example === 'comparison') {
    files['src/standalone.css'] =
      ':root { color-scheme: light dark; --text:#151619; --muted:#5d6574; --border:#d9dce1; --surface:#fff; background:#f4f6f8; color:var(--text); font-family:system-ui,sans-serif; } * { box-sizing:border-box; } body { margin:0; } main { max-width:1160px; margin:auto; padding:24px 16px; } h1 { font-size:24px; letter-spacing:0; } @media(prefers-color-scheme:dark) { :root { --text:#f4f2ed; --muted:#adb6c7; --border:#43464b; --surface:#232529; background:#17191c; } }';
    files['README.md'] =
      '# Foldkit Viz chart comparison\n\nRequires Node.js 22.12 or newer.\n\n```sh\nnpm install\nnpm run typecheck\nnpm run dev\n```\n\nInitial panel kinds, IDs, order, linking and the next ID counter are captured at export. Edit `src/web/src/apps/comparison/initial-settings.ts`; schema and validation remain in `settings.ts`. Transient chart measurements and inspection are not persisted. The same maintained workbench and transitive chart sources power the Astro and promo hosts, with apps-relative paths preserved beneath `src/`. The promo wrapper is `src/promo/src/examples/comparison/main.ts`. Standalone mode retains source inspection and copy but offers no recursive project export.\n\nCompiled Viz modules and dependencies are included under `vendor/`; no unpublished package release is required.\n\nFoldkit Viz: MIT, copyright Alan P Currie. FoldKit, Effect, fflate, StackBlitz SDK and Vite retain their respective licences.\n';
  }
  if (example === 'datasets') return datasetProject(files, sources);
  return files;
}
