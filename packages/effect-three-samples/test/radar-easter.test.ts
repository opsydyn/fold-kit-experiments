import { describe, expect, test } from 'bun:test';

import type { SceneNode, Vec3 } from '@opsydyn/effect-three';
import { Match, Option } from 'effect';

import {
  departuresIn,
  eggReadout,
  ghostHeight,
  idOfSaucer,
  isEggKey,
  liftOf,
  saucerRadius,
} from '../src/radar/easter';
import { Message } from '../src/radar/message';
import { type Model, positionsOf } from '../src/radar/model';
import { sceneFor } from '../src/radar/scene';
import { blipPosition, outerRadius } from '../src/radar/space';
import { changesIn, playStep } from '../src/radar/timeline';
import { init, update } from '../src/radar/update';

const start = init().model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const third = step(start, Message.ChangedEdition({ index: 2 }));
/** Futhark, which left the radar in the third edition, in the ring it held before. */
const departed = Option.getOrThrow(Option.fromNullishOr(departuresIn(start, 2)[0]));

const nodeAt = (model: Model, key: string): SceneNode | undefined =>
  sceneFor(model).children.find((node) => node.key === key);
const eggKeys = (model: Model): ReadonlyArray<string> =>
  sceneFor(model)
    .children.map((node) => node.key)
    .filter(isEggKey);

type GroupNode = Extract<SceneNode, { readonly _tag: 'Group' }>;
const isGroup = (node: SceneNode): node is GroupNode => node._tag === 'Group';
const asGroup = (node: SceneNode | undefined): Option.Option<GroupNode> =>
  Option.filter(Option.fromNullishOr(node), isGroup);

const fixedEuler = ({ rotation }: GroupNode): Vec3 =>
  Match.value(rotation).pipe(
    Match.tag('Fixed', ({ euler }) => euler),
    Match.orElse((): Vec3 => [0, 0, 0]),
  );

/** The Euler angles of a group's fixed rotation, or none at all. */
const eulerOf = (node: SceneNode | undefined): Vec3 =>
  Option.getOrElse(Option.map(asGroup(node), fixedEuler), (): Vec3 => [0, 0, 0]);

/** A group's first child, if it has one. */
const firstChild = (node: SceneNode | undefined): SceneNode | undefined =>
  Option.getOrUndefined(
    Option.flatMap(asGroup(node), ({ children }) => Option.fromNullishOr(children[0])),
  );

describe('the abduction', () => {
  test('lists the entries that left in an edition, with the ring they held before', () => {
    expect(departuresIn(start, 2).map(({ entry }) => entry.id)).toEqual(['futhark']);
    expect(departuresIn(start, 0)).toEqual([]);
    expect(departuresIn(start, 1)).toEqual([]);
    expect(departuresIn(start, 3)).toEqual([]);
    // Pi was never on the radar before the current edition, so it never left.
    expect(departuresIn(start, 2).some(({ entry }) => entry.id === 'pi')).toBe(false);
    expect(changesIn(start, 2)).toContain('Futhark left the radar');
  });

  test('a saucer hovers only in an edition with a departure', () => {
    expect(eggKeys(start)).toEqual([]);
    expect(eggKeys(third)).toEqual(['egg:saucer:futhark']);
  });

  test('it hovers beyond the outer shell, straight out over the departed blip', () => {
    const saucer = nodeAt(third, 'egg:saucer:futhark');
    const [, turn] = eulerOf(saucer);
    const [tilt] = eulerOf(firstChild(saucer));
    // The two turns point the local y axis out through the blip.
    const axis = [Math.sin(tilt) * Math.sin(turn), Math.cos(tilt), Math.sin(tilt) * Math.cos(turn)];
    const at = blipPosition(departed);
    const length = Math.hypot(...at);
    at.forEach((value, index) => expect(axis[index]).toBeCloseTo(value / length, 9));
    expect(saucerRadius).toBeGreaterThan(outerRadius + 0.3);
  });

  test('while the timeline plays, the ghost rises up the beam; paused or calm, it waits', () => {
    const playing: Model = { ...third, playing: true, playClock: playStep / 2 };
    expect(liftOf(third)).toBe(0);
    expect(liftOf(playing)).toBeCloseTo(0.5, 9);
    expect(liftOf({ ...playing, reducedMotion: true })).toBe(0);
    expect(liftOf({ ...playing, playClock: playStep * 2 })).toBe(1);
    const bottom = ghostHeight(departed, 0);
    expect(bottom).toBeCloseTo(Math.hypot(...blipPosition(departed)), 9);
    expect(ghostHeight(departed, 1)).toBeLessThan(saucerRadius);
    expect(ghostHeight(departed, 0.5)).toBeGreaterThan(bottom);
  });

  test('over the saucer, the readout names the Strangler Fig', () => {
    expect(idOfSaucer('egg:saucer:futhark:craft')).toEqual(Option.some('futhark'));
    expect(Option.isNone(idOfSaucer('blip:futhark'))).toBe(true);
    const hovered = step(third, Message.HoveredEgg({ key: 'egg:saucer:futhark:craft' }));
    expect(Option.getOrUndefined(eggReadout(hovered))).toBe(
      'Strangler Fig: Futhark was replaced, bit by bit, and left the radar',
    );
    const left = step(hovered, Message.LeftEgg({ key: 'egg:saucer:futhark:craft' }));
    expect(Option.isNone(eggReadout(left))).toBe(true);
    // A saucer from another edition has nothing to say.
    expect(Option.isNone(eggReadout({ ...hovered, edition: 3 }))).toBe(true);
  });
});

describe('every egg', () => {
  test('keeps out of the blips’ and labels’ keys, so placement and hover never see it', () => {
    for (const key of eggKeys(third)) {
      expect(key.startsWith('blip:')).toBe(false);
      expect(key.startsWith('label:')).toBe(false);
    }
    expect(positionsOf(third).some(({ entry }) => isEggKey(entry.id))).toBe(false);
  });
});
