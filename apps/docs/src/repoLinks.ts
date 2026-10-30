/**
 * Links in the docs as they work on GitHub, made to work on the site: a relative link to
 * another markdown file in `docs/` goes to its page, and one to anything else in the
 * repository (an image, a source file) goes to it on GitHub.
 *
 * @module
 */
import { dirname, relative, resolve } from 'node:path';

import type { Element, Root, RootContent } from 'hast';

import { slugOf } from './repoDocs';

type Options = Readonly<{
  /** The repository and docs folders, as file system paths. */
  repoRoot: string;
  docsRoot: string;
  /** The site's base path, ending in a slash. */
  base: string;
  /** The repository on GitHub, as `owner/name`, and the branch the site is built from. */
  repo: string;
  branch: string;
}>;

const isRelative = (href: string): boolean => !/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href);

/** Where a relative link in the markdown file at `from` should go on the site. */
export const siteHref = (href: string, from: string, options: Options): string => {
  const [path = '', hash] = href.split('#');
  const target = resolve(dirname(from), decodeURI(path));
  const inDocs = !relative(options.docsRoot, target).startsWith('..');
  const anchor = hash === undefined ? '' : `#${hash}`;
  const inRepo = relative(options.repoRoot, target);
  return inDocs && target.endsWith('.md')
    ? `${options.base}${slugOf(relative(options.docsRoot, target))}/${anchor}`
    : `https://github.com/${options.repo}/blob/${options.branch}/${inRepo}${anchor}`;
};

/** Where an image in the markdown file at `from` is served from. */
const imageSrc = (src: string, from: string, options: Options): string =>
  `https://raw.githubusercontent.com/${options.repo}/${options.branch}/${relative(
    options.repoRoot,
    resolve(dirname(from), decodeURI(src)),
  )}`;

const rewrite = (node: Element, from: string, options: Options): void => {
  const { href, src } = node.properties;
  if (node.tagName === 'a' && typeof href === 'string' && isRelative(href)) {
    node.properties.href = siteHref(href, from, options);
  }
  if (node.tagName === 'img' && typeof src === 'string' && isRelative(src)) {
    node.properties.src = imageSrc(src, from, options);
  }
};

const walk = (node: Root | RootContent, from: string, options: Options): void => {
  if (node.type === 'element') rewrite(node, from, options);
  if ('children' in node) for (const child of node.children) walk(child, from, options);
};

/** The rehype plugin: rewrites a page's relative links, given its file's path. */
export const rehypeRepoLinks =
  (options: Options) => () => (tree: Root, file: { path?: string }) => {
    if (file.path !== undefined) walk(tree, file.path, options);
  };
