import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { categoryIds } from '../src/radar/data';
import { categoryCenter } from '../src/radar/layout';
import { Message } from '../src/radar/message';
import {
  cameraDamping,
  clusterOfLabel,
  clusterView,
  editionsOf,
  flightTo,
  isVisible,
  type Model,
  positionsOf,
  presentOf,
} from '../src/radar/model';
import { alongPath, easeInOut, relayDamping, relayDuration } from '../src/radar/relay';
import { sceneFor } from '../src/radar/scene';
import { bearingOf, elevationOf } from '../src/radar/space';
import { changesIn, playStep } from '../src/radar/timeline';
import { trailOf } from '../src/radar/trail';
import { init, update } from '../src/radar/update';

const start = init().model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const steps = (model: Model, messages: ReadonlyArray<Message>): Model =>
  messages.reduce(step, model);
const namesOf = (model: Model): ReadonlyArray<string> =>
  sceneFor(model)
    .children.map((node) => node.key)
    .filter((key) => key.startsWith('label:name:'))
    .map((key) => key.replace('label:name:', ''));

describe('cluster stops', () => {
  test('a cluster stop flies to the category’s sector, in front and a little above', () => {
    for (const category of categoryIds) {
      const stopped = step(start, Message.ClickedCluster({ category }));
      expect(stopped.cluster).toEqual(Option.some(category));
      expect(bearingOf(stopped.camera.position)).toBeCloseTo(categoryCenter(category)[0], 9);
      expect(elevationOf(stopped.camera.position)).toBeCloseTo(clusterView.elevation, 9);
      expect(Math.hypot(...stopped.camera.position)).toBeCloseTo(clusterView.distance, 9);
      expect(stopped.camera.lookAt).toEqual([0, 0, 0]);
      expect(stopped.camera.damping).toBe(cameraDamping.flight);
    }
  });

  test('at a cluster stop, the sector’s nearer entries are named', () => {
    const stopped = step(start, Message.ClickedCluster({ category: 'tools' }));
    const tools = new Set(
      positionsOf(start)
        .filter(({ entry }) => entry.category === 'tools')
        .map(({ entry }) => entry.id),
    );
    expect(namesOf(stopped).filter((id) => tools.has(id)).length).toBeGreaterThan(0);
  });

  test('a category’s name in the scene is a cluster stop', () => {
    expect(clusterOfLabel('label:category:platforms')).toEqual(Option.some('platforms'));
    expect(Option.isNone(clusterOfLabel('label:ring:adopt'))).toBe(true);
    expect(Option.isNone(clusterOfLabel('label:category:nowhere'))).toBe(true);
    const label = sceneFor(start).children.find((node) => node.key === 'label:category:platforms');
    expect(label?._tag === 'Label' && label.interactive).toBe(true);
  });

  test('flying to an entry stops at its cluster; the overview views leave every cluster', () => {
    const flown = step(start, Message.ClickedFlyTo({ id: 'foldkit' }));
    expect(flown.cluster).toEqual(Option.some('languages-frameworks'));
    expect(step(flown, Message.ClickedResetView()).cluster).toEqual(Option.none());
    expect(step(flown, Message.ClickedUniverse()).cluster).toEqual(Option.none());
    const chosen = steps(start, [Message.ClickedEntry({ id: 'bun' })]);
    expect(chosen.cluster).toEqual(Option.some('tools'));
  });
});

describe('breadcrumb', () => {
  test('the trail reads radar, then cluster, then entry, each flying back there', () => {
    expect(trailOf(start).map(({ label }) => label)).toEqual(['Radar']);
    const stopped = step(start, Message.ClickedCluster({ category: 'tools' }));
    expect(trailOf(stopped).map(({ label }) => label)).toEqual(['Radar', 'Tools']);
    const flown = step(stopped, Message.ClickedFlyTo({ id: 'bun' }));
    const trail = trailOf(flown);
    expect(trail.map(({ label }) => label)).toEqual(['Radar', 'Tools', 'Bun']);
    expect(trail.map(({ message }) => message)).toEqual([
      Message.ClickedUniverse(),
      Message.ClickedCluster({ category: 'tools' }),
      Message.ClickedFlyTo({ id: 'bun' }),
    ]);
    // Each crumb takes you back up: the cluster crumb leaves the entry pinned but stops there.
    const back = step(flown, Message.ClickedCluster({ category: 'tools' }));
    expect(back.cluster).toEqual(Option.some('tools'));
    expect(step(flown, Message.ClickedUniverse()).cluster).toEqual(Option.none());
  });
});

