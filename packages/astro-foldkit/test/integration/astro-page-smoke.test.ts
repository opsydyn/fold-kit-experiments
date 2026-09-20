import { afterAll, describe, expect, it } from 'bun:test';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const maxBuffer = 20 * 1024 * 1024;
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoDir = path.resolve(packageDir, '..', '..');
const webDir = path.join(repoDir, 'apps', 'web');
const buildId = 'astro-page-smoke-build';

const env = (): NodeJS.ProcessEnv => ({
  ...process.env,
  FOLDKIT_BUILD_ID: buildId,
});

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const fileExists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  );

const findPort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    throw new Error('Could not determine a free TCP port for the Astro smoke server.');
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
};

const startDevServer = async (port: number) => {
  const child = spawn('bun', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: webDir,
    env: env(),
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

const expectHydratablePage = (html: string, flags: string): void => {
  expect(count(html, 'data-foldkit-app="app"')).toBe(1);
  expect(count(html, `data-foldkit-build="${buildId}"`)).toBe(1);
  expect(count(html, 'data-foldkit-flags="app"')).toBe(1);
  expect(html).toContain(flags);
};

describe('Astro page rendering smoke', () => {
  let activeServer: ReturnType<typeof spawn> | undefined;

  afterAll(async () => {
    if (activeServer) await stopDevServer(activeServer);
  });

  it('proves SSG, request SSR, metadata handoff, and unchanged app islands', async () => {
    await execFileAsync('bun', ['run', 'build'], { cwd: webDir, env: env(), maxBuffer });

    expect(await fileExists(path.join(webDir, 'dist', 'client', 'index.html'))).toBe(false);
    expect(
      await fileExists(path.join(webDir, 'dist', 'client', 'greeting-static', 'index.html')),
    ).toBe(true);

    const staticHtml = await readFile(
      path.join(webDir, 'dist', 'client', 'greeting-static', 'index.html'),
      'utf8',
    );
    expectHydratablePage(staticHtml, '{"name":"static astronaut","locale":"en"}');
    expect(staticHtml).toContain('<html lang="en" dir="ltr">');
    expect(staticHtml).toContain('<title>Hello, static astronaut! — Astro + FoldKit</title>');
    expect(staticHtml).toContain(
      '<link rel="canonical" href="https://opsydyn-web.opsydyn.workers.dev/greeting"',
    );
    expect(staticHtml).toContain('property="og:url"');
    expect(staticHtml).toContain('Hello, static astronaut!');

    const port = await findPort();
    const server = await startDevServer(port);
    activeServer = server.child;

    await Promise.resolve()
      .then(async () => {
        const response = await fetch(`http://127.0.0.1:${port}/greeting?name=Ada&locale=ar`);
        expect(response.ok).toBe(true);
        const requestHtml = await response.text();
        expectHydratablePage(requestHtml, '{"name":"Ada","locale":"ar"}');
        expect(requestHtml).toContain('<html lang="ar" dir="rtl">');
        expect(requestHtml).toContain('<title>مرحبا، Ada! — Astro + FoldKit</title>');
        expect(requestHtml).toContain('مرحبا، Ada!');
        expect(requestHtml).toContain('canonical');
        expect(requestHtml).toContain('og:url');

        const stateflowResponse = await fetch(`http://127.0.0.1:${port}/stateflow`);
        expect(stateflowResponse.ok).toBe(true);
        const stateflowHtml = await stateflowResponse.text();
        expectHydratablePage(stateflowHtml, '{}');
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
      })
      .finally(async () => {
        await stopDevServer(server.child);
        activeServer = undefined;
      });
  }, 120_000);
});
