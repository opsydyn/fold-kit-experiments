import { expect, test } from 'bun:test';

import { scene } from '@opsydyn/effect-three';

import { interceptProperty } from '../src/dom/property.ts';
import { markTyped, typedScene } from '../src/dom/typedScenes.ts';

test('property interception sees the initial value, every set, and restores a data property', () => {
  const element: Record<string, unknown> = { scene: 'first' };
  const seen: Array<unknown> = [];
  const intercepted = interceptProperty(element, 'scene', (value) => seen.push(value));
  expect(intercepted.initial).toBe('first');
  element['scene'] = 'second';
  element['scene'] = 'third';
  expect(seen).toEqual(['second', 'third']);
  expect(element['scene']).toBe('third');
  intercepted.restore();
  element['scene'] = 'fourth';
  expect(seen).toEqual(['second', 'third']);
  expect(Object.getOwnPropertyDescriptor(element, 'scene')).toMatchObject({ value: 'fourth' });
});

test('only scenes marked by the typed view skip decoding', () => {
  const marked = markTyped(scene({}));
  expect(typedScene(marked)).toBe(marked);
  expect(typedScene(scene({}))).toBeUndefined();
  expect(typedScene('not a scene')).toBeUndefined();
  expect(typedScene(null)).toBeUndefined();
});
