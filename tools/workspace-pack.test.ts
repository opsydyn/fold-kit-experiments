import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('packing uses the current workspace version after a release-only manifest bump', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'foldkit-release-pack-'));
  // Native fixture resources must be reclaimed even if packing fails.
  // oxlint-disable-next-line linteffect/no-try-catch
  try {
    const dependency = path.join(directory, 'packages/dependency');
    const adapter = path.join(directory, 'packages/adapter');
    await mkdir(dependency, { recursive: true });
    await mkdir(adapter, { recursive: true });
    const writeDependency = (version: string) =>
      writeFile(
        path.join(dependency, 'package.json'),
        JSON.stringify({ name: '@foldkit-pack-fixture/dependency', version }),
      );
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true, workspaces: ['packages/*'] }),
    );
    await writeDependency('1.0.0');
    await writeFile(
      path.join(adapter, 'package.json'),
      JSON.stringify({
        name: '@foldkit-pack-fixture/adapter',
        version: '1.0.0',
        dependencies: { '@foldkit-pack-fixture/dependency': 'workspace:*' },
      }),
    );
    execFileSync(process.execPath, ['install', '--ignore-scripts'], { cwd: directory });
    // release-please edits package.json without regenerating bun.lock.
    await writeDependency('1.1.0');
    execFileSync(process.execPath, ['install', '--frozen-lockfile', '--ignore-scripts'], {
      cwd: directory,
    });
    execFileSync(process.execPath, ['pm', 'pack', '--destination', directory], { cwd: adapter });
    const manifest = JSON.parse(
      execFileSync(
        'tar',
        [
          '-xOf',
          path.join(directory, 'foldkit-pack-fixture-adapter-1.0.0.tgz'),
          'package/package.json',
        ],
        { encoding: 'utf8' },
      ),
    );
    expect(manifest.dependencies['@foldkit-pack-fixture/dependency']).toBe('1.1.0');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
