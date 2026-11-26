import { describe, expect, test } from 'bun:test';

import { Message } from '../../src/radar/three/message';
import type { Model } from '../../src/radar/three/model';
import { isRecordable } from '../../src/radar/three/tour';
import { init, update } from '../../src/radar/three/update';
import { demoRadar } from '../../src/test/fixture';

const start = init({ dataset: demoRadar }).model;
const step = (model: Model, message: Message): Model => update(model, message).model;

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

describe('the help panel', () => {
  test('opens and closes without moving the camera or producing a tour move', () => {
    expect(start.helpOpen).toBe(false);
    const opened = Message.ToggledHelp({ open: true });
    const showing = step(start, opened);
    expect(showing.helpOpen).toBe(true);
    expect(showing.camera).toEqual(start.camera);
    expect(step(showing, Message.ToggledHelp({ open: false })).helpOpen).toBe(false);
    expect(isRecordable(opened)).toBe(false);
  });
});
