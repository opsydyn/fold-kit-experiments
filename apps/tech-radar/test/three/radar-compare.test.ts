import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { comparedWith, moveGlide, moveHold, movesOf } from '../../src/radar/three/compare';
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
  test('finds each entry that moved, joined or left between them', () => {
    const moves = movesOf(comparing, 1);
    const foldkit = moves.find(({ id }) => id === 'foldkit');
    expect(foldkit?.kind).toBe('moved');
    expect(foldkit?.text).toBe('FoldKit moved from Trial to Adopt');
    expect(moves.find(({ id }) => id === 'pi')?.kind).toBe('joined');
    expect(moves.every(({ from, to }) => from.join() !== to.join())).toBe(true);
  });

  test('draws a ghost where a moved entry stood and a line to where it stands', () => {
    expect(keys(comparing)).toContain('ghost:foldkit');
    expect(keys(comparing)).toContain('move:foldkit');
    // A newcomer had nowhere to stand: a line in from beyond the radar, no ghost.
    expect(keys(comparing)).toContain('move:pi');
    expect(keys(comparing)).not.toContain('ghost:pi');
    expect(keys(start).some((key) => key.startsWith('move:'))).toBe(false);
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
