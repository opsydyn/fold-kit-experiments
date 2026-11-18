import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const workspace = fileURLToPath(new URL('../', import.meta.url));

test('browser rendering excludes the XML compiler and the complete Core catalog', async () => {
  const result = await Bun.build({
    entrypoints: [path.join(workspace, 'src/index.ts')],
    target: 'browser',
    minify: true,
  });
  expect(result.success).toBe(true);
  const output = await result.outputs[0]?.text();
  expect(output).toBeDefined();
  expect(output?.length).toBeLessThan(8192);
  expect(output).not.toContain('Malformed Phosphor SVG');
  expect(output).not.toContain('sax');
  expect(output).not.toContain('@phosphor-icons/core');
});

test('a packed consumer imports both entries in Node/Bun and resolves public types', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'foldkit-phosphor-consumer-'));
  // oxlint-disable-next-line linteffect/no-try-catch -- Native fixture cleanup must also run when external verification rejects.
  try {
    await exec('bun', ['pm', 'pack', '--destination', directory], { cwd: workspace });
    const archive = path.join(directory, 'opsydyn-foldkit-phosphor-0.1.0.tgz');
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    await exec(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        archive,
        'foldkit@0.170.0',
        'effect@4.1.0',
        '@effect/platform-browser@4.1.0',
      ],
      { cwd: directory, maxBuffer: 1024 * 1024 },
    );
    const manifest = JSON.parse(
      await readFile(
        path.join(directory, 'node_modules/@opsydyn/foldkit-phosphor/package.json'),
        'utf8',
      ),
    );
    expect(manifest.dependencies.sax).toBe('1.6.1');
    const source = `import { phosphorIcon } from '@opsydyn/foldkit-phosphor';
import type { PhosphorIconDefinition } from '@opsydyn/foldkit-phosphor';
import { compilePhosphorIcon } from '@opsydyn/foldkit-phosphor/compile';
import type { HtmlBuilder } from 'foldkit/html';
const definition: PhosphorIconDefinition = compilePhosphorIcon('<svg viewBox="0 0 256 256"><path d="M0 0h20v20Z"/></svg>');
export const view = (h: HtmlBuilder<{ readonly _tag: 'ClickedAdd' }>) => phosphorIcon(h, definition, { label: 'System', size: '1em', attributes: [h.Class('icon')] });
if (definition.children[0]?.tag !== 'path') throw Error('Missing compiled geometry');
console.log('packed-icon-ok');`;
    const file = path.join(directory, 'consumer.mts');
    await writeFile(file, source);
    const tsc = path.join(workspace, 'node_modules/.bin/tsc');
    for (const resolution of ['Bundler', 'NodeNext'])
      await exec(
        tsc,
        [
          '--noEmit',
          '--strict',
          '--exactOptionalPropertyTypes',
          '--skipLibCheck',
          '--target',
          'ES2022',
          '--moduleResolution',
          resolution,
          '--module',
          resolution === 'Bundler' ? 'ESNext' : 'NodeNext',
          file,
        ],
        { cwd: directory },
      );
    // Strip type-only imports without bundling, so native Node checks actual package exports.
    await exec(
      'bun',
      ['build', '--no-bundle', '--target=node', '--outfile=consumer.mjs', 'consumer.mts'],
      { cwd: directory },
    );
    for (const runtime of ['node', 'bun']) {
      const result = await exec(runtime, ['consumer.mjs'], { cwd: directory });
      expect(result.stdout).toContain('packed-icon-ok');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);
