import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import manifest from '../package.json';
import { packReleasedCore } from './packed-core';

const exec = promisify(execFile);
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(here, 'node_modules/typescript/bin/tsc');
async function scanEntry(
  directory: string,
  entry: string,
  seen = new Set<string>(),
): Promise<void> {
  const file = path.resolve(directory, entry);
  if (seen.has(file)) return;
  seen.add(file);
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(
    /(?:from\s+|import\s*(?:\(|(?=["'])))\s*["']([^"']+)["']/gu,
  )) {
    const specifier = match[1];
    if (!specifier) continue;
    if (specifier.startsWith('.'))
      await scanEntry(
        path.dirname(file),
        file.endsWith('.d.mts') ? specifier.replace(/\.mjs$/u, '.d.mts') : specifier,
        seen,
      );
    else expect(specifier).toBe('@opsydyn/foldkit-zloz');
  }
}
test('packed portable entry has no SDK/Effect runtime or type imports; SDK entry is independently qualified', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'zloz-alchemy-package-'));
  // oxlint-disable-next-line linteffect/no-try-catch -- The test owns this new temporary consumer and removes only that directory on all outcomes.
  try {
    await scanEntry(path.join(here, 'dist'), 'index.mjs');
    await scanEntry(path.join(here, 'dist'), 'index.d.mts');
    const core = await packReleasedCore(dir);
    await exec('bun', ['pm', 'pack', '--destination', dir], { cwd: here });
    expect(manifest.private).toBe(true);
    const adapter = path.join(dir, `opsydyn-foldkit-zloz-alchemy-${manifest.version}.tgz`);
    const packedManifest = JSON.parse(
      (await exec('tar', ['-xOf', adapter, 'package/package.json'])).stdout,
    );
    expect(packedManifest.peerDependencies['@opsydyn/foldkit-zloz']).toBe(
      manifest.peerDependencies['@opsydyn/foldkit-zloz'],
    );
    await writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    await exec('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', core, adapter], {
      cwd: dir,
      maxBuffer: 5e6,
    });
    for (const name of ['@alchemy.run/domain', 'alchemy', 'effect', 'foldkit', 'react'])
      expect(existsSync(path.join(dir, 'node_modules', name))).toBe(false);
    await cp(path.join(here, 'test/fixtures/bank.json'), path.join(dir, 'bank.json'));
    await writeFile(
      path.join(dir, 'portable.ts'),
      `import {projectAlchemyDescriptor,decodeAlchemyDescriptor,serializeAlchemyDescriptor,resolveAlchemyFindingNavigator,resolveAlchemyFindingReveal} from '@opsydyn/foldkit-zloz-alchemy';
import {createEditor,updateEditor,updateHistoryReview} from '@opsydyn/foldkit-zloz';
const value=decodeAlchemyDescriptor(${await readFile(path.join(here, 'test/fixtures/bank.json'), 'utf8')});
const plan=projectAlchemyDescriptor(JSON.parse(serializeAlchemyDescriptor(value)));
if(plan.type!=='reviewable'||plan.nativeReadModels.length!==1||plan.nativeConsumption.length!==1||plan.coverage.length!==23)throw new Error('Portable entry failed');
const preview=updateEditor(createEditor(plan.graph,{readOnly:true}),{type:'SurfaceMeasured',size:{width:900,height:600}});
const item=resolveAlchemyFindingNavigator(plan,preview,{scope:'packed/1'}).entries.find(e=>e.label==='Ledger (stream)');
if(!item?.request)throw new Error('Missing finding navigation');
const reveal=resolveAlchemyFindingReveal(plan,preview,item.request,{scope:'packed/1'});
if(reveal.type!=='ready')throw new Error('Missing reveal recipe');
const moved=reveal.events.reduce((review,event)=>updateHistoryReview(review,event),{editionId:'packed',editor:preview});
if(moved.editor.selectedNodes[0]!=='example%2Fbank/Bank/stream/Ledger'||moved.editor.graph!==preview.graph||moved.editor.past.length!==0)throw new Error('Reveal mutated source');
console.log('portable-ok');`,
    );
    for (const [module, resolution] of [
      ['ESNext', 'Bundler'],
      ['NodeNext', 'NodeNext'],
    ] as const)
      await exec(
        'node',
        [
          tsc,
          '--ignoreConfig',
          '--strict',
          '--exactOptionalPropertyTypes',
          '--skipLibCheck',
          '--target',
          'ES2022',
          '--module',
          module,
          '--moduleResolution',
          resolution,
          'portable.ts',
        ],
        { cwd: dir },
      );
    for (const runtime of ['node', 'bun'])
      expect((await exec(runtime, ['portable.js'], { cwd: dir })).stdout.trim()).toBe(
        'portable-ok',
      );
    await exec(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '@alchemy.run/domain@2.0.0-beta.85',
        'alchemy@2.0.0-beta.85',
        'effect@4.1.0',
      ],
      { cwd: dir, maxBuffer: 5e6 },
    );
    const fixture = (await readFile(path.join(here, 'test/fixtures/model.ts'), 'utf8')).replace(
      "'../../src/descriptor'",
      "'@opsydyn/foldkit-zloz-alchemy'",
    );
    await writeFile(path.join(dir, 'model.ts'), fixture);
    await writeFile(
      path.join(dir, 'sdk.ts'),
      `import {inspectAlchemyModel,projectAlchemyModel} from '@opsydyn/foldkit-zloz-alchemy/domain';
import {projectAlchemyDescriptor} from '@opsydyn/foldkit-zloz-alchemy';
import {Bank,calls} from './model.js';
const options={namespace:'example/bank',revision:'v1',declaredPackageVersion:'2.0.0-beta.85'};
const inspected=inspectAlchemyModel(Bank,options);if(inspected.type!=='inspected')throw new Error('SDK inspection failed');
const a=projectAlchemyModel(Bank,options),b=projectAlchemyDescriptor(inspected.descriptor);
if(a.type!=='reviewable'||JSON.stringify(a)!==JSON.stringify(b)||calls()!==0)throw new Error('SDK composition failed');console.log('sdk-ok');`,
    );
    for (const [module, resolution] of [
      ['ESNext', 'Bundler'],
      ['NodeNext', 'NodeNext'],
    ] as const)
      await exec(
        'node',
        [
          tsc,
          '--ignoreConfig',
          '--strict',
          '--exactOptionalPropertyTypes',
          '--skipLibCheck',
          '--target',
          'ES2022',
          '--module',
          module,
          '--moduleResolution',
          resolution,
          'sdk.ts',
          'model.ts',
        ],
        { cwd: dir },
      );
    for (const runtime of ['node', 'bun'])
      expect((await exec(runtime, ['sdk.js'], { cwd: dir })).stdout.trim()).toBe('sdk-ok');
    for (const name of ['foldkit', 'react'])
      expect(existsSync(path.join(dir, 'node_modules', name))).toBe(false);
    for (const [file, diagnostic] of [
      ['omitted-read.ts', "The types of 'definition.read' are incompatible"],
      ['stateless-view.ts', "Types of property 'state' are incompatible"],
    ] as const) {
      await cp(path.join(here, 'test/negative', file), path.join(dir, file));
      const probe = await exec(
        'node',
        [
          tsc,
          '--ignoreConfig',
          '--strict',
          '--exactOptionalPropertyTypes',
          '--skipLibCheck',
          '--noEmit',
          '--target',
          'ES2022',
          '--module',
          'NodeNext',
          file,
        ],
        { cwd: dir },
      ).then(
        () => ({ stdout: 'unexpected success', code: 0 }),
        (error: { stdout: string; code: number }) => error,
      );
      expect(probe.code).toBe(2);
      expect(probe.stdout).toContain(diagnostic);
      expect(probe.stdout).toContain('exactOptionalPropertyTypes');
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 180000);
