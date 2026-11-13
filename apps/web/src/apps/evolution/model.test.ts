import { describe, expect, it } from 'vitest';

import { Message } from './message';
import { eventLabel, evolutionRows, init, SERIES } from './model';
import type { DiagramEvent } from './model';
import { update } from './update';

const at = (minute: number): number => Date.UTC(2026, 10, 13, 13, minute);
const events: ReadonlyArray<DiagramEvent> = [
  { time: at(1), kind: 'node', nodeType: 'system', label: 'Shop' },
  { time: at(2), kind: 'node', nodeType: 'person', label: 'Buyer' },
  { time: at(3), kind: 'edge', label: 'Buyer → Shop' },
  { time: at(4), kind: 'node', nodeType: 'person', label: 'Seller' },
];

describe('evolution rows', () => {
  const rows = evolutionRows(events);
  const series = (key: string) => rows.filter((row) => row.series === key);

  it('samples every series at every event, so each line spans the whole history', () => {
    for (const { key } of SERIES)
      expect(series(key).map((row) => row.time)).toEqual(events.map((e) => e.time));
  });

  it('counts each type cumulatively, with relationships as their own series', () => {
    expect(series('person').map((row) => row.count)).toEqual([0, 1, 1, 2]);
    expect(series('system').map((row) => row.count)).toEqual([1, 1, 1, 1]);
    expect(series('edges').map((row) => row.count)).toEqual([0, 0, 1, 1]);
    expect(series('component').map((row) => row.count)).toEqual([0, 0, 0, 0]);
  });

  it('gives every row a unique key', () => {
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });

  it('returns no rows for no events', () => {
    expect(evolutionRows([])).toEqual([]);
  });
});

describe('latest event label', () => {
  it('names the type, the label and the UTC time', () => {
    expect(eventLabel(events[3])).toBe('+ PERSON · SELLER · 13:04 UTC');
    expect(eventLabel(events[2])).toBe('+ RELATIONSHIP · BUYER → SHOP · 13:03 UTC');
    expect(eventLabel(undefined)).toBe('Awaiting first change');
  });
});

describe('evolution update', () => {
  const { model } = init({});

  it('seeds a deterministic history ending in a new person', () => {
    expect(init({}).model).toEqual(model);
    expect(model.events.at(-1)).toMatchObject({ kind: 'node', nodeType: 'person' });
  });

  it('highlights a series and clears it', () => {
    const highlighted = update(model, Message.HighlightedSeries({ key: 'container' })).model;
    expect(highlighted.highlighted).toBe('container');
    expect(
      update(highlighted, Message.HighlightedSeries({ key: null })).model.highlighted,
    ).toBeNull();
  });

  it('switches between stepped and smoothed lines', () => {
    expect(model.curve).toBe('stepAfter');
    const smooth = update(model, Message.ChoseCurve({ curve: 'monotoneX' })).model;
    expect(smooth.curve).toBe('monotoneX');
  });
});
