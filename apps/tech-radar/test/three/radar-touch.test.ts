import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { Message } from '../../src/radar/three/message';
import type { Model } from '../../src/radar/three/model';
import { init, update } from '../../src/radar/three/update';
import { demoRadar } from '../../src/test/fixture';

const start = init({ dataset: demoRadar }).model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const steps = (model: Model, messages: ReadonlyArray<Message>): Model =>
  messages.reduce(step, model);
const touch = step(start, Message.ChangedPointerInput({ input: 'touch' }));

describe('reading the radar by touch', () => {
  test('the radar learns whether the reader can hover, and lets go of any hover', () => {
    expect(start.input).toBe('hover');
    const hovered = step(start, Message.HoveredBlip({ key: 'blip:elm' }));
    const switched = step(hovered, Message.ChangedPointerInput({ input: 'touch' }));
    expect(switched.input).toBe('touch');
    expect(Option.isNone(switched.hovered)).toBe(true);
  });

  test('a finger’s press is not a hover: it reads nothing, and its lifting clears nothing', () => {
    expect(Option.isNone(step(touch, Message.HoveredBlip({ key: 'blip:elm' })).hovered)).toBe(true);
    const mouse = step(start, Message.HoveredBlip({ key: 'blip:elm' }));
    expect(mouse.hovered).toEqual(Option.some('elm'));
  });

  test('a tap pins the blip, so it stays read once the finger lifts', () => {
    const tapped = steps(touch, [
      Message.HoveredBlip({ key: 'blip:elm' }),
      Message.ClickedBlip({ key: 'blip:elm' }),
      Message.LeftBlip({ key: 'blip:elm' }),
    ]);
    expect(tapped.selected).toEqual(Option.some('elm'));
  });

  test('a tapped egg keeps speaking after the finger lifts, until a tap elsewhere', () => {
    const key = 'egg:monolith';
    const tapped = steps(touch, [Message.HoveredEgg({ key }), Message.LeftEgg({ key })]);
    expect(tapped.hoveredEgg).toEqual(Option.some(key));
    expect(Option.isNone(step(tapped, Message.ClickedEmptySpace()).hoveredEgg)).toBe(true);
    // With a mouse, leaving still ends it.
    const mouse = steps(start, [Message.HoveredEgg({ key }), Message.LeftEgg({ key })]);
    expect(Option.isNone(mouse.hoveredEgg)).toBe(true);
  });

  test('the press and the tap on a saucer are one visit, not two', () => {
    const key = 'egg:saucer:futhark';
    const once = steps(touch, [Message.HoveredEgg({ key }), Message.HoveredEgg({ key })]);
    expect(once.saucerVisits).toBe(1);
    const again = steps(once, [Message.ClickedEmptySpace(), Message.HoveredEgg({ key })]);
    expect(again.saucerVisits).toBe(2);
  });
});
