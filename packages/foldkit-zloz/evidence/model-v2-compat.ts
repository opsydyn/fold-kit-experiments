/** Canonical v2 compatibility against actual pinned pre-canonical source. No simulated old parser. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  captureModelDocumentV2,
  parseConnectionDocument,
  parseModelDocument,
  parseModelDocumentV2,
  parseEditions,
  planModelDocumentV2Downgrade,
  serializeEditionsV2,
  serializeModelDocument,
  serializeModelDocumentV2,
  upgradeEditionsToV2,
  upgradeModelDocumentToV2,
} from '../src/index';

const root = path.resolve(import.meta.dir, '../../..');
const baseline = '36de608a';
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const fixture = (name: string) =>
  readFile(path.join(root, 'packages/foldkit-zloz/test/fixtures', name), 'utf8');
const directory = await mkdtemp(path.join(tmpdir(), 'zloz-model-v2-compat-'));
const qualify = async () => {
  for (const file of git(
    'ls-tree',
    '-r',
    '--name-only',
    baseline,
    'packages/foldkit-zloz/src',
  ).split('\n')) {
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
  const bytes = new Uint8Array(await bundle.arrayBuffer());
  const oldPath = path.join(directory, 'old.mjs');
  await writeFile(oldPath, bytes);
  const legacyModel = await fixture('model-v1-strict.json');
  const legacyEditions = await fixture('editions-v1-strict.json');
  const mixed = parseModelDocumentV2(await fixture('model-v2-modes.json'));
  const strict = upgradeModelDocumentToV2(parseModelDocument(legacyModel));
  const loose = captureModelDocumentV2({
    ...mixed,
    snapshot: parseConnectionDocument(await fixture('connection-v2-loose.json')),
  });
  const downgrade = planModelDocumentV2Downgrade(mixed);
  assert(downgrade.type === 'reviewable');
  const payload = {
    legacyModel,
    legacyEditions,
    strictModel: serializeModelDocumentV2(strict),
    looseModel: serializeModelDocumentV2(loose),
    mixedModel: serializeModelDocumentV2(mixed),
    strictEditions: serializeEditionsV2(upgradeEditionsToV2(parseEditions(legacyEditions))),
    looseEditions: await fixture('editions-v2-modes.json'),
    downgraded: serializeModelDocument(downgrade.document),
  };
  const input = path.join(directory, 'fixtures.json');
  await writeFile(input, JSON.stringify(payload));
  const driver = path.join(directory, 'driver.mjs');
  await writeFile(
    driver,
    `import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const old=await import(${JSON.stringify(pathToFileURL(oldPath).href)});
const data=JSON.parse(await readFile(process.argv[2],'utf8'));
const expected=JSON.parse(data.legacyModel).document;
assert.deepEqual(old.parseModelDocument(data.legacyModel),expected);
assert.deepEqual(old.parseEditions(data.legacyEditions),JSON.parse(data.legacyEditions).editions);
for(const key of ['strictModel','looseModel','mixedModel'])assert.throws(()=>old.parseModelDocument(data[key]));
for(const key of ['strictEditions','looseEditions'])assert.throws(()=>old.parseEditions(data[key]));
assert.deepEqual(old.parseModelDocument(data.downgraded),expected);
const before=old.createModelEditor(old.parseModelDocument(data.legacyModel));
const changed=old.updateEditor(before,{type:'NodeAdded',node:{id:'new',label:'Legacy edit',position:{x:0,y:0},size:{width:100,height:100},ports:[]}});
assert.equal(changed.past.length,1);assert.deepEqual(old.updateEditor(changed,{type:'UndoPressed'}).graph,before.graph);
console.log(JSON.stringify({runtime:process.versions.bun?'bun':'node',result:'passed',checks:['literal v1 model and origin remain readable','literal v1 editions remain readable','strict loose and mixed canonical v2 models reject','strict and loose v2 edition archives reject','explicit whole-model v1 downgrade remains readable','legacy model editing and one Undo remain unchanged']}));
`,
  );
  const results = ['node', 'bun'].map((runtime) =>
    JSON.parse(execFileSync(runtime, [driver, input], { encoding: 'utf8' })),
  );
  const result = {
    result: 'passed',
    baseline: git('rev-parse', baseline),
    measuredParent: git('rev-parse', 'HEAD'),
    oldBundleSha256: createHash('sha256').update(bytes).digest('hex'),
    strictModelSha256: createHash('sha256').update(payload.strictModel).digest('hex'),
    looseModelSha256: createHash('sha256').update(payload.looseModel).digest('hex'),
    results,
    limitation:
      'Actual pinned pre-canonical source under local Node/Bun; not every historical artifact, current CI, adapter or hosted qualification.',
  };
  await writeFile(
    path.join(root, 'packages/foldkit-zloz/evidence/model-v2-compat.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(JSON.stringify(result));
};
await qualify().finally(() => rm(directory, { recursive: true, force: true }));
