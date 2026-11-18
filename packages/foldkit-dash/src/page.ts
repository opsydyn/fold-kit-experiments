/**
 * Pages: Markdown with ```` ```plot ```` and ```` ```input ```` fences. Finding the
 * fences and where they are, a page's title and output path, and the HTML around its
 * figures. Pure, apart from Bun's Markdown renderer.
 * @module Page
 */
import { posix } from 'node:path';

/**
 * A fence foldkit-dash reads: a chart (```` ```plot ````) or an input (```` ```input ````),
 * its JSON, and the line of its opening ```` ``` ````, counting from 1.
 */
export type Fence = {
  readonly kind: 'plot' | 'input';
  readonly source: string;
  readonly line: number;
};

/** A page found in `pages/`: its path from the project root, and its Markdown. */
export type PageSource = { readonly file: string; readonly text: string };

const dashFence = /^```(plot|input)[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm;

/** The line of `text` at `offset`, counting from 1. */
const lineAt = (text: string, offset: number): number => text.slice(0, offset).split('\n').length;

/** Every plot and input fence on a page, in order. */
export const fencesOf = (text: string): ReadonlyArray<Fence> =>
  [...text.matchAll(dashFence)].map((match) => ({
    kind: match[1] === 'input' ? 'input' : 'plot',
    source: match[2] ?? '',
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

/** A character no page uses, around each fence's marker. */
const PRIVATE = '\u{E000}';

/** Marks where fence `index` goes: a paragraph of its own that Markdown leaves alone. */
const marker = (index: number): string => `${PRIVATE}fence-${index}${PRIVATE}`;

const markerParagraph = new RegExp(`(<p>${PRIVATE}fence-\\d+${PRIVATE}</p>)`);

const markerIndex = new RegExp(`^<p>${PRIVATE}fence-(\\d+)${PRIVATE}</p>$`);

/**
 * A page's Markdown as HTML, raw HTML escaped (a page cannot run script), links to other
 * pages' `.md` pointed at their `.html` (keeping any query and hash), and each fence left as its own marker paragraph.
 */
const markedHtml = (text: string): string => {
  let index = -1;
  const marked = text.replace(dashFence, () => `\n${marker((index += 1))}\n`);
  return Bun.markdown
    .html(marked, { noHtmlBlocks: true, noHtmlSpans: true })
    .replace(
      /href="(?![a-z][a-z0-9+.-]*:|\/\/)([^"#?]*?)\.md((?:\?[^"#]*)?(?:#[^"]*)?)"/gi,
      'href="$1.html$2"',
    );
};

/** A page as prose and fences, in order: the HTML between fences, and each fence's index. */
export type Section =
  | { readonly _tag: 'Prose'; readonly html: string }
  | { readonly _tag: 'Fence'; readonly index: number };

/** A page's sections: prose HTML, and each fence (by its index in `fencesOf`) in place. */
export const sectionsOf = (text: string): ReadonlyArray<Section> =>
  markedHtml(text)
    .split(markerParagraph)
    .flatMap((part): ReadonlyArray<Section> => {
      const at = markerIndex.exec(part)?.[1];
      if (at !== undefined) return [{ _tag: 'Fence', index: Number(at) }];
      return part.trim() === '' ? [] : [{ _tag: 'Prose', html: part }];
    });

/** A page's body: its Markdown as HTML, each fence replaced by its figure, in order. */
export const bodyOf = (text: string, figures: ReadonlyArray<string>): string =>
  sectionsOf(text)
    .map((section) => (section._tag === 'Prose' ? section.html : (figures[section.index] ?? '')))
    .join('');

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
.problem{color:#c62828;border-left:3px solid currentColor;padding-left:12px}
.control{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:1rem 0;padding:0;border:0}
.control legend{float:left;margin-right:12px;padding:0}.control label{display:inline-flex;align-items:center;gap:6px}
.control select,.control input[type=range]{font:inherit;min-width:0;max-width:100%}
.chart.selects svg,.chart.selects .plot-legend li{cursor:pointer}
.chart:focus-visible{outline:2px solid currentColor;outline-offset:4px}
.chart.brushes svg{cursor:crosshair;touch-action:pan-y}
.control input[type=date],.control input[type=number]{font:inherit;max-width:11em}
.readout{min-height:1.5em;margin:.25rem 0 0;font-variant-numeric:tabular-nums}
.control select{padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
.control output{font-variant-numeric:tabular-nums}`;

/** A whole page: its document, navigation and body. Nothing in it changes between builds. */
export const documentOf = (options: {
  readonly title: string;
  readonly output: string;
  readonly nav: ReadonlyArray<NavEntry>;
  readonly body: string;
  /** The page script, for a page with inputs, relative to the page. */
  readonly script?: string;
}): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="foldkit-dash">
<title>${escape(options.title)}</title>
<style>${styles}</style>
${options.script === undefined ? '' : `<script defer src="${escape(options.script)}"></script>\n`}</head>
<body>
${navOf(options.nav, options.output)}
<main>
${options.body}
</main>
</body>
</html>
`;
