import { rowsOf } from '@opsydyn/foldkit-viz/plot';
import { Option, Schema } from 'effect';
import { assert, describe, expect, it } from 'vitest';

import * as PlotPanel from '../../ui/plot-panel';
import { matchingBinIndices, matchingKeys } from '../../ui/shared/inspection';
import { points } from './data';
import { Message } from './message';
import { init } from './model';
import { Settings } from './settings';
import { update } from './update';

const inspectPoint = (id: number, index = 0) =>
  Message.GotScatterMessage({ id, message: PlotPanel.Message.HoveredTarget({ index }) });
const inspectBin = (id: number, index = 0) =>
  Message.GotHistogramMessage({ id, message: PlotPanel.Message.HoveredTarget({ index }) });

describe('comparison collection', () => {
  it('initialises the two default panels against the same illustrative dataset', () => {
    const model = init().model;
    expect(model.panels.map(({ id, _tag }) => ({ id, _tag }))).toEqual([
      { id: 1, _tag: 'Scatter' },
      { id: 2, _tag: 'Histogram' },
    ]);
    expect(model.nextPanelId).toBe(3);
    expect(model.linking).toEqual({ _tag: 'Linked', inspection: Option.none() });
    expect(points).toHaveLength(30);
    expect(new Set(points.map(({ id }) => id)).size).toBe(30);
    const [scatter, histogram] = model.panels;
    assert(scatter?._tag === 'Scatter' && histogram?._tag === 'Histogram');
    expect(scatter.chart.spec.data).toBe(points);
    expect(histogram.chart.spec.data).toBe(points);
    expect(rowsOf(scatter.chart.spec.data ?? [])[0]).toEqual({
      id: 'salary-1',
      x: 1,
      y: 55000,
      label: '1yr',
    });
  });

  it('initialises captured order, linking mode and counter', () => {
    const model = init({
      panels: [
        { id: 7, kind: 'histogram' },
        { id: 0, kind: 'scatter' },
      ],
      nextPanelId: 8,
      linkInspections: false,
    }).model;
    expect(model.panels.map(({ id, _tag }) => ({ id, _tag }))).toEqual([
      { id: 7, _tag: 'Histogram' },
      { id: 0, _tag: 'Scatter' },
    ]);
    expect(model.linking).toEqual({ _tag: 'Independent' });
    expect(update(model, Message.ClickedAddPanel({ kind: 'scatter' })).model.panels[2]?.id).toBe(8);
  });

  it('adds both kinds up to four then leaves the counter and model untouched', () => {
    let model = init().model;
    model = update(model, Message.ClickedAddPanel({ kind: 'scatter' })).model;
    model = update(model, Message.ClickedAddPanel({ kind: 'histogram' })).model;
    expect(model.panels.map(({ id, _tag }) => ({ id, _tag }))).toEqual([
      { id: 1, _tag: 'Scatter' },
      { id: 2, _tag: 'Histogram' },
      { id: 3, _tag: 'Scatter' },
      { id: 4, _tag: 'Histogram' },
    ]);
    expect(model.nextPanelId).toBe(5);
    for (const kind of ['scatter', 'histogram'] as const) {
      expect(update(model, Message.ClickedAddPanel({ kind }))).toEqual({ model });
      expect(update(model, Message.ClickedAddPanel({ kind })).model).toBe(model);
    }
  });

  it('retains the allocation counter after removing all panels', () => {
    let model = init().model;
    model = update(model, Message.ClickedRemovePanel({ id: 1 })).model;
    model = update(model, Message.ClickedRemovePanel({ id: 2 })).model;
    expect(model.panels).toEqual([]);
    expect(model.nextPanelId).toBe(3);
    model = update(model, Message.ClickedAddPanel({ kind: 'scatter' })).model;
    expect(model.panels.map(({ id }) => id)).toEqual([3]);
    expect(model.nextPanelId).toBe(4);
  });

  it.each(['scatter', 'histogram'] as const)(
    'keeps repeated %s adds at exhaustion as identity no-ops',
    (kind) => {
      const initial = init(
        Schema.decodeUnknownSync(Settings)({
          panels: [],
          nextPanelId: Number.MAX_SAFE_INTEGER,
          linkInspections: true,
        }),
      ).model;
      const first = update(initial, Message.ClickedAddPanel({ kind }));
      const second = update(first.model, Message.ClickedAddPanel({ kind }));
      const third = update(second.model, Message.ClickedAddPanel({ kind }));
      expect(third.model.panels.map(({ id }) => id)).toEqual([]);
      for (const result of [first, second, third]) {
        expect(result.model).toBe(initial);
        expect(result.commands ?? []).toEqual([]);
        expect(result.model.nextPanelId).toBe(Number.MAX_SAFE_INTEGER);
      }
    },
  );

  it.each(['scatter', 'histogram'] as const)(
    'allocates the final safe %s IDs without reusing them after removal',
    (kind) => {
      let model = init(
        Schema.decodeUnknownSync(Settings)({
          panels: [],
          nextPanelId: Number.MAX_SAFE_INTEGER - 2,
          linkInspections: true,
        }),
      ).model;
      model = update(model, Message.ClickedAddPanel({ kind })).model;
      model = update(model, Message.ClickedAddPanel({ kind })).model;
      expect(model.panels.map(({ id }) => id)).toEqual([9007199254740989, 9007199254740990]);
      expect(model.nextPanelId).toBe(9007199254740991);
      expect(Number.isSafeInteger(model.nextPanelId)).toBe(true);
      for (const panel of model.panels) expect(panel.id).toBeLessThan(model.nextPanelId);
      const exhausted = update(model, Message.ClickedAddPanel({ kind }));
      expect(exhausted.model).toBe(model);
      expect(exhausted.commands ?? []).toEqual([]);
      model = update(model, Message.ClickedRemovePanel({ id: 9007199254740989 })).model;
      model = update(model, Message.ClickedRemovePanel({ id: 9007199254740990 })).model;
      expect(model.panels).toEqual([]);
      expect(model.nextPanelId).toBe(9007199254740991);
      for (const nextKind of ['scatter', 'histogram'] as const) {
        const result = update(model, Message.ClickedAddPanel({ kind: nextKind }));
        expect(result.model).toBe(model);
        expect(result.commands ?? []).toEqual([]);
      }
      const late =
        kind === 'scatter' ? inspectPoint(9007199254740990) : inspectBin(9007199254740990);
      expect(update(model, late).model).toBe(model);
      expect(update(model, late).commands ?? []).toEqual([]);
    },
  );

  it('reorders without replacing child objects or the active inspection', () => {
    const model = update(init().model, inspectPoint(1, 1)).model;
    const moved = update(model, Message.ClickedMovePanel({ id: 1, direction: 'later' })).model;
    expect(moved.panels[0]).toBe(model.panels[1]);
    expect(moved.panels[1]).toBe(model.panels[0]);
    expect(moved.linking).toBe(model.linking);
    const restored = update(moved, Message.ClickedMovePanel({ id: 1, direction: 'earlier' })).model;
    expect(restored.panels).toEqual(model.panels);
  });

  it.each([
    Message.ClickedRemovePanel({ id: 99 }),
    Message.ClickedMovePanel({ id: 99, direction: 'earlier' }),
    Message.ClickedMovePanel({ id: 1, direction: 'earlier' }),
    Message.ClickedMovePanel({ id: 2, direction: 'later' }),
    inspectPoint(99),
    inspectBin(99),
    inspectPoint(2),
    inspectBin(1),
  ])('ignores impossible collection or child messages: %j', (message) => {
    const model = init().model;
    const result = update(model, message);
    expect(result.model).toBe(model);
    expect(result.commands ?? []).toEqual([]);
  });
});

