import { describe, expect, it } from 'bun:test';

import {
  appendStep,
  currentRoot,
  positionOf,
  replay,
  resolvePosition,
} from '../../src/directive-interaction';
import type { Position, Step, TreeNode } from '../../src/directive-interaction';

type FakeNode = TreeNode & {
  parentElement: FakeNode | null;
  readonly children: Array<FakeNode>;
  value: string;
  disabled: boolean;
  readonly log: Array<string>;
  readonly dispatchEvent: (event: Event) => boolean;
  readonly addEventListener: () => void;
  readonly removeEventListener: () => void;
  readonly focus: () => void;
  readonly setSelectionRange: (start: number, end: number) => void;
  readonly click: () => void;
};

type Spec = Readonly<{
  tag: string;
  value?: string;
  disabled?: boolean;
  children?: ReadonlyArray<Spec>;
}>;

const build = (spec: Spec, log: Array<string> = []): FakeNode => {
  const node: FakeNode = {
    tagName: spec.tag.toUpperCase(),
    parentElement: null,
    children: [],
    value: spec.value ?? '',
    disabled: spec.disabled ?? false,
    log,
    dispatchEvent: (event) => {
      log.push(`${event.type}:${spec.tag}=${node.value}`);
      return true;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    focus: () => log.push(`focus:${spec.tag}`),
    setSelectionRange: (start, end) => log.push(`select:${start}-${end}`),
    click: () => log.push(`click:${spec.tag}`),
  };
  for (const child of spec.children ?? []) {
    const built = build(child, log);
    built.parentElement = node;
    node.children.push(built);
  }
  return node;
};

const island = (log: Array<string> = []): FakeNode =>
  build(
    {
      tag: 'astro-island',
      children: [
        {
          tag: 'div',
          children: [{ tag: 'input' }, { tag: 'button' }, { tag: 'select' }],
        },
      ],
    },
    log,
  );

const at = (root: FakeNode, ...path: ReadonlyArray<number>): FakeNode =>
  path.reduce<FakeNode>((node, index) => {
    const child = node.children[index];
    if (child === undefined) throw new Error(`No child at ${index}`);
    return child;
  }, root);

const positionAt = (root: FakeNode, ...path: ReadonlyArray<number>): Position => {
  const position = positionOf(root, at(root, ...path));
  if (position === undefined) throw new Error('Expected the element under the root');
  return position;
};

describe('client:interaction positions', () => {
  it('locates an element by its child index at each level and finds it again in a fresh tree', () => {
    const old = island();
    const position = positionAt(old, 0, 1);
    expect(position).toEqual({ path: [0, 1], tagName: 'BUTTON' });

    const fresh = island();
    expect(resolvePosition(fresh, position)).toBe(at(fresh, 0, 1));
  });

  it('gives no position for an element outside the root', () => {
    const outside = build({ tag: 'button' });
    expect(positionOf(island(), outside)).toBeUndefined();
  });

  it('refuses a match when the fresh tree has a different element in that place', () => {
    const fresh = build({
      tag: 'astro-island',
      children: [{ tag: 'div', children: [{ tag: 'span' }] }],
    });
    expect(resolvePosition(fresh, { path: [0, 0], tagName: 'INPUT' })).toBeUndefined();
    expect(resolvePosition(fresh, { path: [0, 3], tagName: 'BUTTON' })).toBeUndefined();
  });
});

describe('client:interaction steps', () => {
  it('folds a run of edits to one field into its latest value', () => {
    const old = island();
    const field = positionAt(old, 0, 0);
    let steps: ReadonlyArray<Step> = [];
    for (const value of ['p', 'pa', 'par'])
      steps = appendStep(steps, { kind: 'value', position: field, value });

    expect(steps).toEqual([{ kind: 'value', position: field, value: 'par' }]);
  });

  it('keeps edits apart when something happened between them', () => {
    const old = island();
    const field = positionAt(old, 0, 0);
    const button = positionAt(old, 0, 1);
    let steps: ReadonlyArray<Step> = [];
    steps = appendStep(steps, { kind: 'value', position: field, value: 'one' });
    steps = appendStep(steps, { kind: 'click', position: button });
    steps = appendStep(steps, { kind: 'click', position: button });
    steps = appendStep(steps, { kind: 'value', position: field, value: 'two' });

    expect(steps.map((step) => step.kind)).toEqual(['value', 'click', 'click', 'value']);
  });
});

describe('client:interaction replay', () => {
  it('carries typed text into the fresh field and tells the application with input and change events', () => {
    const old = island();
    const log: Array<string> = [];
    const fresh = island(log);

    replay(fresh, {
      steps: [{ kind: 'value', position: positionAt(old, 0, 0), value: 'parser' }],
      focus: undefined,
    });

    expect(at(fresh, 0, 0).value).toBe('parser');
    expect(log).toEqual(['input:input=parser', 'change:input=parser']);
  });

  it('replays steps in the order the reader took them, then restores focus and selection', () => {
    const old = island();
    const log: Array<string> = [];
    const fresh = island(log);
    const field = positionAt(old, 0, 0);
    const button = positionAt(old, 0, 1);

    replay(fresh, {
      steps: [
        { kind: 'value', position: field, value: 'ab' },
        { kind: 'click', position: button },
        { kind: 'value', position: field, value: 'abc' },
        { kind: 'click', position: button },
      ],
      focus: { position: field, selection: [3, 3] },
    });

    expect(log).toEqual([
      'input:input=ab',
      'change:input=ab',
      'click:button',
      'input:input=abc',
      'change:input=abc',
      'click:button',
      'focus:input',
      'select:3-3',
    ]);
  });

  it('gives nothing to a control the application has not enabled yet', () => {
    const old = island();
    const log: Array<string> = [];
    const fresh = island(log);
    at(fresh, 0, 0).disabled = true;
    at(fresh, 0, 1).disabled = true;

    replay(fresh, {
      steps: [
        { kind: 'value', position: positionAt(old, 0, 0), value: 'lost' },
        { kind: 'click', position: positionAt(old, 0, 1) },
      ],
      focus: { position: positionAt(old, 0, 0) },
    });

    expect(log).toEqual([]);
    expect(at(fresh, 0, 0).value).toBe('');
  });

  it('skips a step whose element is no longer there', () => {
    const old = island();
    const log: Array<string> = [];
    const fresh = build(
      { tag: 'astro-island', children: [{ tag: 'div', children: [{ tag: 'input' }] }] },
      log,
    );

    replay(fresh, {
      steps: [{ kind: 'click', position: positionAt(old, 0, 1) }],
      focus: undefined,
    });

    expect(log).toEqual([]);
  });

  it('sends no event for a field whose value the application already rendered', () => {
    const old = island();
    const log: Array<string> = [];
    const fresh = island(log);
    at(fresh, 0, 0).value = 'same';

    replay(fresh, {
      steps: [{ kind: 'value', position: positionAt(old, 0, 0), value: 'same' }],
      focus: undefined,
    });

    expect(log).toEqual([]);
  });
});

describe('client:interaction root', () => {
  it('finds the application root that FoldKit rendered in place of the mount', () => {
    const island = build({
      tag: 'astro-island',
      children: [{ tag: 'div', children: [{ tag: 'main' }] }],
    });
    const mount = at(island, 0);
    const fresh = build({ tag: 'main' });
    island.children[0] = fresh;

    expect(currentRoot({ parent: island, index: 0, mount })).toBe(fresh);
  });

  it('finds the root inside the mount if the mount was kept', () => {
    const island = build({
      tag: 'astro-island',
      children: [{ tag: 'div', children: [{ tag: 'main' }] }],
    });
    const mount = at(island, 0);
    const fresh = build({ tag: 'main' });
    mount.children[0] = fresh;

    expect(currentRoot({ parent: island, index: 0, mount })).toBe(fresh);
  });
});
