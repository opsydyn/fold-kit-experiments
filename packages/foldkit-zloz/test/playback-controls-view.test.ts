import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  playbackControls,
  playbackControl,
  playbackStatus,
  type ZlozPlaybackControlsViewOptions,
} from '../src/effect-ui';
import {
  createEditionPlayback,
  resolveEditionPlaybackControls,
  type ZlozPlaybackControlsContext,
} from '../src/index';
const context = resolveEditionPlaybackControls(createEditionPlayback(['a', 'b']), {
  editionLabel: 'Original',
});
async function render(
  options: ZlozPlaybackControlsViewOptions<string> = {},
  value: ZlozPlaybackControlsContext = context,
) {
  const Review = Html.component({
    name: 'Playback',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) => playbackControls(h, value, (event) => event.type, options),
  });
  const result = await Effect.runPromise(HtmlServer.renderToHtml(Review, {}, { static: true }));
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
          ? playbackControl(h, action, onEvent, (element) => element.class('custom-pill'), [
              'Start again',
            ])
          : undefined,
    renderStatus: (value, h) =>
      playbackStatus(h, value, undefined, [h.strong('Review'), value.statusText]),
    renderReason: () => null,
    renderLayout: (parts, _value, h) => [
      h.div.class('controls-first').children(parts.controls),
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
      playbackControl(
        h,
        action,
        onEvent,
        (element) => element.attr('type', 'submit').disabled(false),
        [h.span('Custom')],
      ),
  });
  const play = document.querySelector('button[aria-label="Play editions"]');
  expect(play?.hasAttribute('disabled')).toBe(true);
  expect(play?.getAttribute('type')).toBe('button');
  expect(play?.getAttribute('aria-description')).toContain('reduced motion');
});
