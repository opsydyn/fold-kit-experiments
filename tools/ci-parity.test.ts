import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { Glob } from 'bun';

/**
 * CI, the git hooks and local runs share one definition of every check.
 *
 * - Every CI step prepares the machine or runs a root `ci:*` script, and those
 *   scripts run moon tasks that exist.
 * - Every project task runs its package script without the dependency builds
 *   the script starts with, and moon reaches each of those packages through
 *   `^:build`, so `bun run <script>` and the moon task check the same thing.
 * - Tasks that read the outside world, or the working tree, are never cached.
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
  readonly script?: string;
  readonly command?: string;
  readonly deps?: ReadonlyArray<string>;
  readonly outputs?: ReadonlyArray<string>;
  readonly inputs?: ReadonlyArray<string>;
  readonly options?: { readonly cache?: boolean; readonly mutex?: string };
}
interface MoonProject {
  readonly id?: string;
  readonly tasks?: Readonly<Record<string, MoonTask>>;
}
interface Manifest {
  readonly name: string;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}
interface MoonWorkspace {
  readonly hasher: {
    readonly walkStrategy: string;
    readonly ignorePatterns: ReadonlyArray<string>;
  };
  readonly pipeline: {
    readonly installDependencies: boolean;
    readonly syncProjects: boolean;
    readonly syncWorkspace: boolean;
  };
  readonly vcs: {
    readonly sync: boolean;
    readonly hooks: Readonly<Record<string, ReadonlyArray<string>>>;
  };
}
interface Toolchains {
  readonly javascript: Readonly<Record<string, string | boolean>>;
}
interface InheritedTasks {
  readonly implicitInputs: ReadonlyArray<string>;
  readonly taskOptions: { readonly runInCI: string };
}

const text = (path: string) => Bun.file(join(root, path)).text();
const yaml = async <A>(path: string): Promise<A> =>
  // SAFETY: these are the repository's own config files; the assertions below
  // fail on a missing or renamed field, which is the drift these tests catch.
  Bun.YAML.parse(await text(path)) as A;
const json = async <A>(path: string): Promise<A> =>
  // SAFETY: as above, for the repository's own manifests.
  JSON.parse(await text(path)) as A;

const ci = await yaml<Workflow>('.github/workflows/ci.yml');
const workspace = await yaml<MoonWorkspace>('.moon/workspace.yml');
const toolchains = await yaml<Toolchains>('.moon/toolchains.yml');
const inherited = await yaml<InheritedTasks>('.moon/tasks/all.yml');
const rootManifest = await json<Manifest>('package.json');

interface Project {
  readonly id: string;
  readonly dir: string;
  readonly manifest: Manifest;
  readonly tasks: Readonly<Record<string, MoonTask>>;
}

const manifests = [...new Glob('{packages,apps,infra}/*/package.json').scanSync({ cwd: root })];
const projects: ReadonlyArray<Project> = await Promise.all(
  manifests.sort().map(async (path) => {
    const dir = dirname(path);
    const config = existsSync(join(root, dir, 'moon.yml'))
      ? await yaml<MoonProject>(join(dir, 'moon.yml'))
      : {};
    return {
      id: config.id ?? basename(dir),
      dir,
      manifest: await json<Manifest>(path),
      tasks: config.tasks ?? {},
    };
  }),
);
const rootTasks = (await yaml<MoonProject>('moon.yml')).tasks ?? {};
const byName = new Map(projects.map((project) => [project.manifest.name, project]));
const byId = new Map(projects.map((project) => [project.id, project]));

const workspaceDeps = (project: Project): ReadonlyArray<Project> =>
  Object.entries({ ...project.manifest.dependencies, ...project.manifest.devDependencies })
    .filter(([, version]) => version.startsWith('workspace:'))
    .flatMap(([name]) => byName.get(name) ?? []);

/** Every workspace package a project reaches through its workspace dependencies. */
function closure(project: Project, seen = new Set<string>()): ReadonlySet<string> {
  for (const dep of workspaceDeps(project))
    if (!seen.has(dep.manifest.name)) {
      seen.add(dep.manifest.name);
      closure(dep, seen);
    }
  return seen;
}

