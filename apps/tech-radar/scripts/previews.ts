/*
 * Renders every page's link preview to `public/preview/<path>.png`, 1200×630, before the
 * site builds: satori lays the card out and turns its text into paths with B612, and sharp
 * rasterises it. It runs on Bun rather than as an Astro endpoint because the production
 * build prerenders in workerd, where neither runs. The cards come from the same markdown
 * and the same assembler as the site, and `src/components/Meta.astro` links each page's.
 *
 *   bun run previews
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { Option, Result, Schema } from 'effect';
import satori from 'satori';
import sharp from 'sharp';

import {
  assembleRadar,
  type ContentFile,
  EditionFile,
  entriesByTag,
  RadarFile,
} from '../src/radar/content';
import { editionsIn } from '../src/radar/pages';
import { type Preview, previewColours, previewsOf, radarSvg } from '../src/radar/preview';

const content = new URL('../src/content/', import.meta.url);
const output = new URL('../public/preview/', import.meta.url);

/** A markdown file's frontmatter and body. */
const parse = (path: URL) => {
  const text = readFileSync(path, 'utf8');
  const [, frontmatter = '', body = ''] = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text) ?? [];
  return { data: Bun.YAML.parse(frontmatter), body };
};

/** A folder's markdown as the content collections hand it over. */
const read = (folder: string): ReadonlyArray<ContentFile> =>
  readdirSync(new URL(folder, content))
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({
      id: name.slice(0, -'.md'.length),
      data: parse(new URL(`${folder}/${name}`, content)).data,
    }));

const editionFiles = read('editions');
const entryFiles = read('entries');
const radar = Result.getOrThrowWith(
  assembleRadar({ editions: editionFiles, entries: entryFiles }),
  (reason) => new Error(`The radar's markdown: ${reason}`),
);
const about = parse(new URL('radar.md', content));
const title = Schema.decodeUnknownSync(RadarFile)(about.data).title;
const currentLabel =
  editionFiles
    .map(({ data }) => Schema.decodeUnknownSync(EditionFile)(data))
    .find(({ date }) => date === radar.authoredOn)?.label ?? 'Current edition';
const previews = previewsOf(radar, editionsIn(radar, currentLabel), entriesByTag(entryFiles), {
  title,
  intro: about.body.trim(),
});

const width = 1200;
const height = 630;
const radarSize = 420;

const font = (file: string) =>
  readFileSync(Bun.resolveSync(`@fontsource/${file}`, import.meta.dir));

const fonts = [
  { name: 'B612', data: font('b612/files/b612-latin-400-normal.woff'), weight: 400 as const },
  { name: 'B612', data: font('b612/files/b612-latin-700-normal.woff'), weight: 700 as const },
  {
    name: 'B612 Mono',
    data: font('b612-mono/files/b612-mono-latin-400-normal.woff'),
    weight: 400 as const,
  },
];

/** satori's elements are plain objects in React's shape: a tag, its style and children. */
type Style = Readonly<Record<string, string | number>>;
type Props = Readonly<{ style?: Style; src?: string; width?: number; height?: number }>;
type Child = Node | string;
type Node = Readonly<{
  type: 'div' | 'img';
  key: null;
  props: Props & { children: ReadonlyArray<Child> };
}>;
const h = (type: Node['type'], props: Props, ...children: ReadonlyArray<Child>): Node => ({
  type,
  key: null,
  props: { ...props, children },
});

/** Long lines end in an ellipsis rather than spill off the card. */
const clip = (text: string, length: number) =>
  text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;

const card = (preview: Preview): Node => {
  const colour = Option.match(preview.category, {
    onNone: () => previewColours.accent,
    onSome: previewColours.category,
  });
  const svg = Buffer.from(radarSvg(radar, preview, radarSize)).toString('base64');
  const badge = Option.match(preview.badge, {
    onNone: () => '',
    onSome: (label) =>
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignSelf: 'flex-start',
            padding: '6px 18px',
            marginTop: 20,
            border: `2px solid ${colour}`,
            background: `${colour}33`,
            color: previewColours.ink,
            fontFamily: 'B612 Mono',
            fontSize: 28,
          },
        },
        label,
      ),
  });
  return h(
    'div',
    {
      style: {
        display: 'flex',
        width,
        height,
        background: previewColours.page,
        borderTop: `10px solid ${colour}`,
        color: previewColours.ink,
        fontFamily: 'B612',
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: '56px 24px 48px 64px',
        },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            color: previewColours.muted,
            fontFamily: 'B612 Mono',
            fontSize: 26,
            letterSpacing: 2,
            textTransform: 'uppercase',
          },
        },
        h('div', { style: { width: 18, height: 18, borderRadius: 9, background: colour } }),
        preview.eyebrow,
      ),
      h(
        'div',
        { style: { marginTop: 18, fontSize: 68, fontWeight: 700, lineHeight: 1.1 } },
        clip(preview.title, 40),
      ),
      badge,
      h(
        'div',
        {
          style: {
            marginTop: 28,
            fontSize: 30,
            lineHeight: 1.4,
            color: previewColours.ink,
            opacity: 0.9,
          },
        },
        clip(preview.body, 150),
      ),
      h(
        'div',
        {
          style: {
            marginTop: 'auto',
            color: previewColours.muted,
            fontFamily: 'B612 Mono',
            fontSize: 22,
          },
        },
        preview.footer,
      ),
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: radarSize + 96,
        },
      },
      h('img', { src: `data:image/svg+xml;base64,${svg}`, width: radarSize, height: radarSize }),
    ),
  );
};

rmSync(output, { recursive: true, force: true });
for (const preview of previews) {
  const svg = await satori(card(preview), { width, height, fonts });
  const png = await sharp(Buffer.from(svg)).png({ palette: true, compressionLevel: 9 }).toBuffer();
  const file = new URL(`${preview.path}.png`, output);
  mkdirSync(dirname(file.pathname), { recursive: true });
  writeFileSync(file, png);
}
console.log(`${previews.length} link previews in public/preview/`);
