import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import vizManifest from '../../foldkit-viz/package.json';
import coreManifest from '../../foldkit-zloz/package.json';
import manifest from '../package.json';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
// A child can stall independently of Bun's outer test deadline. Bound it so
// cleanup runs and the failure names the exact compiler/runtime command.
//
// One blanket bound cannot do that. Packing, a cold `npm install` and a cold
// `tsc` are minutes apart in cost, so a bound sized for the quick children
// kills the slow ones mid-flight: a shared 45s budget SIGKILLed `tsc` on a
// loaded CI runner and reported an empty failure, because `killSignal` leaves
// no output to name. Each child now gets the budget its own work needs, and
// every one of them stays under the outer deadline, so the bound that fires is
// always the one that names the command. Sibling packs size theirs the same
// way; see `packages/foldkit-zloz-cli/test/package.test.ts`.
const options = {
  cwd: root,
  maxBuffer: 5 * 1024 * 1024,
  timeout: 30_000,
  killSignal: 'SIGKILL' as const,
};
/** `options` carrying the budget this child's own work needs, in `cwd`. */
const bound = (timeout: number, cwd: string = root) => ({ ...options, timeout, cwd });

test('packed adapter installs in a clean npm consumer and runs in Node and Bun', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'foldkit-zloz-force-consumer-'));
  // Native process fixture cleanup must run even when npm or TypeScript fails.
  // oxlint-disable-next-line linteffect/no-try-catch
  try {
    await exec('bun', ['run', '--filter', manifest.name, 'pack:check'], bound(120_000));
    const force = path.join(
      root,
      'packages/foldkit-zloz-force/dist/pack',
      `opsydyn-foldkit-zloz-force-${manifest.version}.tgz`,
    );
    for (const name of ['foldkit-zloz', 'foldkit-viz'])
      await exec(
        'bun',
        ['pm', 'pack', '--destination', directory],
        bound(60_000, path.join(root, 'packages', name)),
      );
    const core = path.join(directory, `opsydyn-foldkit-zloz-${coreManifest.version}.tgz`);
    const viz = path.join(directory, `opsydyn-foldkit-viz-${vizManifest.version}.tgz`);
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    await exec(
      'npm',
      [
        'install',
        '--offline',
        '--cache',
        path.join(directory, 'npm-cache'),
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        core,
        viz,
        force,
      ],
      bound(120_000, directory),
    );
    for (const name of ['astro', 'react', 'foldkit', 'effect', 'elkjs'])
      expect(existsSync(path.join(directory, 'node_modules', name))).toBe(false);

    const source = `import { createEditor, layoutRequest, applyLayout } from '@opsydyn/foldkit-zloz';
import { createForceLayout } from '@opsydyn/foldkit-zloz-force';
import { supportsForceLayout } from '@opsydyn/foldkit-zloz-force/eligibility';
const state = createEditor({ nodes: [
  { id: 'a', label: 'A', position: {x:0,y:0}, size: {width:240,height:100}, ports: [] },
  { id: 'b', label: 'B', position: {x:0,y:0}, size: {width:100,height:80}, ports: [] }
], edges: [] });
if (!supportsForceLayout(state.graph)) throw new Error('Missing eligibility export');
const request = layoutRequest(state, 'consumer');
const result = await createForceLayout()(request);
const arranged = applyLayout(state, request, result);
if (arranged.past.length !== 1 || result.positions.length !== 2) throw new Error('Layout failed');
console.log('force-consumer-ok');
`;
    const consumer = path.join(directory, 'consumer.ts');
    await writeFile(consumer, source);
    const tsc = path.join(root, 'packages/foldkit-zloz-force/node_modules/.bin/tsc');
    for (const resolution of ['Bundler', 'NodeNext']) {
      console.info(`[force-consumer] TypeScript ${resolution}`);
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
        bound(120_000, directory),
      );
    }
    console.info('[force-consumer] TypeScript emit');
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
      bound(120_000, directory),
    );
    for (const runtime of ['node', 'bun']) {
      console.info(`[force-consumer] ${runtime} execution`);
      const result = await exec(
        runtime,
        [path.join(directory, 'compiled/consumer.js')],
        bound(30_000, directory),
      );
      expect(result.stdout.trim()).toBe('force-consumer-ok');
    }
    const contents = await exec('tar', ['-tzf', force], options);
    for (const file of ['LICENSE', 'README.md', 'CHANGELOG.md', 'THIRD-PARTY-NOTICES.md'])
      expect(contents.stdout).toContain(`package/${file}`);
    expect(contents.stdout).not.toMatch(/package\/(src|test|node_modules|dist\/pack)\//);
    const packedManifest = await readFile(
      path.join(directory, 'node_modules/@opsydyn/foldkit-zloz-force/package.json'),
      'utf8',
    );
    expect(packedManifest).not.toMatch(/workspace:|catalog:/);
    expect(JSON.parse(packedManifest).dependencies['@opsydyn/foldkit-viz']).toBe(
      vizManifest.version,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  // The whole pack normally lands well inside a minute. This outer deadline is
  // only the backstop for a stall no child bound caught, so it leaves room for
  // one slow child to hit its own budget and name itself first.
}, 300_000);
