import { describe, expect, test } from 'bun:test';

import { createSceneGraph, type SceneNode, type Vec3 } from '@opsydyn/effect-three';
import { Option } from 'effect';

import { Message } from '../src/radar/message';
import {
  blipKey,
  type Model,
  positionOf,
  relationshipsOf,
  visibleOf,
  visibleRelationships,
} from '../src/radar/model';
import { relationsOf } from '../src/radar/relations';
import { sceneFor } from '../src/radar/scene';
import {
  blipPosition,
  categoryLabelDistance,
  detailAt,
  detailFor,
  edgeArc,
  fullDistance,
  nameDistance,
  zoomLimits,
} from '../src/radar/space';
import { init, update } from '../src/radar/update';

const start = init().model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const steps = (model: Model, messages: ReadonlyArray<Message>): Model =>
  messages.reduce(step, model);
const radius = (point: Vec3): number => Math.hypot(...point);

const nodeOf = (model: Model, key: string): SceneNode | undefined =>
  sceneFor(model).children.find((node) => node.key === key);
const keysOf = (model: Model, prefix: string): ReadonlyArray<string> =>
  sceneFor(model)
    .children.map((node) => node.key)
    .filter((key) => key.startsWith(prefix));
const at = (model: Model, id: string): Vec3 =>
  Option.match(positionOf(model, id), { onNone: () => [0, 0, 0], onSome: blipPosition });

const foldkitToElm = 'edge:foldkit:elm:inspired-by';

describe('relationship arcs', () => {
  test('every edge runs blip to blip and bows outward, never inside its nearer shell', () => {
    for (const { from, to } of relationshipsOf(start)) {
      const [a, b] = [at(start, from), at(start, to)];
      const arc = edgeArc(a, b);
      arc[0]?.forEach((value, axis) => expect(value).toBeCloseTo(a[axis] ?? Number.NaN, 12));
      arc.at(-1)?.forEach((value, axis) => expect(value).toBeCloseTo(b[axis] ?? Number.NaN, 12));
      const floor = Math.min(radius(a), radius(b));
      for (const point of arc) expect(radius(point)).toBeGreaterThanOrEqual(floor - 1e-9);
      const middle = (radius(a) + radius(b)) / 2 + 0.1 * Math.max(radius(a), radius(b));
      expect(radius(arc[12] ?? [0, 0, 0])).toBeCloseTo(middle, 9);
    }
  });

  test('blips on opposite sides arc over the top rather than through the centre', () => {
    const arc = edgeArc([0, 0, 3], [0, 0, -3]);
    expect(arc[12]?.[1]).toBeCloseTo(3.3, 9);
    expect(arc[12]?.[2]).toBeCloseTo(0, 9);
    for (const point of arc) expect(radius(point)).toBeGreaterThanOrEqual(3 - 1e-9);
  });
});

describe('relationship visibility and focus', () => {
  test('edges show only while both ends do, and the toggle hides them all', () => {
    expect(visibleRelationships(start)).toHaveLength(16);
    const tools = step(start, Message.ChangedCategory({ category: 'tools' }));
    const shown = visibleRelationships(tools);
    expect(shown).toHaveLength(4);
    const ids = new Set(visibleOf(tools).map(({ entry }) => entry.id));
    for (const { from, to } of shown) expect(ids.has(from) && ids.has(to)).toBe(true);
    const off = step(start, Message.ClickedRelationships());
    expect(off.showRelationships).toBe(false);
    expect(keysOf(off, 'edge:')).toEqual([]);
    expect(step(off, Message.ClickedRelationships()).showRelationships).toBe(true);
  });

  test('pinning an entry brightens and labels its edges; the rest stay dimmed', () => {
    const dimmed = nodeOf(start, foldkitToElm);
    expect(dimmed?._tag === 'Line' && [dimmed.width, dimmed.opacity]).toEqual([1.5, 0.45]);
    expect(nodeOf(start, `${foldkitToElm}:label`)).toBeUndefined();
    const pinned = step(start, Message.ClickedBlip({ key: blipKey('foldkit') }));
    const lit = nodeOf(pinned, foldkitToElm);
    expect(lit?._tag === 'Line' && [lit.width, lit.opacity]).toEqual([3, 1]);
    const caption = nodeOf(pinned, `${foldkitToElm}:label`);
    expect(caption?._tag === 'Label' && caption.text).toBe('Inspired by');
    const other = nodeOf(pinned, 'edge:sqlite:duckdb:complements');
    expect(other?._tag === 'Line' && other.width).toBe(1.5);
  });

  test('each type keeps its own line style', () => {
    const style = (key: string) => {
      const node = nodeOf(start, key);
      return node?._tag === 'Line' ? [node.dashed, node.dashSize] : undefined;
    };
    expect(style('edge:foldkit:effect:builds-on')?.[0]).toBe(false);
    expect(style(foldkitToElm)).toEqual([true, 0.14]);
    expect(style('edge:claude-code:codex:alternative-to')).toEqual([true, 0.03]);
  });
});

