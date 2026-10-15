import { describe, expect, it } from 'vitest';

import type { Earthquake, SnapshotResult } from './data';
import { Message } from './message';
import { initModel } from './model';
import { update } from './update';

const observations: ReadonlyArray<Earthquake> = [
  {
    id: 'front',
    longitude: 180,
    latitude: 0,
    magnitude: 3,
    depthKm: 10,
    timeMs: 1000,
    place: 'Pacific',
    url: null,
  },
  {
    id: 'back',
    longitude: 0,
    latitude: 0,
    magnitude: null,
    depthKm: -1,
    timeMs: 1000,
    place: null,
    url: null,
  },
];
export const fixture: SnapshotResult = {
  _tag: 'Ready',
  snapshot: {
    events: observations,
    excluded: {},
    warnings: {},
    window: [1000, 1000],
    provenance: {
      sourceUrl: 'https://earthquake.usgs.gov/',
      capturedAt: '2026-10-14T12:00:00Z',
      generatedAtMs: 1000,
      originalCount: 2,
      sha256: '0'.repeat(64),
    },
  },
};
const initial = () => initModel(fixture);
const start = (pointerId = 1, renderedBaseRadius = 100) =>
  Message.StartedGlobePointer({ pointerId, renderedBaseRadius, clientX: 0, clientY: 0 });

describe('FoldKit globe state', () => {
  it('keeps a valid pose when finite pointer arithmetic would overflow', () => {
    const base = initial();
    const started = update(
      base,
      Message.StartedGlobePointer({
        pointerId: 1,
        clientX: -Number.MAX_VALUE,
        clientY: 0,
        renderedBaseRadius: 100,
      }),
    ).model;
    expect(
      update(
        started,
        Message.MovedGlobePointer({ pointerId: 1, clientX: Number.MAX_VALUE, clientY: 0 }),
      ).model,
    ).toBe(started);
    const zoomed = { ...base, zoom: 2 };
    expect(update(zoomed, start(1, Number.MAX_VALUE)).model).toBe(zoomed);
  });
  it('bounds zoom and restores the initial pose and selection on reset', () => {
    let model = initial();
    expect(model.center).toEqual([-180, 0]);
    for (let i = 0; i < 8; i++) model = update(model, Message.ClickedZoomIn()).model;
    expect(model.zoom).toBe(2);
    for (let i = 0; i < 8; i++) model = update(model, Message.ClickedZoomOut()).model;
    expect(model.zoom).toBe(1);
    model = update(model, Message.ClickedEventRow({ id: 'back' })).model;
    model = update(model, start()).model;
    expect(update(model, Message.ClickedReset()).model).toEqual(initial());
  });
  it('derives drag from the start pose rather than repeatedly applying deltas', () => {
    const started = update(initial(), start()).model;
    const move = Message.MovedGlobePointer({ pointerId: 1, clientX: 50, clientY: 0 });
    const moved = update(started, move).model;
    expect(moved.center).toEqual([135, 0]);
    expect(update(moved, move).model.center).toEqual([135, 0]);
  });
  it('rejects other pointers and invalid start dimensions', () => {
    const model = update(initial(), start()).model;
    expect(update(model, start(2)).model).toBe(model);
    expect(
      update(model, Message.MovedGlobePointer({ pointerId: 2, clientX: 100, clientY: 0 })).model,
    ).toBe(model);
    expect(update(model, Message.EndedGlobePointer({ pointerId: 2 })).model).toBe(model);
    expect(update(initial(), start(1, 0)).model).toEqual(initial());
    expect(update(initial(), start(1, NaN)).model).toEqual(initial());
  });
  it('suppresses the pointer click after dragging but permits keyboard inspection', () => {
    let model = update(initial(), start()).model;
    model = update(
      model,
      Message.MovedGlobePointer({ pointerId: 1, clientX: 5, clientY: 0 }),
    ).model;
    model = update(model, Message.EndedGlobePointer({ pointerId: 1 })).model;
    model = update(model, Message.ClickedMarker({ id: 'front', keyboard: false })).model;
    expect(model.selectedId).toBeNull();
    expect(
      update(model, Message.ClickedMarker({ id: 'front', keyboard: true })).model.selectedId,
    ).toBe('front');
  });
  it('recentres table inspection, preserves selection during rotation and ignores unknown IDs', () => {
    const selected = update(initial(), Message.ClickedEventRow({ id: 'back' })).model;
    expect(selected.center).toEqual([0, 0]);
    let rotated = selected;
    for (let i = 0; i < 12; i++)
      rotated = update(rotated, Message.ClickedTurn({ direction: 'east' })).model;
    expect(rotated.center).toEqual([-180, 0]);
    expect(rotated.selectedId).toBe('back');
    expect(update(rotated, Message.ClickedEventRow({ id: 'missing' })).model).toBe(rotated);
  });
  it('uses the same transitions for focused keyboard controls and clamps poles', () => {
    let model = initial();
    expect(update(model, Message.PressedGlobeKey({ key: 'ArrowRight' })).model).toEqual(
      update(model, Message.ClickedTurn({ direction: 'east' })).model,
    );
    for (let i = 0; i < 10; i++)
      model = update(model, Message.PressedGlobeKey({ key: 'ArrowUp' })).model;
    expect(model.center[1]).toBe(90);
    expect(update(model, Message.PressedGlobeKey({ key: 'Tab' })).model).toBe(model);
  });
});
