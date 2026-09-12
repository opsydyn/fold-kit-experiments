import { afterAll, describe, expect, it } from 'bun:test';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const maxBuffer = 10 * 1024 * 1024;

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

type DistIndex = { default: unknown };
type DistDefineApp = { defineApp: unknown; lazyApp: unknown };
type DistDefinePage = { definePage: unknown };
type DistServer = { resolvePageDocument: unknown };
type PackedPackageJson = {
  exports: Record<string, { types?: string; import?: string }>;
};

type SmokeFixture = {
  distIndex: DistIndex;
  distDefineApp: DistDefineApp;
  distDefinePage: DistDefinePage;
  distServer: DistServer;
  clientBundle: string;
  distIndexTypes: string;
  packedPackageJson: PackedPackageJson;
  consumerDir: string;
  env: NodeJS.ProcessEnv;
  cleanup: () => Promise<void>;
};

const buildEnv = async (): Promise<NodeJS.ProcessEnv> => {
  const home = process.env.HOME;
  const existing = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const candidates = [
    process.env.NVM_BIN,
    home ? path.join(home, '.bun', 'bin') : undefined,
    path.dirname(process.execPath),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
    ...existing,
  ].filter((p): p is string => Boolean(p));
  return { ...process.env, PATH: [...new Set(candidates)].join(path.delimiter) };
};

const setupFixture = async (): Promise<SmokeFixture> => {
  const artifactsDir = path.join(packageDir, 'artifacts', 'test');
  await mkdir(artifactsDir, { recursive: true });
  const tempDir = await mkdtemp(path.join(artifactsDir, 'smoke-'));
  const unpackDir = path.join(tempDir, 'unpack');
  const consumerDir = path.join(tempDir, 'consumer');
  const scopeDir = path.join(consumerDir, 'node_modules', '@opsydyn');
  const consumerNodeModules = path.join(consumerDir, 'node_modules');
  const env = await buildEnv();

  await execFileAsync('bun', ['run', 'build'], { cwd: packageDir, env, maxBuffer });

  const { stdout } = await execFileAsync('npm', ['pack', '--json'], {
    cwd: packageDir,
    env,
    maxBuffer,
  });
  const [{ filename }] = JSON.parse(stdout) as [{ filename: string }];
  const tarball = path.resolve(packageDir, filename);

  await mkdir(unpackDir, { recursive: true });
  await mkdir(consumerNodeModules, { recursive: true });
  await mkdir(scopeDir, { recursive: true });
  await writeFile(
    path.join(consumerDir, 'package.json'),
    JSON.stringify({ name: 'astro-foldkit-smoke', private: true, type: 'module' }, null, 2),
  );
  await execFileAsync('tar', ['-xzf', tarball, '-C', unpackDir], { env, maxBuffer });
  await rename(path.join(unpackDir, 'package'), path.join(scopeDir, 'astro-foldkit'));

  for (const dependency of ['effect', 'foldkit']) {
    await symlink(
      path.join(packageDir, 'node_modules', dependency),
      path.join(consumerNodeModules, dependency),
      'dir',
    );
  }

  const pkgRoot = path.join(scopeDir, 'astro-foldkit');
  const navigationConsumer = path.join(consumerDir, 'navigation-consumer.ts');
  await writeFile(
    navigationConsumer,
    `import type { NavigationConfig, NavigationEvent, NavigationPhase } from '@opsydyn/astro-foldkit';

const phase: NavigationPhase = 'entered';
const event: NavigationEvent = { phase, path: '/request-diagnostics', previousPath: '/' };
const config: NavigationConfig<NavigationEvent> = {
  port: 'navigation',
  map: (value) => value,
};

void config.map(event);
`,
  );
  const pageConsumer = path.join(consumerDir, 'page-consumer.ts');
  await writeFile(
    pageConsumer,
    `import { definePage } from '@opsydyn/astro-foldkit/define-page';
import type { PageConfig, PageFlagsContext } from '@opsydyn/astro-foldkit/define-page';
import { resolvePageDocument } from '@opsydyn/astro-foldkit/server';
import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

type Flags = { readonly name: string };
type Model = Flags;
type Message = { readonly _tag: 'NoOp' };
type Props = { readonly name: string };

const Flags = Schema.Struct({ name: Schema.String });
const config = {
  Flags,
  Model: {},
  init: (flags: Flags) => ({ model: flags }),
  update: (model: Model, _message: Message) => ({ model }),
  view: (model: Model, h: HtmlBuilder<Message>): Document => ({
    title: model.name,
    body: h.main([], [model.name]),
  }),
} satisfies PageConfig<Flags, Model, Message>;

const page = definePage<Props, Flags>(() => Promise.resolve(config), {
  flags: ({ props }: PageFlagsContext<Props>) => ({ name: props.name }),
});
const context: PageFlagsContext<Props> = {
  request: new Request('https://example.com/page'),
  url: new URL('https://example.com/page'),
  params: {},
  props: { name: 'Ada' },
};
const document = resolvePageDocument(page, context);
const title: Promise<string> = document.then((value) => value.title);
void title;
`,
  );
  await execFileAsync(
    'bun',
    [
      'x',
      'tsc',
      '--noEmit',
      '--ignoreConfig',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      pageConsumer,
    ],
    { cwd: consumerDir, env, maxBuffer },
  );
  await execFileAsync(
    'bun',
    [
      'x',
      'tsc',
      '--noEmit',
      '--ignoreConfig',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      navigationConsumer,
    ],
    { cwd: consumerDir, env, maxBuffer },
  );
  const distIndex = (await import(
    pathToFileURL(path.join(pkgRoot, 'dist', 'index.mjs')).href
  )) as DistIndex;
  const distDefineApp = (await import(
    pathToFileURL(path.join(pkgRoot, 'dist', 'define-app.mjs')).href
  )) as DistDefineApp;
  const distDefinePage = (await import(
    pathToFileURL(path.join(pkgRoot, 'dist', 'define-page.mjs')).href
  )) as DistDefinePage;
  const distServer = (await import(
    pathToFileURL(path.join(pkgRoot, 'dist', 'server-public.mjs')).href
  )) as DistServer;
  const clientBundle = await readFile(path.join(pkgRoot, 'dist', 'client.mjs'), 'utf8');
  const distIndexTypes = await readFile(path.join(pkgRoot, 'dist', 'index.d.mts'), 'utf8');
  const packedPackageJson = JSON.parse(
    await readFile(path.join(pkgRoot, 'package.json'), 'utf8'),
  ) as PackedPackageJson;

  return {
    distIndex,
    distDefineApp,
    distDefinePage,
    distServer,
    clientBundle,
    distIndexTypes,
    packedPackageJson,
    consumerDir,
    env,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
      await rm(tarball, { force: true });
    },
  };
};

