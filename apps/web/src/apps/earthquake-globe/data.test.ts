import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { decodeSnapshot, loadBundledSnapshot, type SnapshotProvenance } from './data';

const provenance: SnapshotProvenance = {
  sourceUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
  capturedAt: '2026-10-14T12:00:00Z',
  generatedAtMs: 1000,
  originalCount: 1,
  sha256: '0'.repeat(64),
};
const event = (id = 'a', time = 1000) => ({
  type: 'Feature',
  id,
  properties: {
    type: 'earthquake',
    mag: null,
    time,
    place: 'Pacific',
    url: 'https://earthquake.usgs.gov/earthquakes/eventpage/a',
  },
  geometry: { type: 'Point', coordinates: [-122, 37, -1.5] },
});
const envelope = (features = [event()]) => ({
  type: 'FeatureCollection',
  metadata: { generated: 1000, count: features.length },
  features,
});
const decode = (features = [event()]) =>
  decodeSnapshot(envelope(features), { ...provenance, originalCount: features.length });

describe('recorded earthquake decoding', () => {
  it('preserves coordinate order, negative depth and unknown magnitude', () => {
    const input = envelope();
    Object.freeze(input.features[0]?.geometry.coordinates);
    Object.freeze(input.features);
    const result = decodeSnapshot(input, provenance);
    expect(result._tag).toBe('Ready');
    if (result._tag !== 'Ready') throw new Error(result.reason);
    expect(result.snapshot.events[0]).toEqual({
      id: 'a',
      longitude: -122,
      latitude: 37,
      depthKm: -1.5,
      magnitude: null,
      timeMs: 1000,
      place: 'Pacific',
      url: 'https://earthquake.usgs.gov/earthquakes/eventpage/a',
    });
    expect(result.snapshot.window).toEqual([1000, 1000]);
    expect(input.features).toHaveLength(1);
  });
  it('orders a copied collection by time then deterministic ID', () => {
    const rows = [event('b'), event('a'), event('z', 2000)];
    Object.freeze(rows);
    const result = decodeSnapshot(envelope(rows), { ...provenance, originalCount: 3 });
    if (result._tag !== 'Ready') throw new Error(result.reason);
    expect(result.snapshot.events.map((row) => row.id)).toEqual(['z', 'a', 'b']);
    expect(rows.map((row) => row.id)).toEqual(['b', 'a', 'z']);
  });
  it('counts invalid and non-earthquake rows instead of fabricating measurements', () => {
    const bad = event('bad');
    bad.geometry.coordinates[0] = 181;
    const other = event('other');
    other.properties.type = 'quarry blast';
    const result = decode([event(), bad, other, event('date', 1e16), event('fractional', 1.5)]);
    if (result._tag !== 'Ready') throw new Error(result.reason);
    expect(result.snapshot.events.map((row) => row.id)).toEqual(['a']);
    expect(result.snapshot.excluded).toEqual({
      'invalid-coordinate': 1,
      'non-earthquake': 1,
      'invalid-time': 2,
    });
  });
  it('rejects duplicate IDs and inconsistent envelope/provenance', () => {
    expect(decode([event(), event()])._tag).toBe('Failure');
    expect(decodeSnapshot({ ...envelope(), type: 'Other' }, provenance)._tag).toBe('Failure');
    expect(decodeSnapshot(envelope(), { ...provenance, originalCount: 2 })._tag).toBe('Failure');
    expect(decodeSnapshot(envelope(), { ...provenance, capturedAt: 'not-a-date' })._tag).toBe(
      'Failure',
    );
  });
  it('supports an empty snapshot without invented dates or points', () => {
    const result = decode([]);
    if (result._tag !== 'Ready') throw new Error(result.reason);
    expect(result.snapshot.events).toEqual([]);
    expect(result.snapshot.window).toBeNull();
  });
  it('preserves signed magnitude and zero while rejecting optional numeric strings', () => {
    const row = event();
    const valid = decodeSnapshot(
      {
        ...envelope(),
        features: [
          {
            ...row,
            properties: { ...row.properties, mag: -0.5 },
            geometry: { ...row.geometry, coordinates: [-122, 37, 0] },
          },
        ],
      },
      provenance,
    );
    if (valid._tag !== 'Ready') throw new Error(valid.reason);
    expect(valid.snapshot.events[0]?.magnitude).toBe(-0.5);
    expect(valid.snapshot.events[0]?.depthKm).toBe(0);
    const invalid = decodeSnapshot(
      {
        ...envelope(),
        features: [
          {
            ...row,
            properties: { ...row.properties, mag: '3' },
            geometry: { ...row.geometry, coordinates: [-122, 37, '10'] },
          },
        ],
      },
      provenance,
    );
    if (invalid._tag !== 'Ready') throw new Error(invalid.reason);
    expect(invalid.snapshot.events[0]?.magnitude).toBeNull();
    expect(invalid.snapshot.events[0]?.depthKm).toBeNull();
    expect(invalid.snapshot.warnings).toEqual({ 'invalid-magnitude': 1, 'invalid-depth': 1 });
  });
  it.each([
    'javascript:alert(1)',
    'https://earthquake.usgs.gov.evil.test/earthquakes/eventpage/a',
    'https://user@earthquake.usgs.gov/earthquakes/eventpage/a',
    'https://example.org/a',
  ])('never exposes unsafe feed URL %s', (url) => {
    const row = event();
    row.properties.url = url;
    const result = decode([row]);
    if (result._tag !== 'Ready') throw new Error(result.reason);
    expect(result.snapshot.events[0]?.url).toBeNull();
    expect(result.snapshot.warnings['invalid-url']).toBe(1);
  });
  it('keeps real captured bytes and their provenance aligned offline', () => {
    const raw = readFileSync('src/apps/earthquake-globe/fixtures/usgs-week.geojson');
    const result = loadBundledSnapshot();
    if (result._tag !== 'Ready') throw new Error(result.reason);
    expect(createHash('sha256').update(raw).digest('hex')).toBe(result.snapshot.provenance.sha256);
    expect(
      result.snapshot.events.length +
        Object.values(result.snapshot.excluded).reduce((a, b) => a + b, 0),
    ).toBe(result.snapshot.provenance.originalCount);
    expect(new Set(result.snapshot.events.map((row) => row.id)).size).toBe(
      result.snapshot.events.length,
    );
    expect(result.snapshot.events).toHaveLength(377);
    expect(result.snapshot.excluded).toEqual({});
  });
});
