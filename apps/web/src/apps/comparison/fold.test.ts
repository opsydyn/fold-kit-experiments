import { Option, Schema } from 'effect';
import { expect, it } from 'vitest';

import * as PlotPanel from '../../ui/plot-panel/core';
import { init, Message, update } from './workbench-state';

it('ignores panel facts with a missing or wrong-kind panel ID', () => {
  const model = init();
  for (const [id, kind] of [
    [2, 'Scatter'],
    [99, 'Scatter'],
    [1, 'Histogram'],
    [99, 'Histogram'],
  ] as const) {
    const message = Message.ReceivedPanelMessage({
      id,
      kind,
      message: PlotPanel.Message.HoveredTarget({ index: 0 }),
    });
    expect(update(model, message)).toEqual({ model });
  }
});

it.each([
  [1, 'Scatter', 'later', { _tag: 'Point', key: 'salary-1' }],
  [2, 'Histogram', 'earlier', { _tag: 'Range', lower: 55000, upper: 60000, includeEnd: false }],
] as const)(
  'routes inspection and clear facts by stable panel ID %s across a move',
  (id, kind, direction, value) => {
    const base = init();
    const inspection = Message.ReceivedPanelMessage({
      id,
      kind,
      message: PlotPanel.Message.HoveredTarget({ index: 0 }),
    });
    const clear = Message.ReceivedPanelMessage({
      id,
      kind,
      message: PlotPanel.Message.BlurredTarget(),
    });
    const codec = Schema.toCodecJson(Message);
    const received = Schema.decodeUnknownSync(codec)(Schema.encodeSync(codec)(inspection));
    const inspected = update(base, received).model;
    const sibling = base.panels.find((panel) => panel.id !== id);
    expect(inspected.panels.find((panel) => panel.id !== id)).toBe(sibling);
    expect(inspected.linking).toEqual({
      _tag: 'Linked',
      inspection: Option.some({ sourceId: id, value }),
    });

    const moved = update(inspected, Message.ObservedPanelMove({ id, direction })).model;
    expect(moved.panels[0]).toBe(inspected.panels[1]);
    expect(update(moved, clear).model.linking).toEqual({
      _tag: 'Linked',
      inspection: Option.none(),
    });

    const removed = update(moved, Message.ClickedRemovePanel({ id })).model;
    expect(update(removed, clear)).toEqual({ model: removed });
    expect(update(removed, inspection)).toEqual({ model: removed });
  },
);
