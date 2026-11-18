import { expect, test } from 'bun:test';

import { deltaRead } from '../src/delta-read';
const read = {
  id: '1',
  tag: 'ZlozDiagramDeltaV1.events',
  payload: { key: '["team-a","diagram-a"]', after: 17 },
};
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Negative wire fixtures must include invalid shapes.
const url = (value: unknown) => {
  const result = new URL('http://localhost/api/zloz/live');
  result.searchParams.set('read', JSON.stringify(value));
  return result;
};
test('delta routing accepts only unfiltered events with a safe cursor and a valid team target', () => {
  expect(deltaRead(url(read))).toEqual({
    kind: 'delta',
    target: { teamId: 'team-a', diagramId: 'diagram-a' },
  });
  for (const value of [
    { ...read, tag: 'ZlozDiagramDeltaV1.watch' },
    { ...read, tag: 'ZlozDiagramDeltaV1.snapshot' },
    { ...read, payload: { ...read.payload, after: -1 } },
    { ...read, payload: { ...read.payload, after: 1.5 } },
    { ...read, payload: { ...read.payload, after: Number.MAX_SAFE_INTEGER + 1 } },
    { ...read, payload: { ...read.payload, where: {} } },
    { ...read, payload: { ...read.payload, key: '["../other","diagram-a"]' } },
    { ...read, payload: { ...read.payload, key: '["team-a","diagram-a","extra"]' } },
  ])
    expect(deltaRead(url(value)).kind).toBe('invalid');
  expect(deltaRead(url({ ...read, tag: 'ZlozDiagramLiveV1.watch' })).kind).toBe('legacy');
});
