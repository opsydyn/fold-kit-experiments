/* oxlint-disable linteffect/no-try-catch -- The scratch checkout and child process need finally cleanup. */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

async function main() {
  const root = resolve(import.meta.dir, '..');
  const snapshot = 'dec1ca9';
  const verify = process.argv.includes('--verify');
  const scratch = mkdtempSync(join(tmpdir(), 'questmancer-inspector-'));
  const packageUrl = (name: string) =>
    `https://pkg.pr.new/Effect-TS/ui/@effect/${name}@${snapshot}`;

  let stopChild: (() => void) | undefined;
  let stopped = false;
  const interrupt = () => {
    stopped = true;
    stopChild?.();
  };

  const run = async (args: string[], cwd = scratch, env = process.env, fixture = false) => {
    if (stopped) return;
    let fixtureReady = false;
    const options: Bun.SpawnOptions.SpawnOptions<'ignore', 'inherit', 'inherit'> = {
      cwd,
      env,
      detached: true,
      stdin: 'ignore',
      stdout: 'inherit',
      stderr: 'inherit',
    };
    if (fixture) {
      options.ipc = (message, subprocess) => {
        if (message !== 'questmancer-ready') return;
        fixtureReady = true;
        if (stopped) subprocess.send('questmancer-stop');
      };
    }
    const child = Bun.spawn([process.execPath, ...args], options);
    stopChild = () => {
      if (!fixture) child.kill('SIGINT');
      else if (fixtureReady) child.send('questmancer-stop');
    };
    const status = await child.exited;
    stopChild = undefined;
    if (status !== 0 && !stopped) throw new Error(`bun ${args.join(' ')} exited with ${status}`);
  };

  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    const files = Bun.spawnSync(['git', 'ls-files', '-z', '--cached'], { cwd: root });
    if (files.exitCode !== 0) throw new Error('Could not list the workspace source files.');
    const paths = files.stdout.toString().split('\0').filter(Boolean);
    for (const path of paths) {
      const source = join(root, path);
      if (!existsSync(source)) continue;
      const destination = join(scratch, path);
      mkdirSync(dirname(destination), { recursive: true });
      cpSync(source, destination, { verbatimSymlinks: true });
    }

    const manifestPath = join(scratch, 'package.json');
    const manifest = await Bun.file(manifestPath).json();
    const catalog = manifest.workspaces.catalog;
    const previousRuntime = catalog['@effect/ui'];
    for (const name of ['ui', 'ui-kit', 'ui-devtools'])
      catalog['@effect/' + name] = packageUrl(name);
    manifest.overrides = { ...manifest.overrides, '@effect/ui': packageUrl('ui') };
    await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

    for (const path of paths.filter(
      (path) => path !== 'package.json' && path.endsWith('/package.json'),
    )) {
      const file = Bun.file(join(scratch, path));
      if (!(await file.exists())) continue;
      const json = await file.text();
      if (json.includes(previousRuntime))
        await Bun.write(file, json.replaceAll(previousRuntime, packageUrl('ui')));
    }

    const lock = Bun.file(join(scratch, 'bun.lock'));
    console.log('Preparing the Questmancer inspector with Effect UI snapshot ' + snapshot);
    await run(['install']);
    if (!stopped) {
      // Bun can retain the renderer's archived transitive pin on the first install.
      const cached = (await lock.text()).split('\n');
      const retained = cached.filter(
        (line) => !/^    "[^"]+\/@effect\/ui": \[/.test(line) || !line.includes(previousRuntime),
      );
      if (retained.length !== cached.length) {
        await Bun.write(lock, retained.join('\n'));
        await run(['install']);
      }
      // SAFETY: Bun just generated this lockfile and serializes resolved packages as tuples.
      const installed = Bun.JSONC.parse(await lock.text()) as {
        packages: Record<string, [string, ...unknown[]]>;
      };
      const runtimes = Object.values(installed.packages)
        .map(([resolution]) => resolution)
        .filter((resolution) => resolution.startsWith('@effect/ui@'));
      if (!stopped && (runtimes.length !== 1 || runtimes[0] !== '@effect/ui@' + packageUrl('ui'))) {
        throw new Error('Expected one inspector runtime. Resolved ' + runtimes.join(', '));
      }
    }
    await run(['run', '--filter', '@opsydyn/foldkit-phosphor', 'build']);
    await run(['run', '--filter', '@opsydyn/foldkit-zloz-alchemy', 'build']);
    await run(
      ['test', 'test/questmancer.test.ts'],
      join(scratch, 'apps/zloz-team'),
      {
        ...process.env,
        PUBLIC_QUESTMANCER_DEVTOOLS: '1',
        ZLOZ_QUESTMANCER_INSPECTOR_INTERACTIVE: verify ? '0' : '1',
      },
      true,
    );
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    rmSync(scratch, { recursive: true, force: true });
  }
}

await main();