/**
 * The build of a package with no build of its own. It records its hash as an
 * output, because moon leaves a dependency without outputs out of its
 * dependents' hashes.
 */
const PASS_THROUGH = 'mkdir -p dist && echo "$MOON_TASK_HASH" > dist/moon-pass-through';

/** The package script a moon task runs. */
const SCRIPT_OF: ReadonlyMap<string, string> = new Map([
  ['build', 'build'],
  ['typecheck', 'typecheck'],
  ['test', 'test'],
  ['lint', 'check'],
  ['api-check', 'api:check'],
  ['size-check', 'size:check'],
  ['schema-check', 'schema:check'],
  ['pack-check', 'pack:check'],
  ['e2e', 'test:e2e'],
  ['e2e-zloz', 'test:e2e'],
  ['compat', 'compat:astro'],
]);
/**
 * The script a task runs in a project: `test` runs `test:unit` where a package
 * splits off tests that rebuild packages, which `integration` runs instead.
 */
function scriptOf(project: Project, task: string): string | undefined {
  const scripts = project.manifest.scripts ?? {};
  if (task === 'test' && scripts['test:unit'] !== undefined) return 'test:unit';
  if (task === 'integration')
    return ['test:integration', 'test:package'].find((name) => scripts[name] !== undefined);
  return SCRIPT_OF.get(task);
}

/** Arguments a CI step passed to a package script, now part of the task. */
const ARGUMENTS: ReadonlyMap<string, string> = new Map([
  ['e2e-zloz', ' e2e/zloz.spec.ts'],
  ['compat', ' 5 6 7'],
]);

interface Stripped {
  readonly command: string;
  readonly builds: ReadonlyArray<string>;
  readonly buildsItself: boolean;
}
const FILTER_BUILD = /^bun run --filter (@opsydyn\/[\w-]+) build && /;
const PREFIX_SCRIPT = /^bun run (prebuild-packages|predev) && /;
const SELF_BUILD = /^bun run build && /;

/** A package script without the dependency builds it starts with. */
function strip(script: string, scripts: Readonly<Record<string, string>>): Stripped {
  const filter = FILTER_BUILD.exec(script);
  const prefix = PREFIX_SCRIPT.exec(script);
  const self = SELF_BUILD.exec(script);
  if (filter?.[1] !== undefined) {
    const rest = strip(script.slice(filter[0].length), scripts);
    return { ...rest, builds: [filter[1], ...rest.builds] };
  }
  if (prefix?.[1] !== undefined) {
    const named = scripts[prefix[1]] ?? '';
    const rest = strip(script.slice(prefix[0].length), scripts);
    const builds = [...named.matchAll(/--filter (@opsydyn\/[\w-]+) build/g)].flatMap(
      (match) => match[1] ?? [],
    );
    return { ...rest, builds: [...builds, ...rest.builds] };
  }
  if (self !== null) return { ...strip(script.slice(self[0].length), scripts), buildsItself: true };
  return { command: script, builds: [], buildsItself: false };
}

