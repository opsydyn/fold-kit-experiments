import { Schema } from 'effect';
import { expect, it } from 'vitest';

import { Message } from './message';
import { init, Props } from './model';
import { update } from './update';

it('restores a persisted name without overwriting a draft typed during startup', () => {
  const initial = init(Schema.decodeSync(Props)({ defaultName: 'Requested' }));
  const restored = Message.RestoredUsername({ username: 'Ada' });
  expect(update(initial, restored).model.draft).toBe('Ada');
  const edited = update(initial, Message.UpdatedDraft({ value: 'Grace' })).model;
  expect(update(edited, restored).model).toBe(edited);
});

it('does not mark a newer unsaved draft as saved when a previous save completes', () => {
  const initial = init(Schema.decodeSync(Props)({ defaultName: 'Ada' }));
  const saving = update(initial, Message.ClickedSave()).model;
  const edited = update(saving, Message.UpdatedDraft({ value: 'Grace' })).model;
  const completed = Message.CompletedSaveUsername({ username: 'Ada' });
  expect(update(saving, completed).model.isSaved).toBe(true);
  expect(update(edited, completed).model.isSaved).toBe(false);
});
