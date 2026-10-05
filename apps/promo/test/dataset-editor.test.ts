import { expect, test } from 'bun:test';

import { Message } from '../src/examples/datasets/launcher/message';
import { init } from '../src/examples/datasets/launcher/model';
import { update } from '../src/examples/datasets/launcher/update';

test('dataset editor stays idle until explicitly opened', () => {
  const initial = init({ templateUrl: '/downloads/dataset-template.json' });
  expect(initial.model.editor).toEqual({ _tag: 'Idle' });
  expect(initial.model.editorVisible).toBe(false);
});

const initial = () => init({ templateUrl: '/downloads/dataset-template.json' }).model;

test('closing and reopening retains the same editor session', () => {
  const opened = update(initial(), Message.ClickedEditor()).model;
  expect(opened.editorVisible).toBe(true);
  expect(opened.editor).toMatchObject({ revision: 1, status: { _tag: 'Loading' } });
  const connected = update(opened, Message.SucceededEditor({ revision: 1 })).model;
  const closed = update(connected, Message.ClickedCloseEditor()).model;
  expect(closed.editorVisible).toBe(false);
  expect(closed.editor).toBe(connected.editor);
  const reopened = update(closed, Message.ClickedEditor()).model;
  expect(reopened.editorVisible).toBe(true);
  expect(reopened.editor).toBe(connected.editor);
});

test('failed editor can retry without accepting completions from its previous session', () => {
  const opened = update(initial(), Message.ClickedEditor()).model;
  const failed = update(
    opened,
    Message.FailedEditor({ revision: 1, error: 'Network unavailable' }),
  ).model;
  expect(failed.editor).toMatchObject({ status: { _tag: 'Failed', error: 'Network unavailable' } });
  const retried = update(failed, Message.ClickedRestartEditor()).model;
  expect(retried.editor).toMatchObject({ revision: 2, status: { _tag: 'Loading' } });
  expect(update(retried, Message.SucceededEditor({ revision: 1 })).model).toBe(retried);
  expect(update(retried, Message.FailedEditor({ revision: 1, error: 'Old failure' })).model).toBe(
    retried,
  );
  expect(update(retried, Message.SucceededEditor({ revision: 2 })).model.editor).toMatchObject({
    revision: 2,
    status: { _tag: 'Ready' },
  });
});

test('restart waits for preparation and then creates a fresh editor', () => {
  const idle = initial();
  expect(update(idle, Message.ClickedRestartEditor()).model).toBe(idle);
  expect(update(idle, Message.SucceededEditor({ revision: 1 })).model).toBe(idle);
  const loading = update(idle, Message.ClickedEditor()).model;
  expect(update(loading, Message.ClickedRestartEditor()).model).toBe(loading);
  const ready = update(loading, Message.SucceededEditor({ revision: 1 })).model;
  const restarted = update(ready, Message.ClickedRestartEditor()).model;
  expect(restarted.editor).toMatchObject({ revision: 2, status: { _tag: 'Loading' } });
});

test('editor and external playground progress independently', () => {
  const editing = update(initial(), Message.ClickedEditor()).model;
  const preparing = update(editing, Message.ClickedPlayground());
  expect(preparing.commands).toHaveLength(1);
  expect(preparing.model.editor).toBe(editing.editor);
  const closed = update(preparing.model, Message.ClickedCloseEditor()).model;
  expect(closed.status._tag).toBe('Pending');
  expect(closed.editor).toBe(editing.editor);
});

test('Pages mode refuses an embedded editor but retains the external playground', () => {
  const model = init({
    templateUrl: '/fold-kit-experiments/viz/downloads/dataset-template.json',
    embeddedEditor: false,
  }).model;
  expect(update(model, Message.ClickedEditor())).toEqual({ model });
  const opened = update(model, Message.ClickedPlayground());
  expect(opened.commands).toHaveLength(1);
  expect(opened.commands?.[0]?.args).toEqual({
    templateUrl: '/fold-kit-experiments/viz/downloads/dataset-template.json',
  });
});