describe('relay jumps', () => {
  const atFoldkit = step(start, Message.ClickedFlyTo({ id: 'foldkit' }));
  const elm = positionsOf(start).find(({ entry }) => entry.id === 'elm');

  test('following a relationship rides its edge, with the far entry pinned from the start', () => {
    const riding = step(atFoldkit, Message.ClickedRelay({ to: 'elm' }));
    expect(riding.selected).toEqual(Option.some('elm'));
    expect(riding.cluster).toEqual(Option.some('languages-frameworks'));
    const journey = Option.getOrUndefined(riding.journey);
    expect(journey?.to).toBe('elm');
    expect(journey?.waypoints.length).toBe(26);
    if (elm !== undefined) expect(journey?.waypoints.at(-1)).toEqual(flightTo(elm).position);
  });

  test('each frame moves the camera along the ride, then it lands as a flight would', () => {
    const riding = step(atFoldkit, Message.ClickedRelay({ to: 'elm' }));
    const waypoints = Option.getOrUndefined(riding.journey)?.waypoints ?? [];
    const midway = step(riding, Message.AdvancedRelay({ deltaTimeMs: relayDuration / 2 }));
    expect(midway.camera.position).toEqual(alongPath(waypoints, easeInOut(0.5)));
    expect(midway.camera.damping).toBe(relayDamping);
    const landed = step(midway, Message.AdvancedRelay({ deltaTimeMs: relayDuration }));
    expect(Option.isNone(landed.journey)).toBe(true);
    if (elm !== undefined) expect(landed.camera).toEqual(flightTo(elm));
  });

  test('any move of the camera cancels the ride', () => {
    const riding = step(atFoldkit, Message.ClickedRelay({ to: 'elm' }));
    for (const message of [
      Message.ClickedResetView(),
      Message.ClickedZoom({ direction: 'in' }),
      Message.ClickedCluster({ category: 'tools' }),
    ]) {
      expect(Option.isNone(step(riding, message).journey)).toBe(true);
    }
  });

  test('under reduced motion, or with nothing pinned, it flies straight there', () => {
    const calm = step(atFoldkit, Message.ChangedReducedMotion({ isReducedMotion: true }));
    const jumped = step(calm, Message.ClickedRelay({ to: 'elm' }));
    expect(Option.isNone(jumped.journey)).toBe(true);
    if (elm !== undefined) expect(jumped.camera).toEqual(flightTo(elm));
    const unpinned = step(start, Message.ClickedRelay({ to: 'elm' }));
    expect(Option.isNone(unpinned.journey)).toBe(true);
    expect(unpinned.selected).toEqual(Option.some('elm'));
  });

  test('the ride eases in and out, and runs from its first waypoint to its last', () => {
    expect([easeInOut(0), easeInOut(0.5), easeInOut(1)]).toEqual([0, 0.5, 1]);
    const path = [
      [0, 0, 0],
      [2, 0, 0],
      [2, 2, 0],
    ] as const;
    expect(alongPath(path, 0)).toEqual([0, 0, 0]);
    expect(alongPath(path, 0.5)).toEqual([2, 0, 0]);
    expect(alongPath(path, 1)).toEqual([2, 2, 0]);
  });
});

describe('timeline replay', () => {
  const first = step(start, Message.ChangedEdition({ index: 0 }));
  const ringOf = (model: Model, id: string) =>
    positionsOf(model).find(({ entry }) => entry.id === id)?.entry.ring;

  test('the radar opens on the current edition, the last of four', () => {
    expect(editionsOf(start).map(({ label }) => label)).toEqual([
      'First edition',
      'Second edition',
      'Third edition',
      'Current edition',
    ]);
    expect(start.edition).toBe(3);
  });

  test('an earlier edition puts entries in the rings they held then, and leaves out newcomers', () => {
    expect(ringOf(first, 'foldkit')).toBe('assess');
    expect(ringOf(start, 'foldkit')).toBe('adopt');
    expect(isVisible(first, 'claude-code')).toBe(false);
    expect(isVisible(start, 'claude-code')).toBe(true);
    expect(presentOf(first).length).toBeLessThan(presentOf(start).length);
  });

  test('each edition says what changed since the one before', () => {
    expect(changesIn(start, 0)).toEqual([]);
    const second = changesIn(start, 1);
    expect(second).toContain('FoldKit moved from Assess to Trial');
    expect(second).toContain('Claude Code joined in Assess');
    expect(changesIn(start, 3)).toContain('Pi joined in Trial');
  });

  test('scrubbing to an edition without the pinned entry lets go of it', () => {
    const pinned = step(start, Message.ClickedFlyTo({ id: 'pi' }));
    expect(step(pinned, Message.ChangedEdition({ index: 0 })).selected).toEqual(Option.none());
    expect(step(start, Message.ChangedEdition({ index: 99 })).edition).toBe(3);
  });

  test('play steps through the editions and stops at the last; from the last it starts over', () => {
    const playing = step(start, Message.ClickedPlay());
    expect([playing.playing, playing.edition]).toEqual([true, 0]);
    const once = step(playing, Message.AdvancedPlayback({ deltaTimeMs: playStep }));
    expect([once.edition, once.playing]).toEqual([1, true]);
    const end = [2, 3].reduce(
      (model) => step(model, Message.AdvancedPlayback({ deltaTimeMs: playStep })),
      once,
    );
    expect([end.edition, end.playing]).toEqual([3, false]);
    const paused = step(step(first, Message.ClickedPlay()), Message.ClickedPlay());
    expect([paused.playing, paused.edition]).toEqual([false, 0]);
  });
});