describe('CI runs root ci:* scripts of moon tasks', () => {
  const runs = Object.entries(ci.jobs).flatMap(([job, { steps }]) =>
    steps.flatMap(({ run }) => (run === undefined ? [] : [{ job, run: run.trim() }])),
  );
  const SETUP = [/^bun install --frozen-lockfile$/, /^bunx (?:--no-install )?playwright install /];

  test('each job prepares the machine and runs its own ci:<job> script', () => {
    const checks = runs.filter(({ run }) => !SETUP.some((pattern) => pattern.test(run)));
    expect(checks).toEqual(Object.keys(ci.jobs).map((job) => ({ job, run: `bun run ci:${job}` })));
  });

  test('each ci:* script runs moon tasks that exist', () => {
    const scripts = Object.entries(rootManifest.scripts ?? {}).filter(
      ([name]) => name.startsWith('ci:') && name !== 'ci:clean',
    );
    expect(scripts.map(([name]) => name).sort()).toEqual(
      Object.keys(ci.jobs)
        .map((job) => `ci:${job}`)
        .sort(),
    );
    const missing = scripts.flatMap(([name, script]) =>
      script.split(' && ').flatMap((phase) => {
        const [moon, run, ...targets] = phase.split(' ');
        if (moon !== 'moon' || run !== 'run') return [`${name} is not a moon run`];
        return targets.flatMap((target) => {
          const [project = '', task = ''] = target.split(':');
          const exists =
            project === ''
              ? projects.some(({ tasks }) => task in tasks) || task in rootTasks
              : project === 'root'
                ? task in rootTasks
                : task in (byId.get(project)?.tasks ?? {});
          return exists ? [] : [`${name}: ${target}`];
        });
      }),
    );
    expect(missing).toEqual([]);
  });

  test('ci:check runs the tests that rebuild packages after everything else', () => {
    const phases = rootManifest.scripts?.['ci:check']?.split(' && ') ?? [];
    expect(phases).toHaveLength(2);
    expect(phases[1]).toBe('moon run :integration');
    expect(phases[0]).not.toContain(':integration');
  });

  test("moon compares against HEAD, as a pull request's shallow checkout has no main", () => {
    expect(ci.env?.MOON_BASE).toBe('HEAD');
    expect(inherited.taskOptions.runInCI).toBe('always');
  });
});

describe('project tasks are their package scripts', () => {
  const tasks = projects.flatMap((project) =>
    Object.entries(project.tasks).map(([task, config]) => ({ project, task, config })),
  );

  test('each task runs its script without its dependency builds', () => {
    const drift = tasks.flatMap(({ project, task, config }) => {
      if (config.script === PASS_THROUGH) return [];
      const scripts = project.manifest.scripts ?? {};
      const scriptName = scriptOf(project, task);
      const script = scriptName === undefined ? undefined : scripts[scriptName];
      if (script === undefined) return [`${project.id}:${task} has no package script`];
      const expected = strip(script, scripts).command + (ARGUMENTS.get(task) ?? '');
      return config.script === expected ? [] : [`${project.id}:${task}: ${expected}`];
    });
    expect(drift).toEqual([]);
  });

  test('moon builds what each script built first, through its dependencies', () => {
    const unreached = tasks.flatMap(({ project, task, config }) => {
      const scriptName = scriptOf(project, task);
      const script = scriptName === undefined ? undefined : project.manifest.scripts?.[scriptName];
      if (script === undefined) return [];
      const { builds, buildsItself } = strip(script, project.manifest.scripts ?? {});
      const deps = config.deps ?? [];
      const reachable = closure(project);
      return [
        ...builds
          .filter((name) => !reachable.has(name) || !deps.includes('^:build'))
          .map((name) => `${project.id}:${task} no longer builds ${name}`),
        ...(buildsItself && !deps.includes('build')
          ? [`${project.id}:${task} skips its build`]
          : []),
      ];
    });
    expect(unreached).toEqual([]);
  });

  test('a dependency without a build of its own passes ^:build through', () => {
    const imported = new Set(projects.flatMap((project) => [...closure(project)]));
    const blocking = projects
      .filter(
        ({ manifest }) => imported.has(manifest.name) && manifest.scripts?.build === undefined,
      )
      .filter(
        ({ tasks: own }) =>
          own.build?.script !== PASS_THROUGH ||
          !own.build.deps?.includes('^:build') ||
          own.build.outputs?.[0] !== 'dist/moon-pass-through',
      )
      .map(({ id }) => id);
    expect(blocking).toEqual([]);
  });

  test('every build caches its dist/ and every task for a package script has one', () => {
    const builds = tasks.filter(
      ({ task, config }) => task === 'build' && config.script !== PASS_THROUGH,
    );
    expect(builds.filter(({ config }) => config.outputs?.[0] !== 'dist/**/*')).toEqual([]);
    const missing = projects.flatMap((project) =>
      ['build', 'typecheck', 'test']
        .filter(
          (script) =>
            project.manifest.scripts?.[script] !== undefined && !(script in project.tasks),
        )
        .map((script) => `${project.id}:${script}`),
    );
    expect(missing).toEqual([]);
  });

  test('every root task names its inputs, which a root-level project does not default', () => {
    expect(
      Object.entries(rootTasks)
        .filter(([, task]) => task.options?.cache !== false && !task.inputs?.length)
        .map(([name]) => name),
    ).toEqual([]);
    expect(rootTasks.lint?.inputs).toEqual(['/**/*']);
    expect(rootTasks.format?.inputs).toEqual(['/**/*']);
  });

  test('the tests that rebuild packages run one at a time, invalidated by what they rebuild', () => {
    const integration = tasks.filter(({ task }) => task === 'integration');
    expect(integration.length).toBeGreaterThan(0);
    expect(
      integration
        .filter(
          ({ config }) => config.options?.mutex !== 'rebuilds-packages' || !config.inputs?.length,
        )
        .map(({ project }) => project.id),
    ).toEqual([]);
    const split = projects.filter(({ manifest }) =>
      ['test:integration', 'test:package'].some((name) => manifest.scripts?.[name] !== undefined),
    );
    expect(
      split.filter(({ tasks: own }) => own.integration === undefined).map(({ id }) => id),
    ).toEqual([]);
  });

  test('tasks that reach browsers, registries or the working tree are never cached', () => {
    const uncached = ['e2e', 'e2e-zloz', 'pack-check', 'compat'];
    expect(
      tasks
        .filter(({ task, config }) => uncached.includes(task) && config.options?.cache !== false)
        .map(({ project, task }) => `${project.id}:${task}`),
    ).toEqual([]);
    expect(rootTasks['pre-commit']?.options?.cache).toBe(false);
    expect(rootTasks['pre-push']?.options?.cache).toBe(false);
  });
});

