// The pre-commit hook's check: the lint and format half of `bun run check`,
// on the staged files only, so it takes seconds.
//
// It runs oxfmt --check and oxlint on the staged files, the stricter package
// lint of any effect-three package they touch, and the catalog and skills
// checks, which read only manifests. It reads files from the working tree, so
// a file with unstaged changes is checked as it is on disk; the hook names
// such files. Run `bun run check:fix` to fix what it reports.
//
//   bun tools/pre-commit.ts   (run by the pre-commit hook through moon)

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  spawnSync('git', args, { encoding: 'utf8' })
    .stdout.split('\0')
    .filter((path) => path !== '');

/** Samples use the regular staged lint; only packages declaring a strict check get that extra step. */
export function stagedStrictChecks(
  staged: ReadonlyArray<string>,
  scriptsFor: (packageName: string) => Readonly<Record<string, string>>,
): ReadonlyArray<string> {
  return [
    ...new Set(
      staged.flatMap((path) => {
        const match = /^packages\/(effect-three[^/]*)\//.exec(path);
        return match?.[1] === undefined ? [] : [match[1]];
      }),
    ),
  ]
    .filter((name) => scriptsFor(name).check !== undefined)
    .sort();
}

if (import.meta.main) {
  const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);
  if (staged.length === 0) process.exit(0);

  const unstaged = new Set(git(['diff', '--name-only', '-z']));
  const partly = staged.filter((path) => unstaged.has(path));

  interface Step {
    readonly label: string;
    readonly command: string;
    readonly args: ReadonlyArray<string>;
  }

  const LINTED = /\.(?:[cm]?[jt]sx?|astro)$/;
  const linted = staged.filter((path) => LINTED.test(path));
  const effectThree = stagedStrictChecks(staged, (name) => {
    const manifest: { scripts?: Readonly<Record<string, string>> } = JSON.parse(
      readFileSync(`packages/${name}/package.json`, 'utf8'),
    );
    return manifest.scripts ?? {};
  });

  const steps: ReadonlyArray<Step> = [
    {
      label: 'oxfmt',
      command: 'bunx',
      args: ['oxfmt', '--check', '--no-error-on-unmatched-pattern', ...staged],
    },
    ...(linted.length === 0
      ? []
      : [{ label: 'oxlint', command: 'bunx', args: ['oxlint', ...linted] }]),
    ...effectThree.map((name) => ({
      label: `${name} lint`,
      command: 'bun',
      args: ['run', '--filter', `@opsydyn/${name}`, 'check'],
    })),
    { label: 'catalog', command: 'bun', args: ['tools/check-catalog.ts'] },
    { label: 'skills', command: 'bun', args: ['tools/check-skills.ts'] },
  ];

  const env = { ...process.env, NODE_OPTIONS: '--experimental-strip-types' };
  const failed = steps.filter(({ label, command, args }) => {
    const result = spawnSync(command, args, { encoding: 'utf8', env });
    const ok = result.status === 0;
    if (!ok) console.error(`\n✗ ${label}\n${result.stdout ?? ''}${result.stderr ?? ''}`);
    return !ok;
  });

  if (partly.length > 0)
    console.error(
      `Checked as on disk, with unstaged changes: ${partly.join(', ')}. Stage them to check what you commit.`,
    );
  if (failed.length > 0) {
    console.error(
      `pre-commit: ${failed.map(({ label }) => label).join(', ')} failed on ${staged.length} staged files. ` +
        'Fix with `bun run check:fix`, or commit with --no-verify to skip.',
    );
    process.exit(1);
  }
  console.log(
    `pre-commit: ${steps.map(({ label }) => label).join(', ')} passed on ${staged.length} staged files.`,
  );
}
