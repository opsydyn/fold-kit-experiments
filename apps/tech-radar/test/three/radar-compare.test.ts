import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import {
  arrivalLength,
  arrivalProgress,
  arriving,
  comparedWith,
  moveGlide,
  moveHold,
  movesOf,
} from '../../src/radar/three/compare';
import { decodeLink, linkOf } from '../../src/radar/three/link';
import { Message } from '../../src/radar/three/message';
import { editionsOf, type Model } from '../../src/radar/three/model';
import { sceneFor } from '../../src/radar/three/scene';
import { init, update } from '../../src/radar/three/update';
import { demoRadar } from '../../src/test/fixture';

const start = init({ dataset: demoRadar }).model;
const editions = editionsOf(start);
const current = editions.length - 1;
const step = (model: Model, message: Message): Model => update(model, message).model;
const comparing = step(start, Message.ChoseComparison({ index: 1 }));
const keys = (model: Model) => sceneFor(model).children.map(({ key }) => key);

describe('comparing two editions', () => {
  test('tells each change apart: in, out, new, back or gone', () => {
    const moves = movesOf(comparing, 1);
    const foldkit = moves.find(({ id }) => id === 'foldkit');
    expect(foldkit?.kind).toBe('in');
    expect(foldkit?.glyph).toBe('▲');
    expect(foldkit?.text).toBe('FoldKit · Trial → Adopt');
    expect(moves.find(({ id }) => id === 'pi')?.kind).toBe('new');
    expect(moves.find(({ id }) => id === 'pi')?.text).toBe('Pi · new in Trial');
  });

  test('knows an entry that was on the radar before, then off it, is back', () => {
    const third = step(start, Message.ChoseComparison({ index: 2 }));
    const futhark = movesOf(third, 2).find(({ id }) => id === 'futhark');
    expect(futhark?.kind).toBe('returned');
    expect(futhark?.glyph).toBe('↺');
  });

  test('marks each kind its own way', () => {
    const third = step(start, Message.ChoseComparison({ index: 2 }));
    expect(keys(third)).toEqual(
      expect.arrayContaining(['ghost:foldkit', 'move:foldkit', 'chevron:foldkit']),
    );
    expect(keys(third)).toEqual(expect.arrayContaining(['halo:pi', 'flare:pi', 'burst:pi']));
    expect(keys(third)).toEqual(expect.arrayContaining(['comet:futhark', 'comet-head:futhark']));
    expect(keys(third)).not.toContain('ghost:pi');
    expect(keys(start).some((key) => key.startsWith('move:'))).toBe(false);
  });

  test('settles the arrivals into their resting marks', () => {
    const third = step(start, Message.ChoseComparison({ index: 2 }));
    expect(arriving(third)).toBe(true);
    const settled = step(third, Message.AdvancedArrivals({ deltaTimeMs: arrivalLength }));
    expect(arriving(settled)).toBe(false);
    // The flare and burst burn out; the halo and the comet's tail stay.
    expect(keys(settled)).toEqual(expect.arrayContaining(['halo:pi', 'comet:futhark']));
    expect(keys(settled)).not.toContain('flare:pi');
    expect(keys(settled)).not.toContain('comet-head:futhark');
    // Under reduced motion the marks rest from the start.
    const still = step(third, Message.ChangedReducedMotion({ isReducedMotion: true }));
    expect(arrivalProgress(still)).toBe(1);
    expect(keys(still)).not.toContain('flare:pi');
  });

  test('draws an event horizon where an entry that left stood', () => {
    const left = movesOf({ ...start, edition: 2, comparing: Option.some(1) }, 1).find(
      ({ kind }) => kind === 'left',
    );
    expect(left?.glyph).toBe('◌');
    expect(left?.from).toEqual(left?.to);
  });

  test('only ever compares with an earlier edition', () => {
    expect(step(start, Message.ChoseComparison({ index: current })).comparing).toEqual(
      Option.none(),
    );
    expect(step(comparing, Message.ChoseComparison({ index: null })).comparing).toEqual(
      Option.none(),
    );
    // Scrubbing back to (or before) the compared edition ends the comparison.
    expect(comparedWith(step(comparing, Message.ChangedEdition({ index: 1 })))).toEqual(
      Option.none(),
    );
  });

  test('plays the moves: the earlier edition for a beat, then back to the shown one', () => {
    const playing = step(comparing, Message.ClickedPlayMoves());
    expect(playing.edition).toBe(1);
    const held = step(playing, Message.AdvancedMoves({ deltaTimeMs: moveHold - 1 }));
    expect(held.edition).toBe(1);
    const gliding = step(held, Message.AdvancedMoves({ deltaTimeMs: 2 }));
    expect(gliding.edition).toBe(current);
    expect(comparedWith(gliding)).toEqual(Option.some(1));
    const done = step(gliding, Message.AdvancedMoves({ deltaTimeMs: moveGlide }));
    expect(done.movePlayback).toEqual(Option.none());
  });

  test('does not play under reduced motion, where there is no glide to watch', () => {
    const still = step(comparing, Message.ChangedReducedMotion({ isReducedMotion: true }));
    expect(step(still, Message.ClickedPlayMoves()).movePlayback).toEqual(Option.none());
  });

  test('travels in a link, by date', () => {
    const link = linkOf(comparing);
    expect(link).toContain(`compare=${editions[1]?.authoredOn}`);
    const opened = init({
      dataset: demoRadar,
      link: Object.fromEntries(new URLSearchParams(link)),
    }).model;
    expect(comparedWith(opened)).toEqual(Option.some(1));
    expect(decodeLink({ compare: 'not-a-date' }).compare).toEqual(Option.none());
  });
});
