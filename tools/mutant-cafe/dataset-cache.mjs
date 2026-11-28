import { spawnSync } from 'node:child_process';
// Replay package-owned mutations with the web workspace's migrated cache tests.
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const pkg = join(root, 'packages/dataset-explorer');
const web = join(root, 'apps/web');
const test = 'src/apps/dataset-explorer/update.test.ts';
const file = 'src/query.ts';
const output = resolve(process.argv[2]);
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'dataset-cache-'));
process.on('exit', () => rmSync(scratch, { recursive: true, force: true }));
const source = readFileSync(join(pkg, file), 'utf8');
const tool = join(import.meta.dirname, 'node_modules/.bin/mutant-cafe');
const list = spawnSync(tool, ['--file', file, '--list', '--format', 'json'], {
  cwd: pkg,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
if (list.status !== 0) throw new Error('Candidate discovery failed');
const generated = JSON.parse(list.stdout).mutants.filter((m) => m.functionName === 'datasetKey');
const ids = generated
  .map((m) => m.id)
  .sort()
  .join(',');
if (ids !== '6698fec9e622251cab98e20b,80e8c62ae302486a476327cc') {
  throw new Error('The pinned datasetKey candidates changed: ' + ids);
}

const { startOffset, endOffset } = generated[0].replacement;
if (source.slice(startOffset, endOffset) !== "`${args.source ?? 'api'}:${args.dataset}`") {
  throw new Error('Review the station-only replacement against the current key');
}
const custom = {
  ...generated[0],
  id: createHash('sha256')
    .update('packages/dataset-explorer:datasetKey:station-only:v1')
    .digest('hex')
    .slice(0, 24),
  genre: 'CustomStationOnly',
  description:
    'Custom replay: use the station alone as the cache key, sharing API and fixture snapshots.',
  replacement: { startOffset, endOffset, text: 'args.dataset' },
};

const fixture = join(scratch, 'package');
cpSync(join(pkg, 'src'), join(fixture, 'src'), { recursive: true });
symlinkSync(join(pkg, 'node_modules'), join(fixture, 'node_modules'), 'dir');
cpSync(join(web, test), join(scratch, test));
symlinkSync(join(web, 'node_modules'), join(scratch, 'node_modules'), 'dir');
cpSync(join(web, 'package.json'), join(scratch, 'package.json'));
writeFileSync(
  join(scratch, 'vitest.config.ts'),
  `
  import config from ${JSON.stringify(join(web, 'vitest.config.ts'))};
  import { mergeConfig } from 'vitest/config';
  export default mergeConfig(config, { resolve: { alias: { '@opsydyn/dataset-explorer': ${JSON.stringify(join(fixture, 'src'))} } } });
`,
);

function runSuite(label) {
  const reportPath = join(scratch, label + '.json');
  const run = spawnSync(
    join(web, 'node_modules/.bin/vitest'),
    ['run', test, '--reporter=json', '--outputFile', reportPath],
    { cwd: scratch, stdio: 'inherit', timeout: 120_000 },
  );
  if (run.error || ![0, 1].includes(run.status)) throw new Error('Vitest did not finish: ' + label);
  cpSync(reportPath, join(output, label + '.json'));
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const assertions = report.testResults.flatMap((s) => s.assertionResults);
  const failed = assertions.filter((a) => a.status === 'failed');
  if (
    !assertions.length ||
    assertions.some((a) => !['passed', 'failed'].includes(a.status)) ||
    report.testResults.length !== 1 ||
    Boolean(run.status) !== Boolean(failed.length) ||
    (failed.length > 0 &&
      !failed.some((a) =>
        a.failureMessages.some((message) => message.startsWith('AssertionError:')),
      ))
  ) {
    throw new Error('Incomplete run or non-assertion failure: ' + label);
  }
  return { names: assertions.map((a) => a.fullName).sort(), failed: failed.map((a) => a.fullName) };
}

const baseline = runSuite('control');
if (baseline.failed.length) throw new Error('The unmodified cache tests failed');
const results = [];
for (const mutant of [...generated, custom]) {
  const edit = mutant.replacement;
  writeFileSync(
    join(fixture, file),
    source.slice(0, edit.startOffset) + edit.text + source.slice(edit.endOffset),
  );
  const observed = runSuite(mutant.id);
  if (JSON.stringify(observed.names) !== JSON.stringify(baseline.names))
    throw new Error('Test selection changed');
  const outcome = observed.failed.length ? 'caught' : 'missed';
  results.push({ mutant, outcome, failingTests: observed.failed });
  console.log(mutant.id, mutant.description, outcome);
}
writeFileSync(
  join(output, 'outcomes.json'),
  JSON.stringify(
    {
      schemaVersion: 2,
      root: pkg,
      selected: results.length,
      budgetSkipped: 0,
      results,
    },
    null,
    2,
  ),
);