const fixturePromise = setupFixture();

afterAll(async () => (await fixturePromise).cleanup());

const importScript = `
import('@opsydyn/astro-foldkit').then(m => {
  const integration = m.default()
  console.log(JSON.stringify({
    defaultIsFunction: typeof m.default === 'function',
    integrationName: integration.name,
    hasSetupHook: typeof integration.hooks['astro:config:setup'] === 'function',
  }))
}).catch(e => { console.error(e); process.exit(1) })
`;

const defineAppScript = `
import('@opsydyn/astro-foldkit/define-app').then(m => {
  const app = m.lazyApp(() => Promise.resolve({}))
  console.log(JSON.stringify({
    defineAppIsFunction: typeof m.defineApp === 'function',
    lazyAppIsFunction: typeof m.lazyApp === 'function',
    lazyAppIsDefineApp: m.lazyApp === m.defineApp,
    foldkitFlag: app.__foldkit,
    loadIsFunction: typeof app.load === 'function',
  }))
}).catch(e => { console.error(e); process.exit(1) })
`;

const definePageScript = `
import('@opsydyn/astro-foldkit/define-page').then(m => {
  console.log(JSON.stringify({
    definePageIsFunction: typeof m.definePage === 'function',
  }))
}).catch(e => { console.error(e); process.exit(1) })
`;

