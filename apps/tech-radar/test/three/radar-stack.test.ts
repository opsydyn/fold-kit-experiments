import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { Message } from '../../src/radar/three/message';
import { editionsOf, type Model, visibleOf } from '../../src/radar/three/model';
import { sceneFor } from '../../src/radar/three/scene';
import {
  astroProgress,
  effectReadout,
  failingFiber,
  fiberState,
  foldLength,
  foldOf,
  islandsOf,
  joinedAt,
  stackEggMoves,
  stackReadout,
  stagedModel,
} from '../../src/radar/three/stack';
import { init, update } from '../../src/radar/three/update';
import { demoRadar } from '../../src/test/fixture';

const start = init({ dataset: demoRadar }).model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const searched = (query: string): Model => step(start, Message.ChangedQuery({ query }));
const after = (model: Model, ms: number): Model =>
  step(model, Message.AdvancedStackEgg({ deltaTimeMs: ms }));
const keysOf = (model: Model): ReadonlyArray<string> =>
  sceneFor(model).children.map((node) => node.key);
const still = (model: Model): Model => ({ ...model, reducedMotion: true });

describe('the stack eggs', () => {
  test('each runs its clock only while its word is typed, from zero', () => {
    expect(stackEggMoves(start)).toBe(false);
    const astro = after(searched('astro'), 900);
    expect(stackEggMoves(astro)).toBe(true);
    expect(astro.stackClock).toBe(900);
    // Another word starts its own egg from the beginning; the same word keeps its clock.
    expect(step(astro, Message.ChangedQuery({ query: 'effect' })).stackClock).toBe(0);
    expect(step(astro, Message.ChangedQuery({ query: ' ASTRO ' })).stackClock).toBe(900);
    expect(stackEggMoves(still(astro))).toBe(false);
  });

  test('astro: a rocket crosses the sky, hydrating one blip in three as it passes', () => {
    const launched = searched('astro');
    expect(keysOf(launched)).toContain('egg:astro');
    const islands = (model: Model) =>
      keysOf(model).filter((key) => key.startsWith('egg:astro:island:'));
    const crossed = after(launched, 5200);
    expect(astroProgress(crossed)).toBe(1);
    expect(islands(crossed)).toHaveLength(islandsOf(crossed).length);
    expect(islandsOf(crossed).length).toBeLessThan(visibleOf(crossed).length / 2);
    // Under reduced motion it holds mid-sky.
    expect(astroProgress(still(launched))).toBe(0.5);
  });

  test('foldkit: space folds to a point, then unfolds through every edition in turn', () => {
    const folding = searched('foldkit');
    expect(foldOf(after(folding, 700)).pipe(Option.map(({ stage }) => stage))).toEqual(
      Option.some('folding'),
    );
    const folded = after(folding, 1600);
    expect(foldOf(folded).pipe(Option.map(({ squeeze }) => squeeze))).toEqual(Option.some(0));
    // While it plays, every entry shows, whatever the search found.
    expect(stagedModel(folded).query).toBe('');
    const editions = editionsOf(start).length;
    const shown = Array.from({ length: editions }, (_, index) =>
      Option.getOrUndefined(
        Option.flatMap(foldOf(after(folding, 2100 + index * 900 + 450)), ({ edition }) => edition),
      ),
    );
    expect(shown).toEqual(Array.from({ length: editions }, (_, index) => index));
    // Played out, the radar is itself again, still finding FoldKit.
    const done = after(folding, foldLength(folding));
    expect(Option.isNone(foldOf(done))).toBe(true);
    expect(stackEggMoves(done)).toBe(false);
    expect(stagedModel(done).query).toBe('foldkit');
  });

  test('foldkit says what it is doing, and holds still under reduced motion', () => {
    expect(stackReadout(after(searched('foldkit'), 300))).toEqual(
      Option.some('FoldKit: folding every Message into one Model'),
    );
    expect(Option.isNone(foldOf(still(searched('foldkit'))))).toBe(true);
  });

  test('effect: every fiber joins; one fails twice and is retried after a doubling delay', () => {
    expect(fiberState('tools', joinedAt).reach).toBe(1);
    expect(fiberState(failingFiber, joinedAt).reach).toBe(1);
    expect(fiberState(failingFiber, 1200).reach).toBeLessThan(1);
    expect(Option.isSome(fiberState(failingFiber, 800).spark)).toBe(true);
    expect(effectReadout(1100)).toContain('Retrying in 500 ms');
    expect(effectReadout(2700)).toContain('Retrying in 1000 ms');
    expect(effectReadout(3600)).toContain('attempt 3');
    expect(effectReadout(joinedAt)).toContain('every fiber joined');
    const forked = after(searched('effect'), 600);
    expect(keysOf(forked)).toContain(`egg:effect:fiber:${failingFiber}`);
  });
});
