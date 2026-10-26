import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { categoryIds } from '../src/radar/data';
import { categoryCenter } from '../src/radar/layout';
import { Message } from '../src/radar/message';
import {
  cameraDamping,
  clusterOfLabel,
  clusterView,
  type Model,
  positionsOf,
} from '../src/radar/model';
import { sceneFor } from '../src/radar/scene';
import { bearingOf, elevationOf } from '../src/radar/space';
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
