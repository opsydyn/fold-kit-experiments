import { expect, test } from 'bun:test';

import { parseGraph, serializeGraph } from '@opsydyn/foldkit-zloz';

import { readInfrastructureSnapshot } from '../src/infrastructure';

const snapshot = {
  format: 'foldkit-zloz-alchemy-infrastructure',
  version: 1,
  source: { packageVersion: '2.0.0-beta.85', stack: 'Teams', stage: 'staging', revision: 'abc123' },
  resources: [
    { id: 'Web', type: 'Cloudflare.Worker', action: 'update' },
    { id: 'Backend', type: 'Cloudflare.Worker', action: 'noop' },
  ],
  links: [{ from: 'Web', to: 'Backend', kind: 'binding', name: 'BACKEND' }],
  omissions: [{ resource: 'Web', name: 'EXTERNAL', kind: 'binding' }],
};

test('the infrastructure snapshot projects a named binding with persistent provenance and visible omissions', () => {
  const review = readInfrastructureSnapshot(JSON.stringify(snapshot));
  expect(review.status).toBe('reviewable');
  if (review.status !== 'reviewable') throw new Error('Expected a reviewed graph');
  const graph = parseGraph(serializeGraph(review.graph));
  expect(graph.nodes.map(({ label }) => label)).toEqual([
    'Teams · staging · abc123',
    'Backend · No change',
    'Web · Update',
  ]);
  expect(graph.edges.map(({ source, target, label }) => [source.node, target.node, label])).toEqual(
    [['resource:Web', 'resource:Backend', 'Binds to · BACKEND']],
  );
  expect(review.findings).toEqual([
    { resource: 'Web', message: 'Binding EXTERNAL has no resolved target in the snapshot.' },
  ]);
});

test('rejects ambiguous JSON, unknown fields and invalid edge endpoints without a partial graph', () => {
  const json = JSON.stringify(snapshot);
  for (const bad of [
    json.replace('"version":1', '"version":1,"version":1'),
    JSON.stringify({ ...snapshot, props: { secret: 'must not be consumed' } }),
    JSON.stringify({ ...snapshot, links: [{ ...snapshot.links[0], to: 'Missing' }] }),
  ])
    expect(readInfrastructureSnapshot(bad).status).toBe('blocked');
});
