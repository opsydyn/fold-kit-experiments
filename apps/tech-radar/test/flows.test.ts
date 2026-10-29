import { describe, expect, test } from 'bun:test';

import { flowChart, flowsInto } from '../src/radar/flows';
import { entriesAt } from '../src/radar/pages';
import { demoRadar } from '../src/test/fixture';

const current = (demoRadar.editions ?? []).length;
const flows = flowsInto(demoRadar, current);
const flowOf = (name: string) => flows.find(({ names }) => names.includes(name));

describe('the flows into an edition', () => {
  test('there are none into the first edition', () => {
    expect(flowsInto(demoRadar, 0)).toEqual([]);
  });

  test('each entry on either edition flows once', () => {
    const names = flows.flatMap(({ names }) => names);
    expect(new Set(names).size).toBe(names.length);
    const onEither = new Set([
      ...entriesAt(demoRadar, current - 1).map(({ entry }) => entry.name),
      ...entriesAt(demoRadar, current).map(({ entry }) => entry.name),
    ]);
    expect(names.length).toBe(onEither.size);
  });

  test('say how each moved: in towards Adopt, stayed, or joined from off the radar', () => {
    expect(flowOf('FoldKit')).toMatchObject({ from: 'trial', to: 'adopt', kind: 'in' });
    expect(flowOf('Codex')).toMatchObject({ from: 'assess', to: 'trial', kind: 'in' });
    expect(flowOf('Pi')).toMatchObject({ from: 'off', to: 'trial', kind: 'joined' });
    expect(flows.filter(({ kind }) => kind === 'stayed').every(({ from, to }) => from === to)).toBe(
      true,
    );
  });
});

describe('the flow chart', () => {
  const chart = flowChart(flows);
  const column = (before: boolean) =>
    chart.bars.filter(({ anchor }) => anchor === (before ? 'end' : 'start'));

  test('keeps both columns in ring order, Adopt at the top, New and Left last', () => {
    const order = (before: boolean) =>
      column(before)
        .toSorted((a, b) => a.y - b.y)
        .map(({ label }) => label);
    const rings = ['Adopt', 'Trial', 'Assess', 'Caution'];
    expect(order(true).filter((label) => rings.includes(label))).toEqual(
      rings.filter((ring) => order(true).includes(ring)),
    );
    expect(order(true).at(-1)).toBe('New');
    expect(order(false)).toEqual(rings.filter((ring) => order(false).includes(ring)));
  });

  test('has a ribbon per flow, and each bar counts its entries', () => {
    expect(chart.ribbons.map(({ flow }) => flow)).toEqual([...flows]);
    const adopt = column(false).find(({ label }) => label === 'Adopt');
    expect(adopt?.count).toBe(
      flows.filter(({ to }) => to === 'adopt').reduce((sum, { names }) => sum + names.length, 0),
    );
  });
});
