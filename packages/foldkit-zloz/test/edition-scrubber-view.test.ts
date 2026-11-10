import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozEditionScrubber,
  zlozEditionScrubberInput,
  zlozEditionScrubberReadout,
  type ZlozEditionScrubberViewOptions,
} from '../src/foldkit';
import {
  createEditionPlayback,
  resolveEditionScrubber,
  type ZlozEditionSeekRequest,
  type ZlozEditionScrubberContext,
} from '../src/index';
const context = resolveEditionScrubber(createEditionPlayback(['a', 'b', 'c']), {
  labelEdition: (id) => `Named ${id}`,
});
async function render(
  value: ZlozEditionScrubberContext = context,
  options: ZlozEditionScrubberViewOptions<ZlozEditionSeekRequest> = {},
) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: value }),
        view: (model, h: HtmlBuilder<ZlozEditionSeekRequest>) => ({
          title: 'Seek',
          body: zlozEditionScrubber(h, model, (request) => request, options),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}
test('native range exposes named values and bounds while readout avoids duplicate live announcements', async () => {
  const document = await render();
  const input = document.querySelector('input');
  expect(input?.type).toBe('range');
  expect(input?.min).toBe('0');
  expect(input?.max).toBe('2');
  expect(input?.step).toBe('1');
  expect(input?.getAttribute('aria-label')).toBe('Seek edition');
  expect(input?.getAttribute('aria-valuetext')).toBe('Named a');
  expect(input?.disabled).toBe(false);
  expect(document.querySelector('output')?.getAttribute('aria-live')).toBe('off');
  expect(document.querySelector('button')?.getAttribute('aria-label')).toBe('Open edition');
});
test('single/empty/blocked states preserve explicit opening and visible reasons', async () => {
  const single = await render(resolveEditionScrubber(createEditionPlayback(['a'])));
  expect(single.querySelector('input')?.disabled).toBe(true);
  expect(single.querySelector('button')?.disabled).toBe(false);
  expect(single.querySelector('[aria-label="Edition seek availability"]')?.textContent).toContain(
    'one edition',
  );
  const empty = await render(resolveEditionScrubber(createEditionPlayback([])));
  expect(empty.querySelector('input')?.disabled).toBe(true);
  expect(empty.querySelector('button')?.disabled).toBe(true);
  const blocked = await render(
    resolveEditionScrubber(createEditionPlayback(['a', 'b']), { blockedReason: 'Protected' }),
  );
  expect(blocked.querySelector('input')?.getAttribute('aria-description')).toBe('Protected');
  expect(blocked.querySelector('button')?.disabled).toBe(true);
});
test('slots customize native input/readout and layout, or omit every part without changing the cursor', async () => {
  const document = await render(context, {
    renderInput: (value, h, onSeek) =>
      zlozEditionScrubberInput(h, value, onSeek, [h.Class('my-track')]),
    renderReadout: (value, h) =>
      zlozEditionScrubberReadout(h, value, [], [h.strong([], ['Custom']), value.valueText]),
    renderOpen: () => null,
    renderReason: () => null,
    renderLayout: (parts, _value, h) => [
      h.div(
        [h.Class('my-frame')],
        [...(parts.readout ? [parts.readout] : []), ...(parts.input ? [parts.input] : [])],
      ),
    ],
  });
  expect(document.querySelector('.my-frame')?.firstElementChild?.tagName).toBe('OUTPUT');
  expect(document.querySelector('.my-track')).not.toBeNull();
  expect(document.querySelector('button')).toBeNull();
  expect(document.querySelector('output')?.textContent).toBe('CustomNamed a');
  const omitted = await render(context, {
    renderInput: () => null,
    renderOpen: () => null,
    renderReadout: () => null,
    renderReason: () => null,
  });
  expect(omitted.querySelectorAll('input, output, button, p')).toHaveLength(0);
  expect(context.current?.editionId).toBe('a');
});
