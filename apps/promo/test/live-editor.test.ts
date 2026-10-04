import { expect, test } from 'bun:test';

import { init, update, Message } from '../src/examples/line/main';

const initial = () => init({ sources: [], templateUrl: '/downloads/line-template.json' }).model;

test('editor starts lazily with a captured copy of the current controls', () => {
  let model = initial();
  expect(model.editor).toEqual({ _tag: 'Idle' });
  model = update(model, Message.SelectedCurve({ curve: 'step' })).model;
  model = update(model, Message.SelectedPanel({ panel: 'edit' })).model;
  expect(model.panel).toBe('edit');
  expect(model.editor).toMatchObject({
    _tag: 'Session',
    revision: 1,
    status: { _tag: 'Loading' },
    initialSettings: { curve: 'step' },
  });
  const editor = model.editor;
  model = update(model, Message.SelectedPanel({ panel: 'controls' })).model;
  model = update(model, Message.ChangedPoint({ index: 0, value: '75' })).model;
  model = update(model, Message.SelectedPanel({ panel: 'edit' })).model;
  expect(model.editor).toBe(editor);
  expect(model.editor._tag === 'Session' && model.editor.initialSettings.values[0]).toBe(10);
});

test('editor completion ignores stale sessions and restart captures the new controls', () => {
  let model = update(initial(), Message.SelectedPanel({ panel: 'edit' })).model;
  expect(update(model, Message.ClickedRestartEditor())).toEqual({ model });
  model = update(model, Message.SucceededEditor({ revision: 1 })).model;
  model = update(model, Message.SelectedCurve({ curve: 'linear' })).model;
  model = update(model, Message.ClickedRestartEditor()).model;
  expect(model.editor).toMatchObject({
    revision: 2,
    initialSettings: { curve: 'linear' },
    status: { _tag: 'Loading' },
  });
  expect(update(model, Message.FailedEditor({ revision: 1, error: 'stale' }))).toEqual({ model });
  expect(update(model, Message.SucceededEditor({ revision: 1 }))).toEqual({ model });
  model = update(model, Message.FailedEditor({ revision: 2, error: 'Network unavailable' })).model;
  expect(model.editor).toMatchObject({ status: { _tag: 'Failed', error: 'Network unavailable' } });
  expect(update(model, Message.ClickedRestartEditor()).model.editor).toMatchObject({
    revision: 3,
    status: { _tag: 'Loading' },
  });
});

test('standalone projects do not recursively offer embedded editors', () => {
  const model = init({ sources: [], templateUrl: null }).model;
  expect(update(model, Message.SelectedPanel({ panel: 'edit' }))).toEqual({ model });
  expect(update(model, Message.ClickedRestartEditor())).toEqual({ model });
});

test('width facts preserve the line editor session and control state', () => {
  let model = init({ sources: [], templateUrl: '/downloads/line-template.json' }).model;
  model = update(model, Message.SelectedCurve({ curve: 'step' })).model;
  model = update(model, Message.SelectedPanel({ panel: 'edit' })).model;
  model = update(model, Message.SucceededEditor({ revision: 1 })).model;
  const next = update(model, Message.RecordedChartWidth({ width: 324 })).model;
  expect(next.chartWidth).toBe(324);
  expect(next.settings).toBe(model.settings);
  expect(next.editor).toBe(model.editor);
  expect(next.panel).toBe('edit');
  for (const width of [0, -1, 50, NaN, Infinity])
    expect(update(next, Message.RecordedChartWidth({ width })).model).toBe(next);
});
