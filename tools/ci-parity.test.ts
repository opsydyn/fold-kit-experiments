import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

/**
 * CI and local checks share one definition: every CI step either prepares the
 * machine or runs a moon task from /moon.yml, which the git hooks and
 * `bun run ci:check` run too. These tests fail when the two drift apart.
 */

const root = join(import.meta.dir, '..');

interface Step {
  readonly run?: string;
}
interface Workflow {
  readonly env?: Readonly<Record<string, string>>;
  readonly jobs: Readonly<Record<string, { readonly steps: ReadonlyArray<Step> }>>;
}
interface MoonTask {
  readonly inputs?: ReadonlyArray<string>;
  readonly script?: string;
  readonly command?: string;
  readonly deps?: ReadonlyArray<string>;
}
interface MoonProject {
  readonly taskOptions?: {
    readonly cache?: boolean;
    readonly runInCI?: boolean | 'always' | 'affected' | 'only' | 'skip';
  };
  readonly tasks: Readonly<Record<string, MoonTask>>;
}
interface MoonWorkspace {
  readonly vcs: {
    readonly sync: boolean;
    readonly hooks: Readonly<Record<string, ReadonlyArray<string>>>;
  };
}

const yaml = async <A>(path: string): Promise<A> =>
  // SAFETY: these are the repository's own config files; the assertions below
  // fail on a missing or renamed field, which is the drift these tests catch.
  Bun.YAML.parse(await Bun.file(join(root, path)).text()) as A;
const ci = await yaml<Workflow>('.github/workflows/ci.yml');
const moon = await yaml<MoonProject>('moon.yml');
const workspace = await yaml<MoonWorkspace>('.moon/workspace.yml');

/** Steps that prepare the machine rather than check the code. */
const SETUP = [/^bun install --frozen-lockfile$/, /^bunx (?:--no-install )?playwright install /];
const MOON_TASK = /^bun moon run root:([\w-]+)$/;

describe('CI runs moon tasks', () => {
  const runs = Object.entries(ci.jobs).flatMap(([job, { steps }]) =>
    steps.flatMap(({ run }) => (run === undefined ? [] : [{ job, run: run.trim() }])),
  );

  test('every CI step prepares the machine or runs a moon task', () => {
    const other = runs.filter(
      ({ run }) => !SETUP.some((pattern) => pattern.test(run)) && !MOON_TASK.test(run),
    );
    expect(other).toEqual([]);
  });

  test('every task CI names is defined in moon.yml', () => {
    const named = runs.flatMap(({ run }) => MOON_TASK.exec(run)?.slice(1) ?? []);
    expect(named.filter((task) => moon.tasks[task] === undefined)).toEqual([]);
    expect(named.sort()).toEqual(['astro-compat', 'check', 'effect-three', 'foldkit-zloz']);
  });

  test("moon compares against HEAD, as a pull request's shallow checkout has no main", () => {
    expect(ci.env?.MOON_BASE).toBe('HEAD');
    expect(moon.taskOptions?.runInCI).toBe('always');
    expect(moon.taskOptions?.cache).toBe(false);
  });

  test('no task declares inputs, so moon does not hash the whole tree for an uncached run', () => {
    const declaring = Object.entries(moon.tasks).filter(([, task]) => task.inputs?.length !== 0);
    expect(declaring.map(([name]) => name)).toEqual([]);
  });
});

describe('the check job', () => {
  test('runs its steps one after another, lint first and the built-output checks last', () => {
    expect(moon.tasks.check?.deps).toEqual([
      'lint',
      'typecheck',
      'test',
      'build',
      'api-reports',
      'size-budgets',
    ]);
    expect(moon.tasks.lint?.script).toBe('bun run check');
    expect(moon.tasks.typecheck?.script).toBe('bun typecheck');
    expect(moon.tasks.test?.script).toBe('bun run test');
    expect(moon.tasks.build?.script).toBe('bun run build');
  });
});

describe('git hooks', () => {
  test('are installed on purpose, never by another moon command', () => {
    expect(workspace.vcs.sync).toBe(false);
  });

  test('run moon tasks, and skip a checkout from before moon', () => {
    expect(workspace.vcs.hooks).toEqual({
      'pre-commit': ['[ ! -f moon.yml ] || bun moon run root:pre-commit'],
      'pre-push': ['[ ! -f moon.yml ] || bun moon run root:pre-push'],
    });
    expect(moon.tasks['pre-commit']?.script).toBe('bun tools/pre-commit.ts');
    expect(moon.tasks['pre-push']?.script).toBe(
      'bun tools/ci-local.ts lint typecheck api-reports size-budgets',
    );
  });

  test('pre-push runs only tasks of the check job', () => {
    const tasks = moon.tasks['pre-push']?.script?.split(' ').slice(2) ?? [];
    expect(tasks.filter((task) => !moon.tasks.check?.deps?.includes(task))).toEqual([]);
  });
});