const serverScript = `
import('@opsydyn/astro-foldkit/server').then(m => {
  console.log(JSON.stringify({
    resolvePageDocumentIsFunction: typeof m.resolvePageDocument === 'function',
    hasDefaultExport: 'default' in m,
  }))
}).catch(e => { console.error(e); process.exit(1) })
`;

describe('packed import smoke', () => {
  it('dist exports resolve correctly (Bun import)', async () => {
    const {
      distIndex,
      distDefineApp,
      distDefinePage,
      distServer,
      clientBundle,
      distIndexTypes,
      packedPackageJson,
    } = await fixturePromise;
    expect(typeof distIndex.default).toBe('function');
    const integration = (
      distIndex.default as () => { name: string; hooks: Record<string, unknown> }
    )();
    expect(integration.name).toBe('astro-foldkit');
    expect(typeof integration.hooks['astro:config:setup']).toBe('function');
    expect(typeof distDefineApp.defineApp).toBe('function');
    expect(typeof distDefineApp.lazyApp).toBe('function');
    expect(typeof distDefinePage.definePage).toBe('function');
    expect(typeof distServer.resolvePageDocument).toBe('function');
    expect(clientBundle).not.toContain('resolvePageDocument');
    expect(clientBundle).not.toContain('foldkit/experimental/server');
    expect(distIndexTypes).toContain('NavigationConfig');
    expect(distIndexTypes).toContain('NavigationEvent');
    expect(distIndexTypes).toContain('NavigationPhase');
    expect(packedPackageJson.exports['./server']?.import).toBe('./dist/server-public.mjs');
    expect(packedPackageJson.exports['./define-page']?.import).toBe('./dist/define-page.mjs');
  }, 60_000);

  it('imports correctly under Bun and Node via consumer script', async () => {
    const { consumerDir, env } = await fixturePromise;

    for (const [runtime, args] of [
      ['bun', ['-e', importScript]],
      ['node', ['-e', importScript]],
    ] as const) {
      const { stdout } = await execFileAsync(runtime, args, { cwd: consumerDir, env, maxBuffer });
      const payload = JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as {
        defaultIsFunction: boolean;
        integrationName: string;
        hasSetupHook: boolean;
      };
      expect(payload.defaultIsFunction).toBe(true);
      expect(payload.integrationName).toBe('astro-foldkit');
      expect(payload.hasSetupHook).toBe(true);
    }

    for (const [runtime, args] of [
      ['bun', ['-e', defineAppScript]],
      ['node', ['-e', defineAppScript]],
    ] as const) {
      const { stdout } = await execFileAsync(runtime, args, { cwd: consumerDir, env, maxBuffer });
      const payload = JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as {
        defineAppIsFunction: boolean;
        lazyAppIsFunction: boolean;
        lazyAppIsDefineApp: boolean;
        foldkitFlag: boolean;
        loadIsFunction: boolean;
      };
      expect(payload.defineAppIsFunction).toBe(true);
      expect(payload.lazyAppIsFunction).toBe(true);
      expect(payload.lazyAppIsDefineApp).toBe(true);
      expect(payload.foldkitFlag).toBe(true);
      expect(payload.loadIsFunction).toBe(true);
    }

    for (const [runtime, args] of [
      ['bun', ['-e', definePageScript]],
      ['node', ['-e', definePageScript]],
    ] as const) {
      const { stdout } = await execFileAsync(runtime, args, { cwd: consumerDir, env, maxBuffer });
      const payload = JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as {
        definePageIsFunction: boolean;
      };
      expect(payload.definePageIsFunction).toBe(true);
    }

    for (const [runtime, args] of [
      ['bun', ['-e', serverScript]],
      ['node', ['-e', serverScript]],
    ] as const) {
      const { stdout } = await execFileAsync(runtime, args, { cwd: consumerDir, env, maxBuffer });
      const payload = JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as {
        resolvePageDocumentIsFunction: boolean;
        hasDefaultExport: boolean;
      };
      expect(payload.resolvePageDocumentIsFunction).toBe(true);
      expect(payload.hasDefaultExport).toBe(false);
    }
  }, 30_000);
});
