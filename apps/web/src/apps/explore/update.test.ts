import { describe, expect, it } from 'vitest';

import { scatter } from './charts';
import { POINT_COUNT } from './data';
import { Message } from './message';
import { init } from './model';
import { update } from './update';

const { model } = init({});

describe('explore', () => {
  it('compiles the million-point scatter once and indexes every visible point', () => {
    const { index } = scatter(null, null);
    expect(index.size).toBe(POINT_COUNT);
  });

  it('hovers the nearest request, and clears when the pointer leaves', () => {
    const { geometry } = scatter(null, null);
    const plot = geometry.facets[0]?.plot;
    const x = ((plot?.left ?? 0) + (plot?.right ?? 0)) / 2,
      y = ((plot?.top ?? 0) + (plot?.bottom ?? 0)) / 2;
    const hovered = update(model, Message.MovedPointer({ surface: 'scatter', x, y })).model;
    expect(hovered.hover?.row).toBeGreaterThanOrEqual(0);
    expect(
      update(hovered, Message.MovedPointer({ surface: 'outside', x: 0, y: 0 })).model.hover,
    ).toBeNull();
  });

  it('brushes the histogram into a latency range, and a click clears it', () => {
    const pressed = update(model, Message.PressedPointer({ surface: 'histogram', x: 100 })).model;
    const dragged = update(
      pressed,
      Message.MovedPointer({ surface: 'histogram', x: 300, y: 50 }),
    ).model;
    expect(dragged.brushPixels).toEqual([100, 300]);
    const released = update(dragged, Message.ReleasedPointer()).model;
    expect(released.brushed?.[0]).toBeLessThan(released.brushed?.[1] ?? 0);
    const clicked = update(
      update(released, Message.PressedPointer({ surface: 'histogram', x: 200 })).model,
      Message.ReleasedPointer(),
    ).model;
    expect(clicked.brushed).toBeNull();
  });

  it('highlights live while dragging on the GPU, repainting the points layer in place', () => {
    expect(model.points).toBe('gpu');
    const pressed = update(model, Message.PressedPointer({ surface: 'histogram', x: 100 })).model;
    const dragging = update(pressed, Message.MovedPointer({ surface: 'histogram', x: 300, y: 50 }));
    expect(dragging.model.brushed?.[0]).toBeLessThan(dragging.model.brushed?.[1] ?? 0);
    expect(dragging.commands?.map((command) => command.name)).toEqual(['HighlightScatter']);
    // The same covered bins keep the same highlight, and repaint nothing.
    const still = update(
      dragging.model,
      Message.MovedPointer({ surface: 'histogram', x: 301, y: 50 }),
    );
    expect(still.commands).toBeUndefined();
    const reset = update(dragging.model, Message.ResetView());
    expect(reset.commands?.map((command) => command.name)).toEqual(['HighlightScatter']);
  });

  it('falls back to canvas when the GPU layer cannot be made, highlighting on release as before', () => {
    const fallback = update(
      model,
      Message.FailedPointsLayer({ reason: 'WebGL is unavailable' }),
    ).model;
    expect(fallback.points).toBe('canvas');
    const pressed = update(
      fallback,
      Message.PressedPointer({ surface: 'histogram', x: 100 }),
    ).model;
    const dragging = update(pressed, Message.MovedPointer({ surface: 'histogram', x: 300, y: 50 }));
    expect(dragging.model.brushed).toBeNull();
    expect(dragging.commands).toBeUndefined();
    const released = update(dragging.model, Message.ReleasedPointer());
    expect(released.model.brushed).not.toBeNull();
    expect(released.commands).toBeUndefined();
  });

  it('zooms the latency axis in and resets', () => {
    const zoomed = update(model, Message.ZoomedIn()).model;
    expect(zoomed.domain).not.toBeNull();
    expect(update(zoomed, Message.ResetView()).model.domain).toBeNull();
  });
});
