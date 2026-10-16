import { expect, test } from 'bun:test';

import type { InstancesNode, SceneDescription } from '@opsydyn/effect-three';
import { Option } from 'effect';

import { Message } from '../src/city/message';
import { buildingCount, buildingKey, buildingOf, init, type Model } from '../src/city/model';
import { sceneFor } from '../src/city/scene';
import { update } from '../src/city/update';

const initial = init().model;
const step = (model: Model, message: Message): Model => update(model, message).model;

const isInstances = (node: SceneDescription['children'][number]): node is InstancesNode =>
  node._tag === 'Instances';

/** The city's instances node; an empty one if the scene had none, failing the tests. */
const cityOf = (description: SceneDescription): Pick<InstancesNode, 'instances'> =>
  description.children.find(isInstances) ?? { instances: [] };

test('the city is 10,000 instances, and an unchanged model reuses the very same list', () => {
  const first = cityOf(sceneFor(initial));
  expect(first.instances).toHaveLength(buildingCount);
  expect(cityOf(sceneFor({ ...initial })).instances).toBe(first.instances);
});

test('hovering changes exactly one instance; every other keeps its reference', () => {
  const before = cityOf(sceneFor(initial)).instances;
  const hovered = step(initial, Message.HoveredBuilding({ instance: buildingKey(4242) }));
  const after = cityOf(sceneFor(hovered)).instances;
  const changed = after.flatMap((item, index) => (item === before[index] ? [] : [index]));
  expect(changed).toEqual([4242]);
});

test('clicks raise and lower buildings; a new city clears them; quality never drops below half', () => {
  const raised = step(initial, Message.ClickedBuilding({ instance: buildingKey(7) }));
  expect(raised.raised).toEqual([7]);
  expect(step(raised, Message.ClickedBuilding({ instance: buildingKey(7) })).raised).toEqual([]);
  expect(step(raised, Message.ClickedNewCity())).toMatchObject({ seed: 2, raised: [] });
  expect(step(initial, Message.ClickedBuilding({ instance: 'nonsense' }))).toBe(initial);
  const slow = step(initial, Message.ChangedPerformance({ fps: 20, factor: 0.2 }));
  expect(slow.quality).toBe(0.5);
  expect(slow.fps).toEqual(Option.some(20));
});

test('instance keys round-trip and out-of-range keys are not buildings', () => {
  expect(buildingOf(buildingKey(0))).toEqual(Option.some(0));
  expect(buildingOf(buildingKey(9999))).toEqual(Option.some(9999));
  expect(Option.isNone(buildingOf('b10000'))).toBe(true);
  expect(Option.isNone(buildingOf('x12'))).toBe(true);
});
