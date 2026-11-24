import { it } from '@effect/vitest';
import { Effect } from 'effect';
import { Scene } from 'foldkit';
import { expect, test } from 'vitest';

import { AllocateIdentity, init, update, view, Message } from '../src/editor/main';

it.effect('only a Command-allocated namespace exposes the editor; allocation can recover', () =>
  Effect.gen(function* () {
    const preparing = init().model;
    expect(preparing._tag).toBe('Preparing');
    const allocated = yield* AllocateIdentity().effect;
    expect(allocated._tag).toBe('SucceededIdentity');
    const ready = update(preparing, allocated).model;
    expect(ready._tag).toBe('Ready');
    const failed = update(preparing, Message.FailedIdentity()).model;
    expect(failed._tag).toBe('Failed');
    expect(update(failed, Message.ClickedRetryIdentity()).model._tag).toBe('Preparing');
    expect(update(ready, Message.SucceededIdentity({ namespace: 'late' })).model).toBe(ready);
  }),
);

test('retrying identity allocation shows progress and reports a second failure', () => {
  Scene.scene(
    { update, view },
    Scene.given(update(init().model, Message.FailedIdentity()).model),
    Scene.click(Scene.role('button', { name: 'Try again' })),
    Scene.expect(Scene.role('status')).toContainText('Preparing workbench'),
    Scene.Command.resolve(AllocateIdentity, Message.FailedIdentity()),
    Scene.tap(({ html }) => {
      expect(Scene.getByRole('alert')(html)).toHaveText(
        'Could not allocate a model identity. Your files remain unchanged.',
      );
    }),
  );
});
