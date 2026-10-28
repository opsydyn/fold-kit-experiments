/**
 * One-off: writes the radar's fixture as markdown content, one file per entry and per
 * edition. Kept for one commit so the conversion can be audited, then deleted; from then
 * on the markdown is the source.
 *
 *   bun scripts/fixture-to-markdown.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { demoRadar } from '../src/radar/three/fixture';

const content = new URL('../src/content/', import.meta.url);
const editionLabels = ['First edition', 'Second edition', 'Third edition', 'Fourth edition'];

/** A YAML scalar: plain when that reads back as the same string, double-quoted otherwise. */
const scalar = (text: string): string =>
  /^[A-Za-z][\w .,()&+/-]*$/.test(text) && !/[:#]/.test(text) ? text : JSON.stringify(text);
const date = (text: string): string => `'${text}'`;

const write = (path: string, lines: ReadonlyArray<string>, body = ''): void => {
  const url = new URL(path, content);
  mkdirSync(new URL('.', url), { recursive: true });
  writeFileSync(url, `---\n${lines.join('\n')}\n---\n${body === '' ? '' : `\n${body}\n`}`);
};

write(
  'radar.md',
  [`title: Tech radar`],
  'Functional programming and AI tooling, placed in four rings across four categories.',
);

const editions = [...demoRadar.editions, { authoredOn: demoRadar.authoredOn }];
editions.forEach((edition, index) =>
  write(`editions/${edition.authoredOn}.md`, [
    `date: ${date(edition.authoredOn)}`,
    `label: ${scalar(editionLabels[index] ?? `Edition ${index + 1}`)}`,
  ]),
);

for (const entry of demoRadar.entries) {
  const history = demoRadar.editions.flatMap((edition) =>
    edition.absent.some((id) => id === entry.id)
      ? []
      : [
          `  - edition: ${date(edition.authoredOn)}`,
          `    ring: ${new Map<string, string>(Object.entries(edition.rings)).get(entry.id) ?? entry.ring}`,
        ],
  );
  const related = demoRadar.relationships
    .filter(({ from }) => from === entry.id)
    .flatMap(({ to, type, note }) => [
      `  - to: ${to}`,
      `    type: ${type}`,
      `    note: ${scalar(note)}`,
    ]);
  write(`entries/${entry.id}.md`, [
    `name: ${scalar(entry.name)}`,
    `category: ${entry.category}`,
    `ring: ${entry.ring}`,
    `summary: ${scalar(entry.description)}`,
    `source: ${entry.sourceUrl}`,
    ...(history.length > 0 ? ['history:', ...history] : []),
    ...(related.length > 0 ? ['related:', ...related] : []),
  ]);
}
