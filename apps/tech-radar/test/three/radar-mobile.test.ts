import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { Message } from '../../src/radar/three/message';
import type { Model } from '../../src/radar/three/model';
import { sheetAfter, swipeDistance } from '../../src/radar/three/sheet';
import { fovFor } from '../../src/radar/three/stageSize';
import { init, update } from '../../src/radar/three/update';
import { demoRadar } from '../../src/test/fixture';

const start = init({ dataset: demoRadar }).model;
const step = (model: Model, message: Message) => update(model, message);

describe('the sheet on a phone', () => {
  test('a tap swaps peek and half, and brings full down to half', () => {
    expect(sheetAfter('peek', 0)).toBe('half');
    expect(sheetAfter('half', swipeDistance - 1)).toBe('peek');
    expect(sheetAfter('full', 0)).toBe('half');
  });

  test('a swipe moves a stop up or down, staying within the stops', () => {
    expect(sheetAfter('peek', -100)).toBe('half');
    expect(sheetAfter('half', -100)).toBe('full');
    expect(sheetAfter('full', -100)).toBe('full');
    expect(sheetAfter('full', 100)).toBe('half');
    expect(sheetAfter('peek', 100)).toBe('peek');
  });

  test('a press and release on the handle moves the sheet, and a release alone does not', () => {
    const pressed = step(start, Message.PressedSheetHandle({ y: 600 })).model;
    const raised = step(pressed, Message.ReleasedSheetHandle({ y: 480 })).model;
    expect(raised.sheet).toBe('half');
    expect(raised.sheetDrag).toEqual(Option.none());
    expect(step(raised, Message.ReleasedSheetHandle({ y: 100 })).model.sheet).toBe('half');
  });
});

describe('the immersive radar', () => {
  test('asks the browser for the screen on the way in and gives it back on the way out', () => {
    const half = step(start, Message.ChoseSheetStop({ stop: 'half' })).model;
    const entered = step(half, Message.ClickedImmersive());
    expect(entered.model.immersive).toBe(true);
    expect(entered.model.sheet).toBe('peek');
    expect(entered.commands?.map(({ name }) => name)).toEqual(['EnterFullscreen']);
    const left = step(entered.model, Message.ClickedImmersive());
    expect(left.model.immersive).toBe(false);
    expect(left.commands?.map(({ name }) => name)).toEqual(['ExitFullscreen']);
  });

  test("More opens the pinned entry's card in the sheet", () => {
    const entered = step(start, Message.ClickedImmersive()).model;
    const more = step(entered, Message.ClickedMoreFromImmersive()).model;
    expect(more.immersive).toBe(false);
    expect(more.sheet).toBe('half');
  });

  test("leaving the browser's full screen leaves it; entering it does not", () => {
    const entered = step(start, Message.ClickedImmersive()).model;
    expect(step(entered, Message.ChangedFullscreen({ isFullscreen: true })).model.immersive).toBe(
      true,
    );
    expect(step(entered, Message.ChangedFullscreen({ isFullscreen: false })).model.immersive).toBe(
      false,
    );
  });

  test('Esc leaves it before it unpins', () => {
    const pinned = step(start, Message.PressedShortcut({ shortcut: 'next-entry' })).model;
    const entered = step(pinned, Message.ClickedImmersive()).model;
    const escaped = step(entered, Message.PressedShortcut({ shortcut: 'clear' })).model;
    expect(escaped.immersive).toBe(false);
    expect(Option.isSome(escaped.selected)).toBe(true);
  });
});

describe('a tall stage', () => {
  test('keeps the field of view on a square or wide stage', () => {
    expect(fovFor(40, 1)).toBe(40);
    expect(fovFor(40, 1.8)).toBe(40);
  });

  test('widens it on a portrait stage so the horizontal view stays the same', () => {
    const aspect = 375 / 660;
    const fov = fovFor(40, aspect);
    const across = Math.tan((fov * Math.PI) / 360) * aspect;
    expect(across).toBeCloseTo(Math.tan((40 * Math.PI) / 360), 9);
  });

  test('follows the canvas as it changes shape', () => {
    expect(step(start, Message.ResizedStage({ aspect: 0.6 })).model.stageAspect).toBe(0.6);
  });
});

describe('the minimap on a phone', () => {
  test('is put away until its button is pressed', () => {
    expect(start.minimapShown).toBe(false);
    expect(step(start, Message.ClickedMinimap()).model.minimapShown).toBe(true);
  });
});
