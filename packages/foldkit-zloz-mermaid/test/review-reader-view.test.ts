import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozReviewReader, type ZlozReviewReaderViewOptions } from '../src/foldkit';
import {
  createReviewReader,
  updateReviewReader,
  type ZlozReviewReaderOptions,
  type ZlozReviewReaderRequest,
} from '../src/index';
import literal from './fixtures/review-packet-v1.json';
async function render(
  options: ZlozReviewReaderViewOptions<ZlozReviewReaderRequest> = {},
  policy: ZlozReviewReaderOptions = {},
) {
  const scope = 'reader/1';
  const pending = updateReviewReader(createReviewReader(scope), {
    scope,
    type: 'ReadRequested',
    file: { name: 'packet.json', byteLength: 40000 },
  }).state;
  const state = updateReviewReader(pending, {
    scope,
    type: 'ReadSucceeded',
    run: 1,
    text: JSON.stringify(literal),
  }).state;
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<ZlozReviewReaderRequest>) => ({
          title: 'Reader',
          body: zlozReviewReader(
            h,
            model,
            (r) => r,
            (): ZlozReviewReaderRequest => ({ scope, type: 'ReadFailed', run: 1 }),
            policy,
            options,
          ),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}
test('native reader exposes independent opening and side protection, selected state and functional findings', async () => {
  const dom = await render(
    {},
    { blockedReason: 'Opening protected', selectionReason: 'Finish gesture' },
  );
  expect(dom.querySelector('input[type="file"]')?.hasAttribute('disabled')).toBe(true);
  expect(dom.querySelector('[aria-pressed="true"]')?.textContent).toContain('Selected');
  expect(dom.querySelector('[aria-pressed="false"]')?.hasAttribute('disabled')).toBe(true);
  expect(dom.body.textContent).toContain('Finish gesture');
  expect(dom.querySelector('[aria-label="Packet findings"]')?.textContent).toContain('Introduced');
  expect(dom.querySelector('[data-review-reader-counts]')).not.toBeNull();
});
test('minimal controls keep findings and actions; null slots omit and custom layout composes', async () => {
  const minimal = await render({ showCounts: false, instructions: false });
  expect(minimal.querySelector('[data-review-reader-counts]')).toBeNull();
  expect(minimal.querySelectorAll('button').length).toBe(3);
  expect(minimal.querySelector('[aria-label="Packet findings"]')?.textContent).toContain(
    'Introduced',
  );
  const custom = await render({
    renderSummary: () => null,
    renderFinding: (f, h) => h.li([], [`Custom: ${f.code}`]),
    renderLayout: (parts, h) => [
      h.strong([], ['Custom reader']),
      ...[parts.summary, parts.findings, parts.close].flatMap((p) => (p === null ? [] : [p])),
    ],
  });
  expect(custom.body.textContent).toContain('Custom reader');
  expect(custom.body.textContent).toContain('Custom:');
  expect(custom.querySelector('input')).toBeNull();
  expect(custom.querySelector('[data-review-reader-counts]')).toBeNull();
});
