/** Local qualification against actual pinned pre-contract code, not a simulated legacy codec. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseGraph } from '../packages/foldkit-flow/src/index';

const root = path.resolve(import.meta.dir, '..');
const baseline = 'ce978a2';
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const directory = await mkdtemp(path.join(tmpdir(), 'flow-architecture-legacy-'));
const qualify = async () => {
  const files = git('ls-tree', '-r', '--name-only', baseline, 'packages/foldkit-flow/src').split(
    '\n',
  );
  for (const file of files) {
    const target = path.join(directory, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root }));
  }
  const built = await Bun.build({
    entrypoints: [path.join(directory, 'packages/foldkit-flow/src/index.ts')],
    outdir: path.join(directory, 'dist'),
    target: 'node',
    format: 'esm',
  });
  assert.equal(built.success, true, String(built.logs));
  const bundle = built.outputs[0]!;
  const old = await import(pathToFileURL(bundle.path).href);
  const fixture = await readFile(
    path.join(root, 'packages/foldkit-flow/test/fixtures/architecture-v1.json'),
    'utf8',
  );
  const expected = parseGraph(fixture);
  const graph = old.parseGraph(fixture);
  assert.deepEqual(graph, expected);
  let state = old.createEditor(graph);
  state = old.updateEditor(state, {
    type: 'NodeLabelChanged',
    id: 'store',
    label: 'Renamed by legacy',
  });
  state = old.updateEditor(state, { type: 'SelectionNudged', id: 'store', delta: { x: 5, y: 0 } });
  let exported = parseGraph(old.serializeGraph(state.graph));
  assert.equal(exported.nodes[0]?.label, 'Renamed by legacy');
  assert.equal(exported.nodes[0]?.position.x, 15);
  assert.deepEqual(exported.nodes[0]?.architecture, expected.nodes[0]?.architecture);
  assert.deepEqual(exported.nodes[0]?.appearance, expected.nodes[0]?.appearance);
  assert.deepEqual(exported.nodes[0]?.data, expected.nodes[0]?.data);
  state = old.updateEditor(state, { type: 'NodeSelected', id: 'store', additive: false });
  state = old.updateEditor(state, { type: 'CopyPressed' });
  state = old.updateEditor(state, { type: 'PastePressed' });
  exported = parseGraph(old.serializeGraph(state.graph));
  assert.equal(exported.nodes.length, 3);
  const duplicate = exported.nodes.find(
    (node) => node.id !== 'store' && node.architecture?.family === 'c4',
  );
  assert.ok(duplicate);
  assert.deepEqual(duplicate.architecture, expected.nodes[0]?.architecture);
  assert.deepEqual(duplicate.appearance, expected.nodes[0]?.appearance);
  assert.deepEqual(duplicate.data, expected.nodes[0]?.data);
  const undone = old.updateEditor(state, { type: 'UndoPressed' });
  assert.equal(parseGraph(old.serializeGraph(undone.graph)).nodes.length, 2);
  assert.deepEqual(old.parseGraph(old.serializeGraph(old.parseGraph(fixture))), expected);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        baseline: git('rev-parse', baseline),
        measuredParent: git('rev-parse', 'HEAD'),
        oldBundleSha256: createHash('sha256')
          .update(new Uint8Array(await bundle.arrayBuffer()))
          .digest('hex'),
        checks: [
          'literal new v1 document read by pinned old core',
          'legacy rename/move retain descriptors and host data',
          'legacy copy/paste retains descriptors and host data',
          'legacy Undo and export read by current core',
          'legacy codec round trip',
        ],
        limitation:
          'Old core retains descriptors as unknown fields; its renderer and geometry remain generic.',
      },
      null,
      2,
    ),
  );
};
await qualify().finally(() => rm(directory, { recursive: true, force: true }));
