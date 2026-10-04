import { expect, test } from 'bun:test';

import { init, update, Message } from '../src/examples/line/main';
import { currentSource } from '../src/examples/line/update';

test('controls update model and copied settings together, and reset restores them', () => {
  let model = init({ sources: [], templateUrl: '/downloads/line-template.json' }).model;
  model = update(model, Message.SelectedCurve({ curve: 'step' })).model;
  model = update(model, Message.ChangedPoint({ index: 0, value: '75' })).model;
  model = update(model, Message.ChangedDomain({ value: '150' })).model;
  expect(model.settings).toEqual({ curve: 'step', values: [75, 45, 23, 88, 67], yMax: 150 });
  expect(currentSource(model)).toContain('"curve": "step"');
  expect(currentSource(model)).toContain('"yMax": 150');
  const copied = update(model, Message.ClickedCopy());
  expect(copied.model.actionStatus._tag).toBe('Pending');
  expect(copied.commands?.length).toBe(1);
  expect(
    update(copied.model, Message.FailedAction({ error: 'blocked' })).model.actionStatus,
  ).toEqual({ _tag: 'Failed', error: 'blocked' });
  const reset = update(model, Message.ClickedReset()).model;
  expect(reset.settings).toEqual({ curve: 'catmullRom', values: [10, 45, 23, 88, 67], yMax: 100 });
});

test('standalone examples have no broken export actions', () => {
  const model = init({ sources: [], templateUrl: null }).model;
  expect(update(model, Message.ClickedDownload())).toEqual({ model });
  expect(update(model, Message.ClickedPlayground())).toEqual({ model });
});

test('selection and reset preserve an active action and prevent a second command', () => {
  const model = init({ sources: [], templateUrl: '/downloads/line-template.json' }).model;
  const downloading = update(model, Message.ClickedDownload()).model;
  const selected = update(downloading, Message.SelectedFile({ name: 'chart.ts' })).model;
  const reset = update(selected, Message.ClickedReset()).model;
  expect(selected.actionStatus).toEqual({ _tag: 'Pending', action: 'download' });
  expect(reset.actionStatus).toEqual({ _tag: 'Pending', action: 'download' });
  expect(update(reset, Message.ClickedCopy())).toEqual({ model: reset });
  expect(update(reset, Message.ClickedPlayground())).toEqual({ model: reset });
  expect(update(reset, Message.ClickedDownload())).toEqual({ model: reset });
  const failed = update(reset, Message.FailedAction({ error: 'retry' })).model;
  expect(update(failed, Message.ClickedCopy()).commands?.length).toBe(1);
});
