/** Qualify new v2 documents against actual pinned pre-mode source, not a simulated old reader. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  captureConnectionDocument,
  parseConnectionDocument,
  parseSnapshot,
  serializeConnectionDocument,
  serializeSnapshot,
  planConnectionDocumentDowngrade,
} from '../src/index';

const root = path.resolve(import.meta.dir, '../../..');
const baseline = 'f9052013';
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const directory = await mkdtemp(path.join(tmpdir(), 'zloz-connection-v2-compat-'));
const qualify = async () => {
  const files = git('ls-tree', '-r', '--name-only', baseline, 'packages/foldkit-zloz/src').split(
    '\n',
  );
  for (const file of files) {
    const target = path.join(directory, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root }));
  }
  const built = await Bun.build({
    entrypoints: [path.join(directory, 'packages/foldkit-zloz/src/index.ts')],
    outdir: path.join(directory, 'built'),
    target: 'node',
    format: 'esm',
  });
  assert.equal(built.success, true, String(built.logs));
  const bundle = built.outputs[0];
  assert(bundle);
  const oldBytes = await bundle.arrayBuffer();
  const oldPath = path.join(directory, 'old.mjs');
  await writeFile(oldPath, new Uint8Array(oldBytes));
  const legacy = await readFile(
    path.join(root, 'packages/foldkit-zloz/test/fixtures/connection-v1-strict.json'),
    'utf8',
  );
  const loose = parseConnectionDocument(
    await readFile(
      path.join(root, 'packages/foldkit-zloz/test/fixtures/connection-v2-loose.json'),
      'utf8',
    ),
  );
  const strict = captureConnectionDocument(parseSnapshot(legacy));
  const downgrade = planConnectionDocumentDowngrade(strict);
  assert(downgrade.type === 'reviewable');
  const payload = {
    legacy,
    strict: serializeConnectionDocument(strict),
    loose: serializeConnectionDocument(loose),
    downgraded: serializeSnapshot(downgrade.snapshot),
  };
  const input = path.join(directory, 'fixtures.json');
  await writeFile(input, JSON.stringify(payload));
  const driver = path.join(directory, 'driver.mjs');
  await writeFile(
    driver,
    `import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const old = await import(${JSON.stringify(pathToFileURL(oldPath).href)});
const data = JSON.parse(await readFile(process.argv[2], 'utf8'));
const expected = JSON.parse(data.legacy);
assert.deepEqual(old.parseSnapshot(data.legacy), {graph:expected.graph,viewport:expected.viewport});
assert.throws(()=>old.parseGraph(data.strict));
assert.throws(()=>old.parseSnapshot(data.loose));
assert.throws(()=>old.createEditor(JSON.parse(data.loose).graph));
assert.deepEqual(old.parseSnapshot(data.downgraded), {graph:expected.graph,viewport:expected.viewport});
const before=old.createEditor(expected.graph);
const changed=old.updateEditor(before,{type:'NodeLabelChanged',id:'a',label:'Edited by legacy'});
assert.equal(changed.past.length,1);
assert.deepEqual(old.updateEditor(changed,{type:'UndoPressed'}).graph,before.graph);
console.log(JSON.stringify({runtime:process.versions.bun?'bun':'node',result:'passed',checks:['literal v1 remains readable','v2 strict rejects in old graph codec','v2 loose rejects in old snapshot codec','loose payload cannot enter old editor','explicit downgrade remains readable','legacy editing and one Undo unchanged']}));
`,
  );
  const results = ['node', 'bun'].map((runtime) =>
    JSON.parse(execFileSync(runtime, [driver, input], { encoding: 'utf8' })),
  );
  const result = {
    result: 'passed',
    baseline: git('rev-parse', baseline),
    measuredParent: git('rev-parse', 'HEAD'),
    oldBundleSha256: createHash('sha256').update(new Uint8Array(oldBytes)).digest('hex'),
    looseWireSha256: createHash('sha256').update(payload.loose).digest('hex'),
    results,
    limitation:
      'Pinned pre-mode code and local Node/Bun only; no universal older-artifact or model/edition/adapter v2 support is claimed.',
  };
  await writeFile(
    path.join(root, 'packages/foldkit-zloz/evidence/connection-v2-compat.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(JSON.stringify(result));
};
await qualify().finally(() => rm(directory, { recursive: true, force: true }));
