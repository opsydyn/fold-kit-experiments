// Runs root package scripts the way CI does: in a fresh checkout of HEAD, after a
// frozen install, with CI set, one after another, stopping at the first failure.
//
// A checkout that has been worked in hides failures CI would see: a built
// dist/ that a typecheck quietly reads, an untracked file a test imports, a
// lockfile that no longer matches. This checks the commit, not the folder.
// Uncommitted changes are not included, which is also what a push sends.
//
// The fresh checkout uses this checkout's moon cache (.moon/cache, linked), so
// only tasks whose inputs differ from an earlier run here run again, and cached
// builds are restored into it. Pass --no-cache to run everything from an empty
// cache, as CI does. (moon 2.5's sharedWorktreeCache does not share between
// `git worktree add` checkouts, hence the link.)
//
//   bun tools/ci-local.ts [--no-cache] [script...]   (default: ci:check)
//
// It also warns when the local Bun or Node.js differs from the versions CI uses.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const noCache = args.includes('--no-cache');
// `bun run ci:clean -- --no-cache` passes the `--` through.
const named = args.filter((arg) => arg !== '--no-cache' && arg !== '--');
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
// moon exports MOON_WORKSPACE_ROOT and the rest to its tasks, so when this runs as
// a moon task (the pre-push hook), a moon started in the fresh checkout would
// inherit them and run its tasks back in this checkout. Drop them, then set what
// the workflow sets: moon compares against HEAD, as CI's shallow checkout has no main.
const inherited = Object.entries(process.env).filter(([name]) => !name.startsWith('MOON_'));
const env = {
  ...Object.fromEntries(inherited),
  CI: 'true',
  MOON_BASE: 'HEAD',
  MOON_CACHE: noCache ? 'off' : 'read-write',
};

/** Runs one command in a step, reporting how long it took. */
const run = (label: string, command: string, args: ReadonlyArray<string>, cwd: string): boolean => {
  const start = performance.now();
  console.log(`\nci-local ▸ ${label}`);
  const ok = spawnSync(command, args, { cwd, env, stdio: 'inherit' }).status === 0;
  const seconds = ((performance.now() - start) / 1000).toFixed(0);
  console.log(`ci-local ${ok ? '✓' : '✗'} ${label} (${seconds} s)`);
  return ok;
};

/** Points the fresh checkout's moon cache at this checkout's. */
const linkCache = (): boolean => {
  const cache = join(repo, '.moon', 'cache');
  mkdirSync(cache, { recursive: true });
  mkdirSync(join(checkout, '.moon'), { recursive: true });
  symlinkSync(cache, join(checkout, '.moon', 'cache'));
  console.log(`\nci-local ✓ moon cache linked from ${cache}`);
  return true;
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

type Step = readonly [label: string, perform: () => boolean];
const steps: ReadonlyArray<Step> = [
  [
    `check out ${head}`,
    () => run(`check out ${head}`, 'git', ['worktree', 'add', '--detach', checkout, 'HEAD'], repo),
  ],
  ...(noCache ? [] : [['link the moon cache', linkCache] satisfies Step]),
  [
    'bun install --frozen-lockfile',
    () => run('bun install --frozen-lockfile', 'bun', ['install', '--frozen-lockfile'], checkout),
  ],
  ...scripts.map((script): Step => [script, () => run(script, 'bun', ['run', script], checkout)]),
];
const failed = steps.find(([, perform]) => !perform())?.[0];
removeCheckout();

if (failed !== undefined) {
  console.error(`\nci-local: ${failed} failed on ${head}, as it would in CI.`);
  process.exit(1);
}
console.log(
  `\nci-local: ${scripts.join(', ')} passed on a fresh checkout of ${head}${noCache ? ', from an empty cache' : ''}.`,
);
