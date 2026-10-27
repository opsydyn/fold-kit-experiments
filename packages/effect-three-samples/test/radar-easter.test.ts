import { describe, expect, test } from 'bun:test';

import type { SceneNode, Vec3 } from '@opsydyn/effect-three';
import { Match, Option } from 'effect';

import {
  blockCount,
  departuresIn,
  eggReadout,
  fallacies,
  fallacyOf,
  ghostHeight,
  idOfSaucer,
  isEggKey,
  isMonolithKey,
  liftOf,
  monolithAt,
  monolithShows,
  probeOrbit,
  saucerRadius,
  shatteredAt,
  wholeAt,
} from '../src/radar/easter';
import { Message } from '../src/radar/message';
import { cameraFov, type Model, positionsOf, visibleOf } from '../src/radar/model';
import { acrossView, frameOf, viewOf } from '../src/radar/placement';
import { sceneFor } from '../src/radar/scene';
import { blipPosition, outerRadius } from '../src/radar/space';
import { magicWords, summoned } from '../src/radar/summon';
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
      'Strangler Fig: Futhark was replaced, bit by bit, and left the radar · ' +
        'Fallacy 1 of 8: the network is reliable',
    );
    const left = step(hovered, Message.LeftEgg({ key: 'egg:saucer:futhark:craft' }));
    expect(Option.isNone(eggReadout(left))).toBe(true);
    // A saucer from another edition has nothing to say.
    expect(Option.isNone(eggReadout({ ...hovered, edition: 3 }))).toBe(true);
  });
});

/** `point` moved `distance` along `direction`. */
const offset = (point: Vec3, direction: Vec3, distance: number): Vec3 => [
  point[0] + direction[0] * distance,
  point[1] + direction[1] * distance,
  point[2] + direction[2] * distance,
];

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Where `point` sits up the view, as `acrossView` does across it. */
const upView = (view: ReturnType<typeof viewOf>, point: Vec3): number => {
  const from = offset(point, view.eye, -1);
  return dot(from, view.up) / dot(from, view.forward);
};

