/**
 * The environment's asset registry (ADR-015), with a loader whose loads a test settles by
 * hand: each asset loads once however many scenes ask, a load no scene asks for any more
 * is cancelled, and the last scene to let go frees it.
 */
import { expect, test } from 'bun:test';

import { type Asset, modelAsset, textureAsset } from '@opsydyn/effect-three';

import { type AssetNotice, type Lent, makeAssetRegistry } from '../src/assetRegistry.ts';

type Load = {
  readonly asset: Asset;
  readonly signal: AbortSignal;
  readonly resolve: (lent: Lent) => void;
  readonly reject: (cause: unknown) => void;
};

/** A registry over a loader that waits to be settled, and what it was asked and freed. */
const setup = () => {
  const loads: Array<Load> = [];
  const freed: Array<string> = [];
  const registry = makeAssetRegistry(
    (asset, signal) =>
      new Promise<Lent>((resolve, reject) => loads.push({ asset, signal, resolve, reject })),
  );
  const lent = (asset: Asset): Lent => ({
    parts: asset.kind === 'model' ? ['arm'] : [],
    clips: [],
    release: () => freed.push(asset.url),
  });
  /** A scene: what it hears, and a way to ask. */
  const scene = () => {
    const heard: Array<AssetNotice> = [];
    const self = {};
    return {
      heard,
      ask: (assets: ReadonlyArray<Asset>) =>
        registry.want(self, assets, (notice) => heard.push(notice)),
      leave: () => registry.release(self),
    };
  };
  return { registry, loads, freed, lent, scene };
};

/** Lets settled loads tell their scenes (their callbacks run as microtasks). */
const settle = () => new Promise((done) => setTimeout(done, 0));

const robot = modelAsset({ id: 'robot', url: 'robot.glb' });
const floor = textureAsset({ id: 'floor', url: 'tiles.png' });

test('an asset two scenes ask for loads once, and each hears that it loaded', async () => {
  const { loads, lent, scene } = setup();
  const a = scene();
  const b = scene();
  a.ask([robot]);
  b.ask([robot, floor]);
  expect(loads.map((load) => load.asset.id)).toEqual(['robot', 'floor']);
  loads[0]?.resolve(lent(robot));
  await settle();
  expect(a.heard).toEqual([{ _tag: 'Loaded', ...robot, parts: ['arm'], clips: [] }]);
  expect(b.heard).toEqual(a.heard);
  // A third, asking after it loaded, hears at once; nothing loads again.
  const c = scene();
  c.ask([robot]);
  expect(c.heard).toEqual(a.heard);
  expect(loads).toHaveLength(2);
});

test('asking again for the same list changes nothing', () => {
  const { loads, scene } = setup();
  const a = scene();
  a.ask([robot, floor]);
  a.ask([{ ...robot }, { ...floor }]);
  expect(loads).toHaveLength(2);
  expect(loads.every((load) => !load.signal.aborted)).toBe(true);
});

test('a load no scene asks for any more is cancelled, and what it brings back is freed', async () => {
  const { loads, freed, lent, scene } = setup();
  const a = scene();
  const b = scene();
  a.ask([robot]);
  b.ask([robot]);
  a.ask([]);
  expect(loads[0]?.signal.aborted).toBe(false);
  b.leave();
  expect(loads[0]?.signal.aborted).toBe(true);
  // A loader that finishes anyway: its asset is freed, and no one hears of it.
  loads[0]?.resolve(lent(robot));
  await settle();
  expect(freed).toEqual(['robot.glb']);
  expect([...a.heard, ...b.heard]).toEqual([]);
});

test('the last scene to let go of a loaded asset frees it, once', async () => {
  const { loads, freed, lent, scene } = setup();
  const a = scene();
  const b = scene();
  a.ask([robot]);
  b.ask([robot]);
  loads[0]?.resolve(lent(robot));
  await settle();
  a.leave();
  expect(freed).toEqual([]);
  b.ask([floor]);
  expect(freed).toEqual(['robot.glb']);
  // Asked for again, it loads again.
  a.ask([robot]);
  expect(loads.filter((load) => load.asset.id === 'robot')).toHaveLength(2);
});

test('a failure is heard by every scene asking, and asking afresh tries again', async () => {
  const { loads, scene } = setup();
  const a = scene();
  const b = scene();
  a.ask([robot]);
  loads[0]?.reject(new Error('404'));
  await settle();
  expect(a.heard).toEqual([{ _tag: 'Failed', ...robot, reason: 'Could not load robot.glb: 404' }]);
  // Still failed while asked for: a newcomer hears so at once, and nothing reloads.
  b.ask([robot]);
  expect(b.heard).toEqual(a.heard);
  expect(loads).toHaveLength(1);
  a.leave();
  b.leave();
  a.ask([robot]);
  expect(loads).toHaveLength(2);
});

test('a scene asking for an id held as something else waits for it, failed meanwhile', async () => {
  const { loads, freed, lent, scene } = setup();
  const a = scene();
  const b = scene();
  a.ask([robot]);
  const other = modelAsset({ id: 'robot', url: 'other.glb' });
  b.ask([other]);
  expect(b.heard).toEqual([
    { _tag: 'Failed', ...other, reason: '"robot" is already robot.glb for another scene' },
  ]);
  expect(loads).toHaveLength(1);
  // a lets go: its load is cancelled, and b's starts.
  a.leave();
  expect(loads[0]?.signal.aborted).toBe(true);
  expect(loads[1]?.asset.url).toBe('other.glb');
  loads[1]?.resolve(lent(other));
  await settle();
  expect(b.heard.at(-1)).toMatchObject({ _tag: 'Loaded', url: 'other.glb' });
  expect(freed).toEqual([]);
});

test('a scene changing what an id is lets the old one go and loads the new', async () => {
  const { loads, freed, lent, scene } = setup();
  const a = scene();
  a.ask([robot]);
  loads[0]?.resolve(lent(robot));
  await settle();
  a.ask([modelAsset({ id: 'robot', url: 'robot-2.glb' })]);
  expect(freed).toEqual(['robot.glb']);
  expect(loads[1]?.asset.url).toBe('robot-2.glb');
});

test('disposing the registry cancels what is loading and frees what is loaded', async () => {
  const { registry, loads, freed, lent, scene } = setup();
  const a = scene();
  a.ask([robot, floor]);
  loads[0]?.resolve(lent(robot));
  await settle();
  registry.dispose();
  expect(freed).toEqual(['robot.glb']);
  expect(loads[1]?.signal.aborted).toBe(true);
});
