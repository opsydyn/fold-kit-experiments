// Runs root package scripts the way CI does, on exactly the commit at HEAD:
// after a frozen install, with CI set, one after another, stopping at the first
// failure.
//
// When this checkout matches HEAD (nothing uncommitted, nothing untracked), the
// scripts run here, so moon's cache keeps the run to what changed: builds in
// dist/ are moon outputs, rebuilt or restored to match the sources. Otherwise,
// or with --fresh, they run in a fresh checkout of HEAD with an empty moon
// cache, as in CI, so nothing in this folder can hide a failure.
//
// A fresh checkout gets its own cache because moon's cache also holds the
// project graph with absolute paths, so sharing one between checkouts breaks.
//
//   bun tools/ci-local.ts [--fresh] [script...]   (default: ci:check)
//
// It also warns when the local Bun or Node.js differs from the versions CI uses.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
// `bun run ci:clean -- <script>` passes the `--` through.
const named = args.filter((arg) => arg !== '--fresh' && arg !== '--');
const scripts = named.length > 0 ? named : ['ci:check'];
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

const git = (gitArgs: ReadonlyArray<string>): string =>
  spawnSync('git', gitArgs, { cwd: repo, encoding: 'utf8' }).stdout.trim();
const head = git(['rev-parse', '--short', 'HEAD']);
// Untracked files count: moon hashes them and tools read them, but CI never sees them.
const differences = git(['status', '--porcelain']);
const inPlace = !fresh && differences === '';
if (!fresh && !inPlace)
  console.warn(
    'ci-local: this checkout differs from HEAD (uncommitted or untracked files), so checking ' +
      'a fresh checkout from an empty cache, which takes longer. Commit or stash to run cached.',
  );

// moon exports MOON_WORKSPACE_ROOT and the rest to its tasks, so when this runs as
// a moon task (the pre-push hook), a moon it starts would inherit them and run
// against the wrong checkout. Drop them, then set what the workflow sets: moon
// compares against HEAD, as CI's shallow checkout has no main.
const inherited = Object.entries(process.env).filter(([name]) => !name.startsWith('MOON_'));
const env = { ...Object.fromEntries(inherited), CI: 'true', MOON_BASE: 'HEAD' };

/** Runs one command in a step, reporting how long it took. */
const run = (label: string, command: string, commandArgs: ReadonlyArray<string>, cwd: string) => {
  const start = performance.now();
  console.log(`\nci-local ▸ ${label}`);
  const ok = spawnSync(command, commandArgs, { cwd, env, stdio: 'inherit' }).status === 0;
  const seconds = ((performance.now() - start) / 1000).toFixed(0);
  console.log(`ci-local ${ok ? '✓' : '✗'} ${label} (${seconds} s)`);
  return ok;
};

const checkout = inPlace ? repo : mkdtempSync(join(tmpdir(), 'ci-local-'));
/** spawnSync reports failures rather than throwing, so only an interrupt skips the cleanup. */
const removeCheckout = (): void => {
  if (inPlace) return;
  spawnSync('git', ['worktree', 'remove', '--force', checkout], { cwd: repo });
  rmSync(checkout, { recursive: true, force: true });
};
process.once('SIGINT', () => {
  removeCheckout();
  process.exit(130);
});

type Step = readonly [label: string, perform: () => boolean];
const checkOut: Step = [
  `check out ${head}`,
  () => run(`check out ${head}`, 'git', ['worktree', 'add', '--detach', checkout, 'HEAD'], repo),
];
const steps: ReadonlyArray<Step> = [
  ...(inPlace ? [] : [checkOut]),
  [
    'bun install --frozen-lockfile',
    () => run('bun install --frozen-lockfile', 'bun', ['install', '--frozen-lockfile'], checkout),
  ],
  ...scripts.map((script): Step => [script, () => run(script, 'bun', ['run', script], checkout)]),
];
const failed = steps.find(([, perform]) => !perform())?.[0];
removeCheckout();

const where = inPlace ? `HEAD (${head}), here and cached` : `a fresh checkout of ${head}`;
if (failed !== undefined) {
  console.error(`\nci-local: ${failed} failed on ${where}, as it would in CI.`);
  process.exit(1);
}
console.log(`\nci-local: ${scripts.join(', ')} passed on ${where}.`);