describe('the fallacies of distributed computing', () => {
  test('each visit to a saucer reads the next fallacy, round all eight', () => {
    const key = 'egg:saucer:futhark:craft';
    const visit = (model: Model): Model =>
      step(step(model, Message.HoveredEgg({ key })), Message.LeftEgg({ key }));
    const visits = Array.from({ length: 9 }).reduce<ReadonlyArray<Model>>(
      (models) => [...models, visit(models.at(-1) ?? third)],
      [],
    );
    expect(visits.map(({ saucerVisits }) => saucerVisits)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(fallacyOf(2)).toBe('Fallacy 2 of 8: latency is zero');
    expect(fallacyOf(8)).toBe('Fallacy 8 of 8: the network is homogeneous');
    expect(fallacyOf(9)).toBe(fallacyOf(1));
    expect(fallacies).toHaveLength(8);
    // Hovering anything else leaves the count alone.
    expect(step(third, Message.HoveredEgg({ key: 'egg:monolith' })).saucerVisits).toBe(0);
  });
});

describe('the Monolith', () => {
  const universe = step(start, Message.ClickedUniverse());

  test('floats beside the radar only from above', () => {
    expect(monolithShows(start)).toBe(false);
    expect(eggKeys(start)).not.toContain('egg:monolith');
    expect(monolithShows(universe)).toBe(true);
    expect(eggKeys(universe)).toContain('egg:monolith');
  });

  test('a click shatters it into microservices; another puts it back together', () => {
    expect(universe.monolith).toBe('whole');
    const shattered = step(universe, Message.ClickedMonolith());
    expect(shattered.monolith).toBe('shattered');
    expect(step(shattered, Message.ClickedMonolith()).monolith).toBe('whole');
  });

  test('its blocks tile the 1 : 4 : 9 slab, then scatter onto rings round it', () => {
    const whole = Array.from({ length: blockCount }, (_, index) => wholeAt(index));
    const xs = whole.map(([x]) => x);
    const ys = whole.map(([, y]) => y);
    expect(blockCount).toBe(24);
    // Centre to centre, plus one block: the slab's 0.4 width and 0.9 height.
    expect(Math.max(...xs) - Math.min(...xs) + 0.4 / 3).toBeCloseTo(0.4, 9);
    expect(Math.max(...ys) - Math.min(...ys) + 0.9 / 8).toBeCloseTo(0.9, 9);
    for (let index = 0; index < blockCount; index += 1) {
      const [x, y] = shatteredAt(index);
      expect(Math.hypot(x, y)).toBeGreaterThan(0.2);
      expect(Math.hypot(x, y)).toBeLessThan(0.36);
    }
  });

  test('it stays outside the outer shell and inside even a square stage’s frame', () => {
    for (const camera of [universe.camera.position, start.camera.position]) {
      const centre = monolithAt(camera);
      const view = viewOf(camera, [0, 0, 0]);
      const frame = frameOf(cameraFov, 1);
      // The drift reaches 0.4 from the centre, across the view and up it.
      for (const [across, up] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const point = offset(offset(centre, view.right, 0.4 * across), view.up, 0.4 * up);
        expect(Math.hypot(...point)).toBeGreaterThan(outerRadius + 0.1);
        expect(Math.abs(acrossView(view, point))).toBeLessThan(frame.x);
        expect(Math.abs(upView(view, point))).toBeLessThan(frame.y);
      }
    }
  });

  test('over it, the readout tells you what a click will do', () => {
    const hovered = step(universe, Message.HoveredEgg({ key: 'egg:monolith:block:3' }));
    expect(Option.getOrUndefined(eggReadout(hovered))).toBe('A monolith. Click to decompose it.');
    const shattered = step(hovered, Message.ClickedMonolith());
    expect(Option.getOrUndefined(eggReadout(shattered))).toContain('Microservices');
    expect(isMonolithKey('egg:monolith')).toBe(true);
    expect(isMonolithKey('egg:monoliths')).toBe(false);
  });
});

describe('magic words', () => {
  const searched = (query: string): Model => step(start, Message.ChangedQuery({ query }));

  test('each word summons its egg; case and spaces do not matter, near misses do', () => {
    expect(magicWords.map((word) => Option.getOrUndefined(summoned(word)))).toEqual([
      'monolith',
      'microservices',
      '42',
      'cobol',
    ]);
    expect(summoned('  COBOL ')).toEqual(Option.some('cobol'));
    for (const miss of ['monoliths', 'mono', 'cobol code', '', '4 2']) {
      expect(Option.isNone(summoned(miss))).toBe(true);
    }
  });

  test('a magic word filters nothing: the radar stays full behind the egg', () => {
    for (const word of magicWords) {
      expect(visibleOf(searched(word)).length).toBe(visibleOf(start).length);
    }
    // An ordinary search still filters.
    expect(visibleOf(searched('elm')).length).toBeLessThan(visibleOf(start).length);
  });

  test('“monolith” calls the Monolith from the side, whole; “microservices”, shattered', () => {
    expect(monolithShows(start)).toBe(false);
    const whole = searched('monolith');
    expect(monolithShows(whole)).toBe(true);
    expect(whole.monolith).toBe('whole');
    const shattered = searched('microservices');
    expect(monolithShows(shattered)).toBe(true);
    expect(shattered.monolith).toBe('shattered');
    // Clicks still work while summoned, and clearing the search sends it away.
    expect(step(shattered, Message.ClickedMonolith()).monolith).toBe('whole');
    expect(monolithShows(step(shattered, Message.ChangedQuery({ query: '' })))).toBe(false);
  });

  test('“42” is answered in the readout, unless an egg under the pointer speaks first', () => {
    const answered = searched('42');
    expect(Option.getOrUndefined(eggReadout(answered))).toContain('Deep Thought');
    expect(Option.isNone(eggReadout(start))).toBe(true);
    const over = step(
      step(answered, Message.ChangedQuery({ query: 'cobol' })),
      Message.HoveredEgg({ key: 'egg:probe:craft' }),
    );
    expect(Option.getOrUndefined(eggReadout(over))).toBe('COBOL: still running, very far away');
  });

  test('“cobol” sends a probe round the far sky, holding still under reduced motion', () => {
    expect(eggKeys(start)).not.toContain('egg:probe');
    const probe = nodeAt(searched('cobol'), 'egg:probe');
    expect(probe?._tag === 'Group' && probe.rotation._tag).toBe('Spin');
    const calm = step(
      step(start, Message.ChangedReducedMotion({ isReducedMotion: true })),
      Message.ChangedQuery({ query: 'cobol' }),
    );
    const held = nodeAt(calm, 'egg:probe');
    expect(held?._tag === 'Group' && held.rotation._tag).toBe('Fixed');
    expect(Math.hypot(probeOrbit.radius, probeOrbit.height)).toBeGreaterThan(outerRadius * 2);
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
