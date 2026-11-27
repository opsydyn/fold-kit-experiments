import { HtmlLocator, HtmlScene } from '@effect/ui/html/testing';
import { it } from '@effect/vitest';
import { Effect } from 'effect';
import { expect } from 'vitest';

import { default as Architecture, allocateIdentity, Lifecycle } from '../src/editor/main';

it.effect('identity allocation is a command and retry can report a second failure', () =>
  Effect.gen(function* () {
    const scene = yield* HtmlScene.make(Architecture, {});
    const status = HtmlLocator.role('status');
    const alert = HtmlLocator.role('alert');
    scene.expect(status).toHaveText('Preparing workbench…');
    scene.expectExact(allocateIdentity.make({}));
    scene.resolve(allocateIdentity, Lifecycle.FailedIdentity());
    scene
      .expect(alert)
      .toHaveText('Could not allocate a model identity. Your files remain unchanged.');
    scene.click(HtmlLocator.role('button', { name: 'Try again' }));
    scene.expect(status).toHaveText('Preparing workbench…');
    scene.expectExact(allocateIdentity.make({}));
    scene.resolve(allocateIdentity, Lifecycle.FailedIdentity());
    scene
      .expect(alert)
      .toHaveText('Could not allocate a model identity. Your files remain unchanged.');
  }).pipe(Effect.scoped),
);

it.effect('identity allocation produces a browser namespace', () =>
  Effect.gen(function* () {
    const allocated = yield* allocateIdentity.make({}).effect;
    expect(allocated._tag).toBe('SucceededIdentity');
    if (allocated._tag === 'SucceededIdentity')
      expect(allocated.namespace).toMatch(/^[0-9a-f-]{36}$/);
  }),
);
