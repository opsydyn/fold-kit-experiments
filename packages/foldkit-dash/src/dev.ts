/**
 * `foldkit-dash dev` (ADR 0110): builds the site to memory, serves it, and rebuilds when
 * `pages/` or `data/` change, telling open pages to reload through a server-sent event.
 * Problems print as `check` prints them, and pages show them where their charts would be.
 * @module Dev
 */
import { existsSync, watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';

import { Effect, Result } from 'effect';

import type { DataOptions } from './data';
import { analyse, type Report } from './project';
import { renderSite, type SiteFile } from './site';

/** Where open pages listen for a reload. */
export const eventsPath = '/__foldkit-dash/events';

/** What `dev` adds to every page it serves, and only `dev`: reload when the site changes. */
const reloader = `<script>new EventSource(${JSON.stringify(eventsPath)}).onmessage = () => location.reload();</script>`;

/** A built site, or why it could not be built. */
type Built = Result.Result<
  { readonly report: Report; readonly files: ReadonlyArray<SiteFile> },
  string
>;

function build(options: DataOptions): Promise<Built> {
  const building = Effect.gen(function* () {
    const report = yield* Effect.fromResult(analyse(options));
    const files = yield* renderSite(report);
    return { report, files };
  });
  const settled = building.pipe(
    Effect.match({
      onFailure: (error): Built => Result.fail(error.message),
      onSuccess: (site): Built => Result.succeed(site),
    }),
  );
  return settled.pipe(Effect.runPromise);
}

/** The site file a request path names: `/` is `index.html`, `/a` may be `a.html`. */
const fileFor = (files: ReadonlyMap<string, string>, pathname: string): string | undefined => {
  const path = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidates = [path, `${path}index.html`, `${path}.html`, `${path}/index.html`];
  return candidates.find((candidate) => files.has(candidate));
};

const typeOf = (path: string): string =>
  path.endsWith('.html')
    ? 'text/html; charset=utf-8'
    : path.endsWith('.js')
      ? 'text/javascript; charset=utf-8'
      : 'text/plain; charset=utf-8';

/** A running dev server. */
export type DevServer = {
  readonly url: string;
  /** Builds again now (as a change would), resolving once the pages are told to reload. */
  readonly rebuild: () => Promise<void>;
  readonly stop: () => void;
};

/**
 * Builds the project at `options.root`, serves it at `host`:`port` (0 picks a free port),
 * and rebuilds on every change under `pages/` and `data/`. `log` receives each build's
 * report, or why it failed. Fails if the first build does.
 */
export async function startDev(
  options: DataOptions,
  address: { readonly host: string; readonly port: number },
  log: (built: Built) => void,
): Promise<DevServer> {
  const first = await build(options);
  log(first);
  if (Result.isFailure(first)) throw new Error(first.failure);
  let files = new Map(first.success.files.map((file) => [file.path, file.text]));
  const listeners = new Set<ReadableStreamDefaultController<string>>();

  const server = Bun.serve({
    hostname: address.host,
    port: address.port,
    idleTimeout: 0,
    fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === eventsPath) {
        let own: ReadableStreamDefaultController<string> | undefined;
        const stream = new ReadableStream<string>({
          start(controller) {
            own = controller;
            listeners.add(controller);
            controller.enqueue(': connected\n\n');
          },
          cancel() {
            if (own !== undefined) listeners.delete(own);
          },
        });
        return new Response(stream, {
          headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
        });
      }
      const path = fileFor(files, pathname);
      if (path === undefined) return new Response('Not found', { status: 404 });
      const text = files.get(path) ?? '';
      const body = path.endsWith('.html') ? text.replace('</body>', `${reloader}\n</body>`) : text;
      return new Response(body, {
        headers: { 'content-type': typeOf(path), 'cache-control': 'no-store' },
      });
    },
  });

  const rebuild = async (): Promise<void> => {
    const next = await build(options);
    log(next);
    if (Result.isFailure(next)) return;
    files = new Map(next.success.files.map((file) => [file.path, file.text]));
    for (const listener of listeners) listener.enqueue('data: reload\n\n');
  };

  // Changes come in bursts (an editor's save, a loader writing its cache): build once
  // they settle, and never two builds at once.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> = Promise.resolve();
  const changed = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      running = running.then(rebuild);
    }, 100);
  };
  const watchers: ReadonlyArray<FSWatcher> = ['pages', 'data']
    .map((folder) => join(options.root, folder))
    .filter((folder) => existsSync(folder))
    .map((folder) => watch(folder, { recursive: true }, changed));

  return {
    url: `http://${address.host}:${server.port}/`,
    rebuild: () => (running = running.then(rebuild)),
    stop: () => {
      clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
      for (const listener of listeners) listener.close();
      server.stop(true);
    },
  };
}
