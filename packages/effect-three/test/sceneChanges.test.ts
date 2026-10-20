import { expect, test } from 'bun:test';

import {
  box,
  directionalLight,
  environment,
  formatChanges,
  group,
  hud,
  mesh,
  perspectiveCamera,
  renderTexture,
  scene,
  sceneChanges,
  standard,
} from '../src/kernel/index.ts';

const crate = (position: readonly [number, number, number] = [0, 0, 0]) =>
  mesh({ key: 'crate', position, geometry: box(), material: standard() });

const before = scene({
  children: [group({ key: 'shelf', children: [] }), crate(), directionalLight({ key: 'sun' })],
});

const linesOf = (from: typeof before, to: typeof before) => {
  const result = sceneChanges(from, to);
  return result._tag === 'Changes'
    ? formatChanges(result.changes).split('\n')
    : [result.error._tag];
};

test('the same scene has no changes', () => {
  expect(linesOf(before, before)).toEqual(['No changes.']);
});

test('nodes added, removed, changed and moved read as one line each', () => {
  const after = scene({
    camera: perspectiveCamera({ position: [1, 2, 3] }),
    environment: environment(),
    children: [
      group({ key: 'shelf', children: [crate([1, 0, 0])] }),
      mesh({ key: 'ball', geometry: box(), material: standard() }),
    ],
  });
  const lines = linesOf(before, after);
  expect(lines).toContain('⋯ scene: camera, environment');
  expect(lines).toContain('+ Mesh ball');
  expect(lines).toContain('- sun');
  expect(lines).toContain('> crate to shelf');
  expect(lines.some((line) => line.startsWith('~ crate: position'))).toBe(true);
});

test('changes in the HUD and render textures say where they are', () => {
  const withExtras = scene({
    hud: hud({ children: [crate()] }),
    renderTextures: [renderTexture({ id: 'screen', children: [crate()] })],
  });
  expect(linesOf(scene({}), withExtras)).toEqual([
    '+ hud',
    'hud + Mesh crate',
    '+ texture screen',
    'texture screen + Mesh crate',
  ]);
  const moved = scene({
    hud: hud({ children: [crate([2, 0, 0])] }),
    renderTextures: [],
  });
  expect(linesOf(withExtras, moved)).toEqual(['hud ~ crate: position', '- texture screen']);
  expect(linesOf(withExtras, scene({}))).toEqual(['- hud', '- texture screen']);
});

test('an invalid scene after is reported, not diffed', () => {
  const twice = scene({ children: [crate(), crate()] });
  expect(linesOf(before, twice)).toEqual(['DuplicateKey']);
});