describe('parent-owned linking', () => {
  it('retains the newer source when a previous source clears', () => {
    let model = update(init().model, inspectPoint(1)).model;
    expect(model.linking).toEqual({
      _tag: 'Linked',
      inspection: Option.some({ sourceId: 1, value: { _tag: 'Point', key: 'salary-1' } }),
    });
    model = update(model, inspectBin(2)).model;
    const linked = model.linking;
    model = update(
      model,
      Message.GotScatterMessage({ id: 1, message: PlotPanel.Message.BlurredTarget() }),
    ).model;
    expect(model.linking).toBe(linked);
    expect(model.linking).toEqual({
      _tag: 'Linked',
      inspection: Option.some({
        sourceId: 2,
        value: { _tag: 'Range', lower: 55000, upper: 60000, includeEnd: false },
      }),
    });
  });

  it('clears shared inspection on source removal without changing sibling local state', () => {
    let model = update(init().model, inspectPoint(1, 1)).model;
    model = update(model, inspectBin(2)).model;
    const sibling = model.panels[0];
    const result = update(model, Message.ClickedRemovePanel({ id: 2 })).model;
    expect(result.linking).toEqual({ _tag: 'Linked', inspection: Option.none() });
    expect(result.panels[0]).toBe(sibling);
    assert(sibling?._tag === 'Scatter');
    expect(sibling.chart.active).toEqual(Option.some(1));
    expect(update(model, Message.ClickedRemovePanel({ id: 1 })).model.linking).toBe(model.linking);
  });

  it('clears only the current source and retains the final-bin endpoint policy', () => {
    const base = init().model;
    const histogram = base.panels[1];
    assert(histogram?._tag === 'Histogram');
    const inspected = update(
      base,
      inspectBin(2, PlotPanel.targetsOf(histogram.chart).length - 1),
    ).model;
    expect(inspected.linking).toEqual({
      _tag: 'Linked',
      inspection: Option.some({
        sourceId: 2,
        value: { _tag: 'Range', lower: 160000, upper: 175000, includeEnd: true },
      }),
    });
    const cleared = update(
      inspected,
      Message.GotHistogramMessage({ id: 2, message: PlotPanel.Message.BlurredTarget() }),
    ).model;
    expect(cleared.linking).toEqual({ _tag: 'Linked', inspection: Option.none() });
    const scatter = update(base, inspectPoint(1)).model;
    expect(
      update(
        scatter,
        Message.GotScatterMessage({ id: 1, message: PlotPanel.Message.BlurredTarget() }),
      ).model.linking,
    ).toEqual({ _tag: 'Linked', inspection: Option.none() });
  });

  it('toggles without changing local models and re-enables without choosing a source', () => {
    let model = update(init().model, inspectPoint(1, 1)).model;
    const panels = model.panels;
    model = update(model, Message.ChangedLinkInspections({ enabled: false })).model;
    expect(model.panels).toBe(panels);
    expect(model.linking).toEqual({ _tag: 'Independent' });
    model = update(model, inspectBin(2, 1)).model;
    expect(model.linking).toEqual({ _tag: 'Independent' });
    const independent = model.panels;
    model = update(model, Message.ChangedLinkInspections({ enabled: true })).model;
    expect(model.panels).toBe(independent);
    expect(model.linking).toEqual({ _tag: 'Linked', inspection: Option.none() });
    model = update(model, inspectPoint(1, 1)).model;
    expect(update(model, Message.ChangedLinkInspections({ enabled: true })).model).toBe(model);
  });

  it('gives added siblings the existing derived overlay without mutating local inspection', () => {
    const source = update(init().model, inspectBin(2)).model;
    let model = update(source, Message.ClickedAddPanel({ kind: 'scatter' })).model;
    model = update(model, Message.ClickedAddPanel({ kind: 'histogram' })).model;
    expect(model.linking).toBe(source.linking);
    expect(model.panels[0]).toBe(source.panels[0]);
    expect(model.panels[1]).toBe(source.panels[1]);
    assert(model.linking._tag === 'Linked');
    const keys = matchingKeys(points, Option.getOrThrow(model.linking.inspection).value);
    expect(keys).toEqual(['salary-1', 'salary-3']);
    const scatter = model.panels[2];
    const histogram = model.panels[3];
    assert(scatter?._tag === 'Scatter' && histogram?._tag === 'Histogram');
    expect(scatter.chart.active).toEqual(Option.none());
    expect(histogram.chart.active).toEqual(Option.none());
    expect(
      matchingBinIndices(
        points,
        keys,
        PlotPanel.targetsOf(histogram.chart).map(({ domain: [x0, x1] }) => ({ x0, x1 })),
      ),
    ).toEqual([0]);
  });
});
