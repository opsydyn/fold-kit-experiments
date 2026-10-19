import { expect, test } from 'bun:test';

import { perspectiveCamera } from '@opsydyn/effect-three';

import { ViewportGizmo } from '../src/index.ts';

const camera = perspectiveCamera({ position: [3, 4, 5], lookAt: [0, 0, 0], damping: 0.1 });
const start = ViewportGizmo.init('view');

test('a head under the pointer is highlighted, and leaving it clears that', () => {
  const over = ViewportGizmo.update(start, ViewportGizmo.Message.Entered({ key: 'view:-x:disc' }));
  expect(over.model.hovered).toBe('-x');
  expect(ViewportGizmo.update(over.model, ViewportGizmo.Message.Left({ key: 'crate' })).model).toBe(
    over.model,
  );
  const off = ViewportGizmo.update(over.model, ViewportGizmo.Message.Left({ key: 'view:-x:disc' }));
  expect(off.model.hovered).toBeNull();
});

test('pressing a head reports the camera looking from its axis; anything else, nothing', () => {
  const pressed = ViewportGizmo.update(
    start,
    ViewportGizmo.Message.Pressed({ key: 'view:z:letter:0', camera }),
  );
  expect(pressed.outMessage?._tag).toBe('Turned');
  const turned = pressed.outMessage?.camera;
  expect(turned?.position[0]).toBeCloseTo(0, 9);
  expect(turned?.position[2]).toBeCloseTo(Math.hypot(3, 4, 5), 9);
  // The rest of the camera is kept: its damping eases it round.
  expect(turned?._tag === 'Perspective' ? turned.damping : 0).toBe(0.1);
  const missed = ViewportGizmo.update(
    start,
    ViewportGizmo.Message.Pressed({ key: 'crate', camera }),
  );
  expect(missed.outMessage).toBeUndefined();
});

test('its HUD holds the gizmo where it is placed', () => {
  const placed = ViewportGizmo.hud(start, camera, { alignment: 'top-right', margin: [60, 60] });
  expect(placed.alignment).toBe('top-right');
  expect(placed.children.map((child) => child.key)).toEqual(['view']);
  const bare = ViewportGizmo.nodes(ViewportGizmo.init('view', { hideNegativeAxes: true }), camera);
  expect(bare._tag === 'Group' ? bare.children.length : 0).toBe(6);
});
