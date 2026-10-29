import { describe, expect, test } from 'bun:test';

import { Tooltip } from '@foldkit/ui';

import { Message } from '../../src/radar/three/message';
import type { Model } from '../../src/radar/three/model';
import { isRecordable } from '../../src/radar/three/tour';
import { init, update } from '../../src/radar/three/update';
import { demoRadar } from '../../src/test/fixture';

const start = init({ dataset: demoRadar }).model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const tooltip = (control: 'turn-left' | 'zoom-in', message: Tooltip.Message) =>
  Message.GotTooltipMessage({ control, message });

describe('the entries table', () => {
  test('starts closed, and opens and closes as its toggle says', () => {
    expect(start.entriesOpen).toBe(false);
    const open = step(start, Message.ToggledEntries({ isOpen: true }));
    expect(open.entriesOpen).toBe(true);
    expect(step(open, Message.ToggledEntries({ isOpen: false })).entriesOpen).toBe(false);
  });

  test('opens for a search, so its matches show as a list, and stays open as it clears', () => {
    const searching = step(start, Message.ChangedQuery({ query: 'fold' }));
    expect(searching.entriesOpen).toBe(true);
    expect(step(searching, Message.ChangedQuery({ query: '' })).entriesOpen).toBe(true);
    expect(step(start, Message.ChangedQuery({ query: '  ' })).entriesOpen).toBe(false);
  });
});

describe("the icon buttons' tooltips", () => {
  test('start hidden', () => {
    expect(Object.values(start.tooltips).map(({ isOpen }) => isOpen)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  test("show at once on keyboard focus, only on that button's tooltip, and hide on blur", () => {
    const focused = step(start, tooltip('zoom-in', Tooltip.Message.FocusedTrigger()));
    expect(focused.tooltips['zoom-in'].isOpen).toBe(true);
    expect(focused.tooltips['turn-left'].isOpen).toBe(false);
    const blurred = step(focused, tooltip('zoom-in', Tooltip.Message.BlurredTrigger()));
    expect(blurred.tooltips['zoom-in'].isOpen).toBe(false);
  });

  test('wait before showing on hover, the wait coming back as a radar Message', () => {
    const { model, commands } = update(
      start,
      tooltip('turn-left', Tooltip.Message.EnteredTrigger()),
    );
    expect(model.tooltips['turn-left'].isOpen).toBe(false);
    expect(commands?.length).toBe(1);
  });

  test('leave the radar itself alone and stay out of recorded tours', () => {
    const focused = step(start, tooltip('zoom-in', Tooltip.Message.FocusedTrigger()));
    expect(focused.camera).toEqual(start.camera);
    expect(isRecordable(tooltip('zoom-in', Tooltip.Message.FocusedTrigger()))).toBe(false);
    expect(isRecordable(Message.ToggledEntries({ isOpen: true }))).toBe(false);
  });
});
