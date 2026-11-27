import { expect, test } from 'bun:test';

import { highlightedTree } from '@opsydyn/dataset-explorer/highlighting-core';
import { createHighlighter } from '@opsydyn/dataset-explorer/highlighting-engine';
import {
  parseSourceLine,
  sourceLineId,
  sourceLines,
  linkedSourceTree,
} from '@opsydyn/dataset-explorer/source-line-core';
import { sourceLineChanges } from '@opsydyn/dataset-explorer/source-ui';
import { Effect, Option, Stream } from 'effect';
import { Window } from 'happy-dom';
import { toHtml } from 'hast-util-to-html';

const engine = await createHighlighter();
const text = (node: import('hast').Root | import('hast').Element): string =>
  node.children
    .map((child) =>
      child.type === 'text' ? child.value : child.type === 'element' ? text(child) : '',
    )
    .join('');

test('multiline tokens preserve whitespace, empty lines and nesting', () => {
  const source = '/* first\n\tsecond */\n\nconst html = "<b>";\r\n';
  const lines = sourceLines(highlightedTree(source, 'ts', engine));
  expect(lines.map(text).join('\n')).toBe(source);
  expect(text(linkedSourceTree(highlightedTree(source, 'ts', engine), 'sample.ts'))).toBe(source);
  expect(lines).toHaveLength(5);
  expect(toHtml(Option.getOrThrow(Option.fromNullishOr(lines[0])))).toContain('pl-c');
  expect(toHtml(Option.getOrThrow(Option.fromNullishOr(lines[1])))).toContain('pl-c');
  expect(toHtml(Option.getOrThrow(Option.fromNullishOr(lines[3])))).not.toContain('<b>');
});

test('line links roundtrip file paths and reject malformed locations', () => {
  const name = 'web/src/apps/comparison/view.ts';
  const id = sourceLineId(name, 37);
  expect(parseSourceLine('#' + encodeURIComponent(id))).toEqual(Option.some({ name, line: 37 }));
  for (const hash of [
    '#installation',
    '#source-x-L0',
    '#source-x-L-1',
    '#source-x-L1.5',
    '#source-%ZZ-L3',
    '#source-x-L9007199254740992',
  ]) {
    expect(Option.isNone(parseSourceLine(hash))).toBe(true);
  }
});

test('opening a maintained source line selects the file and schedules native focus', async () => {
  const { init } = await import('../src/examples/line/model');
  const { Message } = await import('../src/examples/line/message');
  const { update } = await import('../src/examples/line/update');
  const model = init({
    sources: [{ name: 'view.ts', content: 'a\nb\nc' }],
    templateUrl: null,
  }).model;
  const result = update(
    { ...model, panel: 'edit' },
    Message.NavigatedSourceLine({ name: 'view.ts', line: 2 }),
  );
  expect(result.model.activeFile).toBe('view.ts');
  expect(result.model.panel).toBe('controls');
  expect(result.commands?.[0]).toMatchObject({
    name: 'FocusLineSourceLine',
    args: { name: 'view.ts', line: 2 },
  });
  expect(update(model, Message.NavigatedSourceLine({ name: '../../secret', line: 2 })).model).toBe(
    model,
  );
  expect(update(model, Message.NavigatedSourceLine({ name: 'view.ts', line: 100 })).model).toBe(
    model,
  );
});

test('the native stream reads a linked file on mount', async () => {
  const window = new Window({ url: 'https://demo.test/#source-view.ts-L2' });
  // SAFETY: Happy DOM supplies the document and window APIs read by the stream.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions
  const host = window.document.createElement('div') as unknown as HTMLElement;
  const result = await Effect.runPromise(
    sourceLineChanges(host).pipe(Stream.take(1), Stream.runCollect),
  );
  expect(result).toEqual([{ name: 'view.ts', line: 2 }]);
});
