import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozPlaybackControls,
  zlozPlaybackControl,
  zlozPlaybackStatus,
  type ZlozPlaybackControlsViewOptions,
} from '../src/foldkit';
import {
  createEditionPlayback,
  resolveEditionPlaybackControls,
  type ZlozPlaybackControlEvent,
  type ZlozPlaybackControlsContext,
} from '../src/index';
const context = resolveEditionPlaybackControls(createEditionPlayback(['a', 'b']), {
  editionLabel: 'Original',
});
async function render(
  options: ZlozPlaybackControlsViewOptions<ZlozPlaybackControlEvent> = {},
  value: ZlozPlaybackControlsContext = context,
) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: value }),
        view: (model, h: HtmlBuilder<ZlozPlaybackControlEvent>) => ({
          title: 'Playback',
          body: zlozPlaybackControls(h, model, (event) => event, options),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}
test('default native transport has names, disabled reasons, polite status and available manual steps', async () => {
  const document = await render();
  expect(document.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
    'Edition playback controls',
  );
  expect(document.querySelectorAll('button')).toHaveLength(5);
  const play = document.querySelector('button[aria-label="Play editions"]');
  expect(play?.hasAttribute('disabled')).toBe(true);
  expect(play?.getAttribute('aria-description')).toContain('reduced motion');
  expect(play?.getAttribute('type')).toBe('button');
  expect(
    document.querySelector('button[aria-label="Next edition"]')?.hasAttribute('disabled'),
  ).toBe(false);
  expect(
    document.querySelector('[aria-label="Edition playback status"]')?.getAttribute('aria-live'),
  ).toBe('polite');
  expect(document.querySelector('[aria-label="Edition playback status"]')?.textContent).toBe(
    'Paused · Original',
  );
  expect(document.querySelector('[aria-label="Playback availability"]')?.textContent).toContain(
    'reduced motion',
  );
});
test('slots can omit parts, retain defaults and replace content/layout through the native helpers', async () => {
  const document = await render({
    renderControl: (action, h, onEvent) =>
      action.name === 'pause'
        ? null
        : action.name === 'rewind'
          ? zlozPlaybackControl(h, action, onEvent, [h.Class('custom-pill')], ['Start again'])
          : undefined,
    renderStatus: (value, h) =>
      zlozPlaybackStatus(h, value, [], [h.strong([], ['Review']), value.statusText]),
    renderReason: () => null,
    renderLayout: (parts, _value, h) => [
      h.div([h.Class('controls-first')], parts.controls),
      ...(parts.status ? [parts.status] : []),
    ],
  });
  expect(document.querySelector('button[aria-label="Pause editions"]')).toBeNull();
  expect(document.querySelector('button[aria-label="Play editions"]')).not.toBeNull();
  expect(document.querySelector('.custom-pill')?.textContent).toBe('Start again');
  expect(document.querySelector('[aria-label="Playback availability"]')).toBeNull();
  expect(document.querySelector('[role="group"]')?.firstElementChild?.className).toBe(
    'controls-first',
  );
  expect(document.querySelector('[aria-label="Edition playback status"]')?.textContent).toBe(
    'ReviewPaused · Original',
  );
});
test('subsets, complete omission and localized labels do not change the cursor or add timer behavior', async () => {
  const cursor = context.playback;
  const subset = await render({
    controls: ['next', 'play', 'play'],
    statusLabel: 'Current checkpoint',
    reasonLabel: 'Why unavailable',
  });
  expect(
    [...subset.querySelectorAll('button')].map((button) => button.getAttribute('aria-label')),
  ).toEqual(['Next edition', 'Play editions']);
  expect(subset.querySelector('[aria-label="Current checkpoint"]')).not.toBeNull();
  expect(subset.querySelector('[aria-label="Why unavailable"]')).not.toBeNull();
  const omitted = await render({
    controls: [],
    renderStatus: () => null,
    renderReason: () => null,
  });
  expect(omitted.querySelectorAll('button, [role="status"]')).toHaveLength(0);
  expect(context.playback).toBe(cursor);
});
test('native helpers retain disabled semantics with custom content and conflicting attributes', async () => {
  const document = await render({
    renderControl: (action, h, onEvent) =>
      zlozPlaybackControl(
        h,
        action,
        onEvent,
        [h.Type('submit'), h.Disabled(false)],
        [h.span([], ['Custom'])],
      ),
  });
  const play = document.querySelector('button[aria-label="Play editions"]');
  expect(play?.hasAttribute('disabled')).toBe(true);
  expect(play?.getAttribute('type')).toBe('button');
  expect(play?.getAttribute('aria-description')).toContain('reduced motion');
});
