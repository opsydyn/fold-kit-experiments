/**
 * The repository's `docs/` folder as Starlight's docs collection, read in place: nothing
 * is copied or written twice. Each markdown file becomes a page; its first `#` heading is
 * the page title (Starlight shows it, so it leaves the body), and a folder's README is
 * the folder's page. Hidden folders are left out.
 *
 * @module
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Loader } from 'astro/loaders';

/** Every markdown file under `dir`, as paths relative to it, skipping hidden folders. */
export const markdownFiles = async (dir: string, under = ''): Promise<ReadonlyArray<string>> => {
  const entries = await readdir(join(dir, under), { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter(({ name }) => !name.startsWith('.'))
      .map((entry) => {
        const path = join(under, entry.name);
        return entry.isDirectory()
          ? markdownFiles(dir, path)
          : Promise.resolve(entry.name.endsWith('.md') ? [path] : []);
      }),
  );
  return nested.flat();
};

/** A file's page id: its path without `.md`, a README standing for its folder. */
export const slugOf = (path: string): string => {
  const parts = path.split(sep).join('/').replace(/\.md$/, '').split('/');
  const named = parts.at(-1)?.toLowerCase() === 'readme' ? parts.slice(0, -1) : parts;
  return named.join('/').toLowerCase() || 'index';
};

/** The first `#` heading as the title, and the body without it; else the fallback title. */
export const titled = (
  text: string,
  fallback: string,
): Readonly<{ title: string; body: string }> => {
  const heading = /^#[ \t]+(.+?)[ \t#]*$/m.exec(text);
  return heading === null
    ? { title: fallback, body: text }
    : {
        title: heading[1]?.replace(/`/g, '') ?? fallback,
        body: text.slice(0, heading.index) + text.slice(heading.index + heading[0].length),
      };
};

/** The docs folder, from the site's root (`apps/docs`). */
export const docsFolder = (root: URL): string => fileURLToPath(new URL('../../docs/', root));

export const repoDocs = (): Loader => ({
  name: 'repo-docs',
  load: async ({ config, store, parseData, renderMarkdown, generateDigest, watcher, logger }) => {
    const folder = docsFolder(config.root);
    const sync = async () => {
      const paths = await markdownFiles(folder);
      store.clear();
      for (const path of paths) {
        const file = join(folder, path);
        const text = await readFile(file, 'utf8');
        const id = slugOf(path);
        const { title, body } = titled(text, id.split('/').at(-1) ?? id);
        const data = await parseData({ id, data: { title } });
        store.set({
          id,
          data,
          body,
          filePath: relative(fileURLToPath(config.root), file),
          digest: generateDigest(text),
          rendered: await renderMarkdown(body, { fileURL: new URL(`file://${file}`) }),
        });
      }
      logger.info(`${paths.length} pages from docs/`);
    };
    await sync();
    watcher?.add(folder);
    watcher?.on('all', (_event, changed) => {
      if (changed.startsWith(folder) && changed.endsWith('.md')) void sync();
    });
  },
});
