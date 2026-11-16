/**
 * Pages: Markdown with ```` ```plot ```` fences. Finding the fences and where they are,
 * a page's title and output path, and the HTML around its figures. Pure, apart from
 * Bun's Markdown renderer.
 * @module Page
 */
import { posix } from 'node:path';

/** A plot fence: its JSON, and the line of its opening ```` ``` ````, counting from 1. */
export type Fence = { readonly source: string; readonly line: number };

/** A page found in `pages/`: its path from the project root, and its Markdown. */
export type PageSource = { readonly file: string; readonly text: string };

const plotFence = /^```plot[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm;

/** The line of `text` at `offset`, counting from 1. */
const lineAt = (text: string, offset: number): number => text.slice(0, offset).split('\n').length;

/** Every plot fence on a page, in order. */
export const fencesOf = (text: string): ReadonlyArray<Fence> =>
  [...text.matchAll(plotFence)].map((match) => ({
    source: match[1] ?? '',
    line: lineAt(text, match.index),
  }));

/** A page's title: its first `#` heading, or its file name. */
export const titleOf = (page: PageSource): string =>
  /^#[ \t]+(.+?)[ \t#]*$/m.exec(page.text)?.[1] ?? posix.basename(page.file, '.md');

/** Where a page is written in `dist/`: `pages/a/b.md` is `a/b.html`. */
export const outputOf = (file: string): string =>
  posix.relative('pages', file).replace(/\.md$/, '.html');

/** A link from one output page to another, relative, so `dist/` works from any folder. */
export const hrefFrom = (from: string, to: string): string =>
  posix.relative(posix.dirname(from), to) || posix.basename(to);

/** Marks where figure `index` goes: a paragraph of its own that Markdown leaves alone. */
const marker = (index: number): string => `figure-${index}`;

/**
 * A page's body: its Markdown as HTML, raw HTML escaped (a page cannot run script), each
 * fence replaced by its figure, and links to other pages' `.md` pointed at their `.html`.
 */
export const bodyOf = (text: string, figures: ReadonlyArray<string>): string => {
  let index = -1;
  const marked = text.replace(plotFence, () => `\n${marker((index += 1))}\n`);
  return Bun.markdown
    .html(marked, { noHtmlBlocks: true, noHtmlSpans: true })
    .replace(/<p>figure-(\d+)<\/p>/g, (_, at: string) => figures[Number(at)] ?? '')
    .replace(/href="(?![a-z][a-z0-9+.-]*:|\/\/)([^"#]*?)\.md(#[^"]*)?"/gi, 'href="$1.html$2"');
};

/** A page in the navigation: its output path and title. */
export type NavEntry = { readonly output: string; readonly title: string };

const escape = (text: string): string => Bun.escapeHTML(text);

/** The list of every page, the current one marked. */
const navOf = (entries: ReadonlyArray<NavEntry>, current: string): string =>
  entries.length < 2
    ? ''
    : `<nav aria-label="Pages"><ul>${entries
        .map((entry) =>
          entry.output === current
            ? `<li><a aria-current="page" href="${hrefFrom(current, entry.output)}">${escape(entry.title)}</a></li>`
            : `<li><a href="${hrefFrom(current, entry.output)}">${escape(entry.title)}</a></li>`,
        )
        .join('')}</ul></nav>`;

const styles = `:root{color-scheme:light dark;--bg:#fbfbfa;--fg:#1d1d1f;--muted:#5f6368;--line:#e2e2df;--link:#2457c5}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--fg:#ececec;--muted:#a0a0a8;--line:#2e2e33;--link:#8ab4ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:820px;margin:0 auto;padding:24px 16px 64px}
nav{border-bottom:1px solid var(--line)}nav ul{display:flex;flex-wrap:wrap;gap:4px 16px;list-style:none;max-width:820px;margin:0 auto;padding:12px 16px}
a{color:var(--link)}nav a[aria-current="page"]{color:var(--fg);font-weight:600;text-decoration:none}
h1{font-size:2rem;line-height:1.2;margin:.5rem 0 1rem}h2{margin-top:2rem}
figure.chart{margin:1.5rem 0;overflow-x:auto}figure.chart svg{max-width:100%;height:auto}
code{font-size:.9em}pre{overflow-x:auto;padding:12px;border:1px solid var(--line);border-radius:6px}
table{border-collapse:collapse}th,td{padding:4px 8px;border-bottom:1px solid var(--line);text-align:left}
.problem{color:#c62828;border-left:3px solid currentColor;padding-left:12px}`;

/** A whole page: its document, navigation and body. Nothing in it changes between builds. */
export const documentOf = (options: {
  readonly title: string;
  readonly output: string;
  readonly nav: ReadonlyArray<NavEntry>;
  readonly body: string;
}): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="foldkit-dash">
<title>${escape(options.title)}</title>
<style>${styles}</style>
</head>
<body>
${navOf(options.nav, options.output)}
<main>
${options.body}
</main>
</body>
</html>
`;
