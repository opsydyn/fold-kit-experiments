import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { Message } from '../../src/radar/three/message';
import {
  blipKey,
  cameraDamping,
  homeCamera,
  type Model,
  positionsOf,
} from '../../src/radar/three/model';
import { blipPosition, detailFor, zoomLimits } from '../../src/radar/three/space';
import { init, update } from '../../src/radar/three/update';

const start = init().model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const distance = (model: Model) => Math.hypot(...model.camera.position);

describe('flying to a blip', () => {
  test('a double-click pins the blip and flies close enough to show it in full', () => {
    const flown = step(start, Message.DoubleClickedBlip({ key: 'blip:foldkit:near:body' }));
    expect(flown.selected).toEqual(Option.some('foldkit'));
    expect(flown.camera.lookAt).toEqual([0, 0, 0]);
    expect(flown.camera.damping).toBe(cameraDamping.flight);
    const foldkit = positionsOf(start).find(({ entry }) => entry.id === 'foldkit');
    expect(foldkit).toBeDefined();
    if (foldkit !== undefined)
      expect(detailFor(flown.camera.position, blipPosition(foldkit))).toBe('full');
  });

  test('every entry’s flight lands within the zoom limits, showing it in full', () => {
    for (const position of positionsOf(start)) {
      const flown = step(start, Message.DoubleClickedBlip({ key: blipKey(position.entry.id) }));
      expect(distance(flown)).toBeGreaterThanOrEqual(zoomLimits.min - 1e-9);
      expect(distance(flown)).toBeLessThanOrEqual(zoomLimits.max);
      expect(detailFor(flown.camera.position, blipPosition(position))).toBe('full');
    }
  });

  test('a double-click after the pin’s own clicks still ends pinned', () => {
    const key = blipKey('elm');
    const clicked = step(step(start, Message.ClickedBlip({ key })), Message.ClickedBlip({ key }));
    expect(Option.isNone(clicked.selected)).toBe(true);
    expect(step(clicked, Message.DoubleClickedBlip({ key })).selected).toEqual(Option.some('elm'));
  });

  test('Fly to in the panel flies the same way, so keyboards can too', () => {
    expect(step(start, Message.ClickedFlyTo({ id: 'elm' }))).toEqual(
      step(start, Message.DoubleClickedBlip({ key: blipKey('elm') })),
    );
  });

  test('a hidden entry cannot be flown to', () => {
    const hidden = step(start, Message.ChangedQuery({ query: 'no entry says this' }));
    expect(step(hidden, Message.DoubleClickedBlip({ key: blipKey('elm') }))).toBe(hidden);
    expect(step(hidden, Message.ClickedFlyTo({ id: 'elm' }))).toBe(hidden);
  });

  test('a drag takes the camera back from the flight, brisk again', () => {
    const flown = step(start, Message.ClickedFlyTo({ id: 'elm' }));
    const dragged = step(
      flown,
      Message.MadeGesture({
        gesture: {
          _tag: 'Drag',
          button: 0,
          modifiers: { shift: false, control: false, meta: false, alt: false },
          width: 800,
          height: 500,
          x: 10,
          y: 10,
          deltaX: 20,
          deltaY: 0,
        },
      }),
    );
    expect(dragged.camera.damping).toBe(cameraDamping.steady);
    expect(homeCamera.damping).toBe(cameraDamping.steady);
  });
});
