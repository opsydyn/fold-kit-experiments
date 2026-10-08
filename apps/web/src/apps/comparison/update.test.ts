import { Option } from 'effect';
import { assert, describe, expect, it } from 'vitest';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { matchingBinIndices, matchingKeys } from '../../ui/shared/inspection';
import { points } from './data';
import { Message } from './message';
import { init } from './model';
import { update } from './update';

const inspectPoint = (id: number, index = 0) =>
  Message.GotScatterMessage({ id, message: Scatter.Message.HoveredPoint({ index }) });
const inspectBin = (id: number, index = 0) =>
  Message.GotHistogramMessage({ id, message: Histogram.Message.HoveredBin({ index }) });

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
    expect(scatter.chart.points).toBe(points);
    expect(histogram.chart.totalCount).toBe(30);
    expect(scatter.chart.points[0]).toEqual({ id: 'salary-1', x: 1, y: 55000, label: '1yr' });
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
      Message.GotScatterMessage({ id: 1, message: Scatter.Message.BlurredPoint() }),
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
    expect(sibling.chart.activeIndex).toEqual(Option.some(1));
    expect(update(model, Message.ClickedRemovePanel({ id: 1 })).model.linking).toBe(model.linking);
  });

  it('clears only the current source and retains the final-bin endpoint policy', () => {
    const base = init().model;
    const histogram = base.panels[1];
    assert(histogram?._tag === 'Histogram');
    const inspected = update(base, inspectBin(2, histogram.chart.bins.length - 1)).model;
    expect(inspected.linking).toEqual({
      _tag: 'Linked',
      inspection: Option.some({
        sourceId: 2,
        value: { _tag: 'Range', lower: 160000, upper: 175000, includeEnd: true },
      }),
    });
    const cleared = update(
      inspected,
      Message.GotHistogramMessage({ id: 2, message: Histogram.Message.BlurredBin() }),
    ).model;
    expect(cleared.linking).toEqual({ _tag: 'Linked', inspection: Option.none() });
    const scatter = update(base, inspectPoint(1)).model;
    expect(
      update(scatter, Message.GotScatterMessage({ id: 1, message: Scatter.Message.BlurredPoint() }))
        .model.linking,
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
    expect(scatter.chart.activeIndex).toEqual(Option.none());
    expect(histogram.chart.activeBin).toEqual(Option.none());
    expect(matchingBinIndices(points, keys, histogram.chart.bins)).toEqual([0]);
  });
});