describe('moon leaves installs and files to the workspace', () => {
  test('tasks are hashed from what git sees, plus the lockfile and catalog', async () => {
    expect(workspace.hasher.walkStrategy).toBe('vcs');
    // Explicit input globs do not consult git, so moon must ignore what git ignores.
    const listed = Bun.spawnSync(['git', 'ls-files', '--', '.gitignore', '**/.gitignore'], {
      cwd: root,
    });
    const files = new TextDecoder()
      .decode(listed.stdout)
      .split('\n')
      .filter((path) => path !== '');
    const ignored = (
      await Promise.all(
        files.map(async (file) => ({ base: dirname(file), lines: (await text(file)).split('\n') })),
      )
    ).flatMap(({ base, lines }) =>
      lines
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'))
        .map((line) => {
          const name = line.replace(/\/$/, '');
          const prefix = base === '.' ? '' : `${base}/`;
          const glob = `**/${name.includes('/') ? prefix + name : prefix + '**/' + name}`.replace(
            '**/**/',
            '**/',
          );
          return line.endsWith('/') ? `${glob}/**` : glob;
        }),
    );
    expect(ignored.filter((pattern) => !workspace.hasher.ignorePatterns.includes(pattern))).toEqual(
      [],
    );
    expect(inherited.implicitInputs).toEqual(['/bun.lock', '/package.json']);
  });

  test('no installs, syncs or manifest rewrites on its own', () => {
    expect(workspace.pipeline).toEqual({
      installDependencies: false,
      syncProjects: false,
      syncWorkspace: false,
    });
    expect(toolchains.javascript).toEqual({
      packageManager: 'bun',
      inferTasksFromScripts: false,
      syncProjectWorkspaceDependencies: false,
      syncPackageManagerField: false,
      dedupeOnLockfileChange: false,
    });
  });
});

describe('git hooks', () => {
  test('are installed on purpose, and skip a checkout from before moon', () => {
    expect(workspace.vcs.sync).toBe(false);
    expect(workspace.vcs.hooks).toEqual({
      'pre-commit': ['[ ! -f moon.yml ] || bun moon run root:pre-commit'],
      'pre-push': ['[ ! -f moon.yml ] || bun moon run root:pre-push'],
    });
  });

  test('pre-push runs the CI check job in a fresh checkout', () => {
    expect(rootTasks['pre-commit']?.script).toBe('bun tools/pre-commit.ts');
    expect(rootTasks['pre-push']?.script).toBe('bun tools/ci-local.ts ci:check');
  });
});
