/* oxlint-disable linteffect/no-try-catch -- Tests dispatch Astro unmount in finally to release island scopes. */
import { Head, Subscription } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Schema, Stream } from 'effect';
import { expect, test, vi } from 'vitest';

import renderer from '../src/client';
import server from '../src/server';

const Summary = Html.component({ name: 'Summary', model: Schema.Null, message: Schema.Never }).make(
  {
    init: () => null,
    update: ({ model }) => model,
    head: () => [Head.title('Effect UI title')],
    view: (h) => h.p('Island summary'),
  },
);

function makeIsland(html = '') {
  const island = document.createElement('astro-island');
  island.innerHTML = html;
  return island;
}

test('adopts the direct server root once and leaves the Astro title in place', async () => {
  const { renderToStaticMarkup } = server;
  const { html } = await renderToStaticMarkup(
    Summary,
    {},
    {},
    {
      hydrate: 'load',
      displayName: 'Summary',
      astroStaticSlot: true,
    },
  );
  const island = makeIsland(`<aside><div data-effect-ui-root>Unrelated root</div></aside>${html}`);
  const paragraph = island.querySelector(':scope > [data-effect-ui-root] p');
  document.title = 'Astro title';
  const activate = renderer(island);
  const activation = activate(Summary, {}, {}, { client: 'load' });
  try {
    expect(activate(Summary, {}, {}, { client: 'load' })).toBe(activation);
    await activation;
    expect(paragraph).not.toBeNull();
    expect(island.querySelector(':scope > [data-effect-ui-root] p')).toBe(paragraph);
    expect(document.title).toBe('Astro title');
  } finally {
    island.dispatchEvent(new Event('astro:unmount'));
  }
});

test('client-only mounts replace the fallback and leave the Astro title in place', async () => {
  const island = makeIsland('<p>Fallback</p>');
  document.title = 'Astro title';
  try {
    await renderer(island)(Summary, {}, {}, { client: 'only' });
    expect(island.textContent).toBe('Island summary');
    expect(document.title).toBe('Astro title');
  } finally {
    island.dispatchEvent(new Event('astro:unmount'));
  }
});

test('Astro unmount releases subscriptions owned by the island', async () => {
  let active = 0;
  const acquire = Effect.sync(() => {
    active += 1;
  });
  const release = Effect.sync(() => {
    active -= 1;
  });
  const lifetime = Effect.acquireRelease(acquire, () => release);
  const tracking = Stream.unwrap(lifetime.pipe(Effect.map(() => Stream.never)));
  const component = Html.component({
    name: 'Scoped summary',
    model: Schema.Null,
    message: Schema.Never,
  }).make({
    init: () => null,
    update: ({ model }) => model,
    subscriptions: () => [Subscription.make('lifetime', tracking)],
    view: (h) => h.p('Island summary'),
  });
  const island = makeIsland();
  await renderer(island)(component, {}, {}, { client: 'only' });
  await vi.waitFor(() => expect(active).toBe(1));
  island.dispatchEvent(new Event('astro:unmount'));
  await vi.waitFor(() => expect(active).toBe(0));
});

test('hydration requires a direct root and a state script', async () => {
  const island = makeIsland('<div><div data-effect-ui-root></div></div>');
  await expect(renderer(island)(Summary, {}, {}, { client: 'load' })).rejects.toThrow(
    'Missing Effect UI hydration markup or state.',
  );
});

test('unsupported slots leave client-only fallbacks in place', async () => {
  const island = makeIsland('<p>Fallback</p>');
  await expect(
    renderer(island)(Summary, {}, { default: 'slot' }, { client: 'only' }),
  ).rejects.toThrow('Astro Effect UI slots are unsupported.');
  expect(island.textContent).toBe('Fallback');
});
