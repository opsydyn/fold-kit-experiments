// Runs moon tasks the way CI does: in a fresh checkout of HEAD, after a frozen
// install, with CI set, one task after another, stopping at the first failure.
//
// A checkout that has been worked in hides failures CI would see: a built
// dist/ that a typecheck quietly reads, an untracked file a test imports, a
// lockfile that no longer matches. This checks the commit, not the folder.
// Uncommitted changes are not included, which is also what a push sends.
//
//   bun tools/ci-local.ts [task...]   (default: check, the whole CI check job)
//
// It also warns when the local Bun or Node.js differs from the versions CI uses.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tasks = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['check'];
const repo = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim();

interface Manifest {
  readonly packageManager?: string;
}
const manifest: Manifest = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
const ciBun = manifest.packageManager?.replace(/^bun@/, '');
const ciNode = /node-version:\s*(\d+)/.exec(
  readFileSync(join(repo, '.github', 'workflows', 'ci.yml'), 'utf8'),
)?.[1];
if (ciBun !== undefined && Bun.version !== ciBun)
  console.warn(`ci-local: Bun ${Bun.version} here, ${ciBun} in CI.`);
if (ciNode !== undefined && process.versions.node.split('.')[0] !== ciNode)
  console.warn(`ci-local: Node.js ${process.versions.node} here, ${ciNode} in CI.`);

const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], {
  cwd: repo,
  encoding: 'utf8',
}).stdout.trim();
if (dirty !== '') console.warn('ci-local: uncommitted changes are not included; checking HEAD.');

const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).stdout.trim();
const checkout = mkdtempSync(join(tmpdir(), 'ci-local-'));
// As in the workflow: moon compares against HEAD, since CI's shallow checkout has no main.
const env = { ...process.env, CI: 'true', MOON_BASE: 'HEAD' };
const run = (label: string, command: string, args: ReadonlyArray<string>, cwd: string): boolean => {
  const start = performance.now();
  console.log(`\nci-local ▸ ${label}`);
  const ok = spawnSync(command, args, { cwd, env, stdio: 'inherit' }).status === 0;
  const seconds = ((performance.now() - start) / 1000).toFixed(0);
  console.log(`ci-local ${ok ? '✓' : '✗'} ${label} (${seconds} s)`);
  return ok;
};

/** spawnSync reports failures rather than throwing, so only an interrupt skips the cleanup. */
const removeCheckout = (): void => {
  spawnSync('git', ['worktree', 'remove', '--force', checkout], { cwd: repo });
  rmSync(checkout, { recursive: true, force: true });
};
process.once('SIGINT', () => {
  removeCheckout();
  process.exit(130);
});

type Step = readonly [label: string, command: string, args: ReadonlyArray<string>, cwd: string];
const steps: ReadonlyArray<Step> = [
  [`check out ${head}`, 'git', ['worktree', 'add', '--detach', checkout, 'HEAD'], repo],
  ['bun install --frozen-lockfile', 'bun', ['install', '--frozen-lockfile'], checkout],
  ...tasks.map((task): Step => [`root:${task}`, 'bun', ['moon', 'run', `root:${task}`], checkout]),
];
const failed = steps.find(([label, command, args, cwd]) => !run(label, command, args, cwd))?.[0];
removeCheckout();

if (failed !== undefined) {
  console.error(`\nci-local: ${failed} failed on ${head}, as it would in CI.`);
  process.exit(1);
}
console.log(`\nci-local: ${tasks.join(', ')} passed on a fresh checkout of ${head}.`);
