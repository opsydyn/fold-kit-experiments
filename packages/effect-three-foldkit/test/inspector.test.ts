import { expect, test } from 'bun:test';

import type { InspectedField } from '@opsydyn/effect-three';
import { inertHtml } from 'foldkit/html';

import { inspectorView } from '../src/index.ts';

type Node = {
  readonly sel?: string;
  readonly text?: string;
  readonly data?: {
    readonly props?: Readonly<Record<string, unknown>>;
    readonly attrs?: Readonly<Record<string, unknown>>;
  };
  readonly children?: ReadonlyArray<Node>;
};

const fields: ReadonlyArray<InspectedField> = [
  { _tag: 'Fixed', path: ['_tag'], label: '_tag', text: 'Mesh' },
  { _tag: 'Number', path: ['geometry', 'width'], label: 'width', value: 2 },
  { _tag: 'Text', path: ['key'], label: 'key', value: 'crate' },
  { _tag: 'Toggle', path: ['castShadow'], label: 'castShadow', value: true },
  { _tag: 'Choice', path: ['side'], label: 'side', value: 'back', options: ['front', 'back'] },
  { _tag: 'Colour', path: ['color'], label: 'color', value: 0xff8800 },
  { _tag: 'Vector', path: ['position'], label: 'position', value: [1, 2, 3] },
];

const rows = (): ReadonlyArray<Node> =>
  (inspectorView(inertHtml, fields, () => undefined as never) as Node).children ?? [];

/** A row's control: the element after its name. */
const controlOf = (row: Node | undefined): Node | undefined => row?.children?.[1];

test('each field is a row: its name, then a control for its kind', () => {
  const [kind, width, key, shadow, side, colour, position] = rows();
  expect(kind?.children?.[0]?.children?.[0]?.text).toBe('_tag');
  expect(controlOf(kind)?.children?.[0]?.text).toBe('Mesh');
  expect(width?.children?.[0]?.children?.[0]?.text).toBe('geometry width');
  expect(controlOf(width)?.data?.props).toMatchObject({ type: 'number', value: '2' });
  expect(controlOf(key)?.data?.props).toMatchObject({ type: 'text', value: 'crate' });
  expect(controlOf(shadow)?.data?.props).toMatchObject({ type: 'checkbox', checked: true });
  const options = controlOf(side)?.children ?? [];
  expect(options.map((option) => option.data?.props?.['selected'])).toEqual([false, true]);
  expect(controlOf(colour)?.data?.props).toMatchObject({ type: 'color', value: '#ff8800' });
  const axes = controlOf(position)?.children ?? [];
  expect(axes.map((axis) => axis.data?.props?.['value'])).toEqual(['1', '2', '3']);
  expect(axes.map((axis) => axis.data?.attrs?.['aria-label'])).toEqual([
    'position x',
    'position y',
    'position z',
  ]);
});
