import { describe, expect, test } from 'bun:test';

import type { SceneNode } from '@opsydyn/effect-three';
import { Option } from 'effect';

import { bodyOf, detailDistances, orbitOf, starField } from '../src/radar/bodies';
import { categoryIds } from '../src/radar/data';
import { Message } from '../src/radar/message';
import { blipKey, idOfBlip, type Model, positionsOf, relationshipsOf } from '../src/radar/model';
import { relationsOf } from '../src/radar/relations';
import { sceneFor } from '../src/radar/scene';
import { nameDistance, zoomLimits } from '../src/radar/space';
import { init, update } from '../src/radar/update';

const start = init().model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const steps = (model: Model, messages: ReadonlyArray<Message>): Model =>
  messages.reduce(step, model);
/** Facing FoldKit, close enough to see its moons. */
const close = steps(start, [
  Message.ClickedEntry({ id: 'foldkit' }),
  Message.ClickedZoom({ direction: 'in' }),
  Message.ClickedZoom({ direction: 'in' }),
]);

/** Every node in the scene, groups opened, so a blip's parts can be found by key. */
const flatten = (nodes: ReadonlyArray<SceneNode>): ReadonlyArray<SceneNode> =>
  nodes.flatMap((node) => [node, ...(node._tag === 'Group' ? flatten(node.children) : [])]);
const nodeOf = (model: Model, key: string): SceneNode | undefined =>
  flatten(sceneFor(model).children).find((node) => node.key === key);
const keysUnder = (model: Model, prefix: string): ReadonlyArray<string> =>
  flatten(sceneFor(model).children)
    .map((node) => node.key)
    .filter((key) => key.startsWith(prefix));

/** An entry of each category, from the demo data. */
const entryOf = (category: (typeof categoryIds)[number]): string =>
  positionsOf(start).find(({ entry }) => entry.category === category)?.entry.id ?? 'missing';

describe('blip bodies', () => {
  test('each category has its own body, and only the giant wears a ring', () => {
    for (const category of categoryIds) {
      const id = entryOf(category);
      const body = nodeOf(start, `${blipKey(id)}:near:body`);
      expect(body?._tag === 'Mesh' && body.geometry).toEqual({
        _tag: 'SharedGeometry',
        id: `body:${bodyOf[category]}`,
      });
      expect(nodeOf(start, `${blipKey(id)}:ring`) !== undefined).toBe(
        bodyOf[category] === 'ringed',
      );
    }
    expect(new Set(categoryIds.map((category) => bodyOf[category])).size).toBe(4);
  });

  test('a blip changes form with distance: world, body, then dot, from the name distance out', () => {
    const blip = nodeOf(start, blipKey('foldkit'));
    expect(blip?._tag === 'Group' && blip.detail?.distances).toEqual([...detailDistances]);
    expect(detailDistances[1]).toBe(nameDistance);
    expect(blip?._tag === 'Group' && blip.children.map((child) => child.key)).toEqual([
      'blip:foldkit:near',
      'blip:foldkit:mid',
      'blip:foldkit:far',
    ]);
  });

  test('a click on any part of a blip resolves to its entry', () => {
    for (const key of ['blip:foldkit', 'blip:foldkit:near:body', 'blip:foldkit:moon:1']) {
      expect(idOfBlip(key)).toEqual(Option.some('foldkit'));
    }
    expect(Option.isNone(idOfBlip('shell:adopt'))).toBe(true);
    expect(Option.isNone(idOfBlip('edge:foldkit:elm:inspired-by'))).toBe(true);
    const pinned = step(start, Message.ClickedBlip({ key: 'blip:foldkit:near:body' }));
    expect(pinned.selected).toEqual(Option.some('foldkit'));
  });
});

describe('relationship moons', () => {
  test('one moon per relationship, in its type’s colour; none for an entry without any', () => {
    const relations = relationsOf(relationshipsOf(close), 'foldkit');
    const moons = keysUnder(close, 'blip:foldkit:moon:');
    expect(moons).toHaveLength(relations.length);
    relations.forEach((relation, index) => {
      const moon = nodeOf(close, `blip:foldkit:moon:${index}`);
      expect(moon?._tag === 'Mesh' && moon.material).toEqual({
        _tag: 'SharedMaterial',
        id: `moon:${relation.type}`,
      });
    });
    expect(keysUnder(close, 'blip:bun:moon:')).toEqual([]);
    expect(nodeOf(close, 'blip:bun:orbit')).toBeUndefined();
  });

  test('moons orbit up close, hide with the relationship edges, and are absent from afar', () => {
    const moons = nodeOf(close, 'blip:foldkit:moons');
    expect(moons?._tag === 'Group' && moons.rotation._tag).toBe('Spin');
    const off = step(close, Message.ClickedRelationships());
    expect(keysUnder(off, 'blip:foldkit:moon:')).toEqual([]);
    // From home nothing orbits, so an idle radar renders only when something changes.
    expect(keysUnder(start, 'blip:').filter((key) => key.endsWith(':moons'))).toEqual([]);
  });

  test('each blip’s orbit tilt and start are its own, and the same every time', () => {
    expect(orbitOf('foldkit')).toEqual(orbitOf('foldkit'));
    expect(orbitOf('foldkit')).not.toEqual(orbitOf('elm'));
    for (const angle of orbitOf('effect').tilt)
      expect(Math.abs(angle)).toBeLessThanOrEqual(Math.PI / 6 + 1e-12);
  });
});

describe('stage atmosphere', () => {
  test('a still starfield sits far beyond the zoom limit, with no post-processing pass', () => {
    const field = nodeOf(start, 'stars');
    expect(field?._tag === 'Points' && field.look._tag).toBe('Dots');
    expect(starField.positions.length).toBeGreaterThan(0);
    for (const position of starField.positions)
      expect(Math.hypot(...position)).toBeGreaterThan(zoomLimits.max + 10);
    expect(sceneFor(start).render.effects).toEqual([]);
  });

  test('the focused blip wears a halo up close; others do not', () => {
    expect(nodeOf(close, 'blip:foldkit:near:halo')).toBeDefined();
    expect(nodeOf(close, 'blip:elm:near:halo')).toBeUndefined();
  });
});
