import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { Settings, initialSettings } from './settings';

const decode = Schema.decodeUnknownSync(Settings);

describe('comparison settings', () => {
  it('decodes the default linked scatter and histogram with the next unused ID', () => {
    expect(decode(initialSettings)).toEqual({
      panels: [
        { id: 1, kind: 'scatter' },
        { id: 2, kind: 'histogram' },
      ],
      nextPanelId: 3,
      linkInspections: true,
    });
  });

  it('accepts empty collections and non-contiguous IDs in captured order', () => {
    expect(decode({ panels: [], nextPanelId: 3, linkInspections: false }).panels).toEqual([]);
    const captured = {
      panels: [
        { id: 7, kind: 'histogram' },
        { id: 0, kind: 'scatter' },
      ],
      nextPanelId: 8,
      linkInspections: false,
    };
    expect(decode(captured)).toEqual(captured);
  });

  it('accepts a safe exhausted counter above the last allocatable ID', () => {
    const exhausted = {
      panels: [{ id: Number.MAX_SAFE_INTEGER - 1, kind: 'scatter' }],
      nextPanelId: Number.MAX_SAFE_INTEGER,
      linkInspections: true,
    };
    expect(decode(exhausted)).toEqual(exhausted);
    expect(decode({ ...exhausted, panels: [] }).nextPanelId).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid panel ID %s',
    (id) => {
      expect(() => decode({ ...initialSettings, panels: [{ id, kind: 'scatter' }] })).toThrow();
    },
  );

  it.each([-1, 1.5, NaN, Infinity, 1, 2, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid or already used counter %s',
    (nextPanelId) => {
      expect(() => decode({ ...initialSettings, nextPanelId })).toThrow();
    },
  );

  it('rejects duplicate IDs across chart types', () => {
    expect(() =>
      decode({
        ...initialSettings,
        panels: [
          { id: 1, kind: 'scatter' },
          { id: 1, kind: 'histogram' },
        ],
      }),
    ).toThrow();
  });

  it('allows four panels but rejects five', () => {
    const panels = [1, 2, 3, 4, 5].map((id) => ({ id, kind: 'scatter' }));
    expect(
      decode({ ...initialSettings, panels: panels.slice(0, 4), nextPanelId: 6 }).panels,
    ).toHaveLength(4);
    expect(() => decode({ ...initialSettings, panels, nextPanelId: 6 })).toThrow();
  });

  it('rejects unknown kinds and non-boolean linking', () => {
    expect(() => decode({ ...initialSettings, panels: [{ id: 1, kind: 'line' }] })).toThrow();
    expect(() => decode({ ...initialSettings, linkInspections: 'true' })).toThrow();
  });
});