describe('relationships read from either end', () => {
  test('one-way types read differently from each end; peer types read the same', () => {
    const relationships = relationshipsOf(start);
    expect(relationsOf(relationships, 'foldkit')).toContainEqual(
      expect.objectContaining({ other: 'elm', label: 'Inspired by' }),
    );
    expect(relationsOf(relationships, 'elm')).toEqual([
      expect.objectContaining({ other: 'foldkit', label: 'Inspired' }),
    ]);
    expect(relationsOf(relationships, 'codex')).toEqual([
      expect.objectContaining({ other: 'claude-code', label: 'Alternative to' }),
      expect.objectContaining({ other: 'pi', label: 'Alternative to' }),
    ]);
    expect(relationsOf(relationships, 'bun')).toEqual([]);
  });

  test('choosing a relationship pins the entry at its other end', () => {
    const pinned = steps(start, [
      Message.ClickedBlip({ key: blipKey('foldkit') }),
      Message.ClickedEntry({ id: 'elm' }),
    ]);
    expect(pinned.selected).toEqual(Option.some('elm'));
  });
});

describe('zoom reveals detail', () => {
  test('detail steps up as the camera nears a blip', () => {
    expect(detailAt(nameDistance + 0.01)).toBe('blip');
    expect(detailAt(nameDistance)).toBe('name');
    expect(detailAt(fullDistance + 0.01)).toBe('name');
    expect(detailAt(fullDistance)).toBe('full');
  });

  test('from home no names show; zooming in reveals names, then ring, category and description', () => {
    expect(keysOf(start, 'label:name:')).toEqual([]);
    expect(keysOf(start, 'label:category:')).toHaveLength(4);
    const closer = steps(start, [
      Message.ClickedZoom({ direction: 'in' }),
      Message.ClickedZoom({ direction: 'in' }),
      Message.ClickedZoom({ direction: 'in' }),
    ]);
    const names = keysOf(closer, 'label:name:');
    const metas = keysOf(closer, 'label:meta:');
    expect(names.length).toBeGreaterThan(0);
    expect(metas.length).toBeGreaterThan(0);
    for (const { entry } of visibleOf(closer)) {
      const detail = detailFor(closer.camera.position, at(closer, entry.id));
      expect(names.includes(`label:name:${entry.id}`)).toBe(detail !== 'blip');
      expect(metas.includes(`label:meta:${entry.id}`)).toBe(detail === 'full');
    }
    // Only the camera's side is labelled, and the category names step aside up close.
    expect(names.length).toBeLessThanOrEqual(visibleOf(closer).length / 2);
    expect(Math.hypot(...closer.camera.position)).toBeLessThan(categoryLabelDistance);
    expect(keysOf(closer, 'label:category:')).toEqual([]);
    const meta = nodeOf(closer, metas[0] ?? '');
    expect(meta?._tag === 'Label' && meta.text).toContain(' · ');
  });

  test('a blip behind the centre shows no detail, however close the camera', () => {
    expect(detailFor([0, 0, 5], [0, 0, 1])).toBe('full');
    expect(detailFor([0, 0, 5], [0, 0, -1])).toBe('blip');
  });

  test('the zoom buttons stay within the orbit’s limits', () => {
    const distance = (model: Model) => Math.hypot(...model.camera.position);
    const nearest = steps(
      start,
      Array.from({ length: 12 }, () => Message.ClickedZoom({ direction: 'in' })),
    );
    expect(distance(nearest)).toBeCloseTo(zoomLimits.min, 9);
    const furthest = steps(
      start,
      Array.from({ length: 12 }, () => Message.ClickedZoom({ direction: 'out' })),
    );
    expect(distance(furthest)).toBeCloseTo(zoomLimits.max, 9);
  });

  test('zoomed in with a pin, the scene still reconciles in a real graph', () => {
    const graph = createSceneGraph();
    const busy = steps(start, [
      Message.ClickedBlip({ key: blipKey('foldkit') }),
      Message.ClickedZoom({ direction: 'in' }),
      Message.ClickedZoom({ direction: 'in' }),
    ]);
    expect(graph.reconcile(sceneFor(start))._tag).toBe('Applied');
    expect(graph.reconcile(sceneFor(busy))._tag).toBe('Applied');
    graph.dispose();
  });
});
