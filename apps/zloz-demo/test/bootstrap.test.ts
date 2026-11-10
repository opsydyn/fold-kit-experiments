import { expect, test } from 'bun:test';

import { Effect } from 'effect';

import { AllocateIdentity, init, update, Message } from '../src/editor/main';

test('only a Command-allocated namespace exposes the editor; allocation can recover', async () => {
  const preparing = init().model;
  expect(preparing._tag).toBe('Preparing');
  const allocated = await Effect.runPromise(AllocateIdentity().effect);
  expect(allocated._tag).toBe('SucceededIdentity');
  const ready = update(preparing, allocated).model;
  expect(ready._tag).toBe('Ready');
  const failed = update(preparing, Message.FailedIdentity()).model;
  expect(failed._tag).toBe('Failed');
  expect(update(failed, Message.ClickedRetryIdentity()).model._tag).toBe('Preparing');
  expect(update(ready, Message.SucceededIdentity({ namespace: 'late' })).model).toBe(ready);
});
