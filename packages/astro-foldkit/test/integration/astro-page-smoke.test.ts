import { afterAll, describe, expect, it } from 'bun:test';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, readFile, readdir } from 'node:fs/promises';
import { createServer, type AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const maxBuffer = 20 * 1024 * 1024;
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoDir = path.resolve(packageDir, '..', '..');
const webDir = path.join(repoDir, 'apps', 'web');
const env = (buildId?: string): NodeJS.ProcessEnv => {
  const result = { ...process.env };
  delete result.FOLDKIT_BUILD_ID;
  if (buildId !== undefined) result.FOLDKIT_BUILD_ID = buildId;
  return result;
};

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const fileExists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  );

const isAddressInfo = (address: string | AddressInfo | null): address is AddressInfo =>
  address !== null && typeof address === 'object';

const findPort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!isAddressInfo(address)) {
    server.close();
    throw new Error('Could not determine a free TCP port for the Astro smoke server.');
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
};

const startDevServer = async (port: number, buildId?: string) => {
  const child = spawn('bun', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: webDir,
    env: env(buildId),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(`http://127.0.0.1:${port}/greeting?name=Ada&locale=ar`).catch(
      () => undefined,
    );
    if (response !== undefined && response.status < 500) return { child, output };
    await delay(500);
  }

  child.kill('SIGTERM');
  throw new Error(`Astro dev server did not become ready.\n${output.slice(-4000)}`);
};

const stopDevServer = async (child: ReturnType<typeof spawn>): Promise<void> => {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await Promise.race([exited, delay(3000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
};

const count = (html: string, pattern: string): number => html.split(pattern).length - 1;

const expectHydratablePage = (html: string, flags: string, expectedBuildId?: string): string => {
  expect(count(html, 'data-foldkit-app="app"')).toBe(1);
  expect(count(html, 'data-foldkit-build="')).toBe(1);
  const buildId = html.match(/data-foldkit-build="([^"]+)"/)?.[1];
  if (buildId === undefined) throw new Error('Missing hydration build identity');
  if (expectedBuildId !== undefined) expect(buildId).toBe(expectedBuildId);
  expect(count(html, 'data-foldkit-flags="app"')).toBe(1);
  expect(html).toContain(flags);
  return buildId;
};

const expectCompiledBuildId = async (directory: string, buildId: string): Promise<void> => {
  const entries = await readdir(directory, { recursive: true });
  const scripts = await Promise.all(
    entries
      .filter((entry) => /\.m?js$/.test(entry))
      .map((entry) => readFile(path.join(directory, entry), 'utf8')),
  );
  expect(scripts.some((script) => script.includes(buildId))).toBe(true);
};

describe('Astro page rendering smoke', () => {
  let activeServer: ReturnType<typeof spawn> | undefined;

  afterAll(async () => {
    if (activeServer) await stopDevServer(activeServer);
  });

  it.each([undefined, 'astro-page-smoke-build'])(
    'proves SSG, request SSR, metadata and artifact identity with override %s',
    async (buildId) => {
      await execFileAsync('bun', ['run', 'build'], { cwd: webDir, env: env(buildId), maxBuffer });

      expect(await fileExists(path.join(webDir, 'dist', 'client', 'index.html'))).toBe(false);
      expect(
        await fileExists(path.join(webDir, 'dist', 'client', 'greeting-static', 'index.html')),
      ).toBe(true);

      const staticHtml = await readFile(
        path.join(webDir, 'dist', 'client', 'greeting-static', 'index.html'),
        'utf8',
      );
      const staticBuildId = expectHydratablePage(
        staticHtml,
        '{"name":"static astronaut","locale":"en"}',
        buildId,
      );
      expect(staticBuildId).not.toBe('development');
      await expectCompiledBuildId(path.join(webDir, 'dist', 'client'), staticBuildId);
      await expectCompiledBuildId(path.join(webDir, 'dist', 'server'), staticBuildId);
      expect(staticHtml).toContain('<html lang="en" dir="ltr">');
      expect(staticHtml).toContain('<title>Hello, static astronaut! — Astro + FoldKit</title>');
      expect(staticHtml).toContain(
        '<link rel="canonical" href="https://opsydyn-web.opsydyn.workers.dev/greeting"',
      );
      expect(staticHtml).toContain('property="og:url"');
      expect(staticHtml).toContain('Hello, static astronaut!');

      const port = await findPort();
      const server = await startDevServer(port, buildId);
      activeServer = server.child;

      await Promise.resolve()
        .then(async () => {
          const response = await fetch(`http://127.0.0.1:${port}/greeting?name=Ada&locale=ar`);
          expect(response.ok).toBe(true);
          const requestHtml = await response.text();
          const requestBuildId = expectHydratablePage(
            requestHtml,
            '{"name":"Ada","locale":"ar"}',
            buildId,
          );
          expect(requestHtml).toContain('<html lang="ar" dir="rtl">');
          expect(requestHtml).toContain('<title>مرحبا، Ada! — Astro + FoldKit</title>');
          expect(requestHtml).toContain('مرحبا، Ada!');
          expect(requestHtml).toContain('canonical');
          expect(requestHtml).toContain('og:url');

          const stateflowResponse = await fetch(`http://127.0.0.1:${port}/stateflow`);
          expect(stateflowResponse.ok).toBe(true);
          const stateflowHtml = await stateflowResponse.text();
          expectHydratablePage(stateflowHtml, '{}', requestBuildId);
          expect(stateflowHtml).toContain('<title>Stateflow Observatory — Loading</title>');
          expect(stateflowHtml).toContain('Current state: Loading');
          expect(stateflowHtml).toContain('aria-label="Request diagnostics state graph"');
          expect(stateflowHtml).toContain('Recent events');
          expect(stateflowHtml).toContain('Select an event to inspect its recorded facts.');
          expect(stateflowHtml).toContain('Outcome</th>');
          expect(stateflowHtml).toContain('client="load"');

          const chartsResponse = await fetch(`http://127.0.0.1:${port}/charts`);
          expect(chartsResponse.ok).toBe(true);
          const chartsHtml = await chartsResponse.text();
          expect(chartsHtml).toContain('<div data-foldkit-island="true"></div>');
          expect(chartsHtml).not.toContain('data-foldkit-app="app"');

          const stateflowLinks: string[] = [];
          new HTMLRewriter()
            .on('nav a[href="/stateflow"]', {
              element: () => {
                stateflowLinks.push('navigation');
              },
            })
            .on('main a[href="/stateflow"]', {
              element: () => {
                stateflowLinks.push('dashboard');
              },
            })
            .transform(chartsHtml);
          expect(stateflowLinks).toEqual(['navigation', 'dashboard']);
        })
        .finally(async () => {
          await stopDevServer(server.child);
          activeServer = undefined;
        });
    },
    120_000,
  );
});
