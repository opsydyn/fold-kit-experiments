import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import coreManifest from '../../foldkit-flow/package.json';
import manifest from '../package.json';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const options = { cwd: root, maxBuffer: 5 * 1024 * 1024 };

test('packed adapter installs in a clean npm consumer and runs in Node and Bun', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'foldkit-flow-mermaid-consumer-'));
  // Native process fixture cleanup must run even when npm or TypeScript fails.
  // oxlint-disable-next-line linteffect/no-try-catch
  try {
    await exec('bun', ['run', '--filter', manifest.name, 'pack:check'], options);
    const adapter = path.join(
      root,
      'packages/foldkit-flow-mermaid/dist/pack',
      `opsydyn-foldkit-flow-mermaid-${manifest.version}.tgz`,
    );
    for (const name of ['foldkit-flow'])
      await exec('bun', ['pm', 'pack', '--destination', directory], {
        ...options,
        cwd: path.join(root, 'packages', name),
      });
    const core = path.join(directory, `opsydyn-foldkit-flow-${coreManifest.version}.tgz`);
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    await exec(
      'npm',
      ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', core, adapter],
      {
        ...options,
        cwd: directory,
      },
    );
    for (const name of [
      'astro',
      'react',
      'foldkit',
      'effect',
      'elkjs',
      'mermaid',
      'mermaid-ast',
      '@mermaid-js/parser',
    ])
      expect(existsSync(path.join(directory, 'node_modules', name))).toBe(false);

    const source = `import { createEditor } from '@opsydyn/foldkit-flow';
import { exportMermaid, type MermaidExportResult } from '@opsydyn/foldkit-flow-mermaid';
const editor = createEditor({ nodes: [{ id: 'end', label: 'Consumer', position: {x:0,y:0}, size: {width:200,height:100}, ports: [] }], edges: [] });
const result: MermaidExportResult = exportMermaid(editor.graph, { lossPolicy: 'report' });
if (result.status !== 'converted' || result.value.identity.nodes[0]?.flowId !== 'end' || !result.value.source.includes('n_65_6e_64["Consumer"]')) throw new Error('Export failed');
if (exportMermaid(editor.graph).status !== 'rejected' || editor.past.length !== 0) throw new Error('Loss/history contract failed');
const nested = exportMermaid({ nodes: [
 { id: 'outer', kind: 'group', label: 'Outer', position: {x:0,y:0}, size: {width:400,height:300}, ports: [] },
 { id: 'inner', kind: 'group', parentId: 'outer', label: 'Inner', position: {x:10,y:10}, size: {width:300,height:200}, ports: [] },
 { id: 'leaf', parentId: 'inner', label: 'Leaf', position: {x:20,y:20}, size: {width:100,height:80}, ports: [] }
], edges: [] }, { lossPolicy: 'report' });
if (nested.status !== 'converted' || nested.value.identity.nodes[1]?.kind !== 'group' || nested.value.identity.nodes[1]?.parentId !== 'outer' || !nested.value.source.includes('subgraph')) throw new Error('Nested contract failed');
console.log('mermaid-consumer-ok');
`;
    const consumer = path.join(directory, 'consumer.ts');
    await writeFile(consumer, source);
    const tsc = path.join(root, 'packages/foldkit-flow-mermaid/node_modules/.bin/tsc');
    for (const resolution of ['Bundler', 'NodeNext'])
      await exec(
        tsc,
        [
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--target',
          'ES2022',
          '--module',
          resolution === 'NodeNext' ? 'NodeNext' : 'ESNext',
          '--moduleResolution',
          resolution,
          consumer,
        ],
        { ...options, cwd: directory },
      );
    await exec(
      tsc,
      [
        '--skipLibCheck',
        '--target',
        'ES2022',
        '--module',
        'NodeNext',
        '--outDir',
        'compiled',
        consumer,
      ],
      { ...options, cwd: directory },
    );
    for (const runtime of ['node', 'bun']) {
      const result = await exec(runtime, [path.join(directory, 'compiled/consumer.js')], {
        ...options,
        cwd: directory,
      });
      expect(result.stdout.trim()).toBe('mermaid-consumer-ok');
    }
    const contents = await exec('tar', ['-tzf', adapter], options);
    for (const file of ['LICENSE', 'README.md', 'CHANGELOG.md', 'THIRD-PARTY-NOTICES.md'])
      expect(contents.stdout).toContain(`package/${file}`);
    expect(contents.stdout).not.toMatch(/package\/(src|test|node_modules|dist\/pack)\//);
    const packedManifest = await readFile(
      path.join(directory, 'node_modules/@opsydyn/foldkit-flow-mermaid/package.json'),
      'utf8',
    );
    expect(packedManifest).not.toMatch(/workspace:|catalog:/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 180_000);
