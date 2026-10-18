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

/**
 * Chromium with software WebGL and WebGPU (SwiftShader both), so rendering is the same on
 * every machine. WebGPU needs a secure context: the served pages are on localhost. On
 * Linux, Dawn reaches SwiftShader through Vulkan, which Chromium leaves off unless asked;
 * without it the adapter is found but its instance drops on the first frame
 * ("Instance dropped in popErrorScope") and nothing is drawn. Other systems ignore it.
 */
export function launchBrowser() {
  return chromium.launch({
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--enable-unsafe-webgpu',
      '--use-webgpu-adapter=swiftshader',
      '--enable-features=Vulkan',
      '--use-vulkan=swiftshader',
    ],
  });
}
