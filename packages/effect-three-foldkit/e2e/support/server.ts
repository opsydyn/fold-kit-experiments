/** Builds the e2e app pages with Bun and serves them; launches Chromium with SwiftShader. */
import { chromium } from 'playwright';

const appDir = new URL('../app/', import.meta.url).pathname;

export type ServedApp = {
  readonly url: (page: string) => string;
  readonly stop: () => Promise<void>;
};

/** Builds `pages` (HTML entrypoints in e2e/app) into `distName` and serves them. */
export async function serveApp(distName: string, pages: ReadonlyArray<string>): Promise<ServedApp> {
  const distDir = new URL(`../${distName}/`, import.meta.url).pathname;
  // Workspace packages export their sources under the `bun` condition; dist is for consumers.
  const build = await Bun.build({
    entrypoints: pages.map((page) => `${appDir}${page}`),
    outdir: distDir,
    conditions: ['bun'],
  });
  if (!build.success) throw new AggregateError(build.logs, 'e2e app build failed');
  const server = Bun.serve({
    port: 0,
    // Built bundles first, then static files (such as models) straight from the app folder.
    fetch: async (request) => {
      const path = new URL(request.url).pathname.slice(1);
      const built = Bun.file(distDir + path);
      return new Response((await built.exists()) ? built : Bun.file(appDir + path));
    },
  });
  return {
    url: (page) => `http://localhost:${server.port}/${page}`,
    stop: () => server.stop(),
  };
}

/** Chromium with software WebGL, so rendering is the same on every machine. */
export function launchBrowser() {
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}
