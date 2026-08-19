import { describe, expect, it } from 'bun:test';

import type { Document, HtmlBuilder } from 'foldkit/html';

import {
  findSingleFoldkitRoot,
  makeNoMetaView,
  shouldSkipMetadata,
} from '../../src/client-helpers';

const h = {} as unknown as HtmlBuilder<unknown>;

type TestChild = {
  readonly attributes: Readonly<Record<string, string>>;
};

const makeFoldkitRoot = (
  attributes: Readonly<Record<string, string>> = { 'data-foldkit-build': 'client-test-build' },
): TestChild => ({
  attributes: {
    'data-foldkit-app': 'app',
    ...attributes,
  },
});

const matchesSelector = (child: TestChild, selector: string): boolean =>
  selector === '[data-foldkit-app]' && child.attributes['data-foldkit-app'] !== undefined;

const makeRootContainer = (children: readonly TestChild[]) => ({
  querySelectorAll: (selector: string) =>
    children.filter((child) => matchesSelector(child, selector)),
});

describe('findSingleFoldkitRoot', () => {
  it('returns the one stamped FoldKit root inside the owner island', () => {
    const root = makeFoldkitRoot();

    expect(findSingleFoldkitRoot(makeRootContainer([root]))).toBe(root);
  });

  it('allows Runtime.hydrate to handle absent or mismatched build stamps', () => {
    const rootWithoutBuild = makeFoldkitRoot({});
    const rootWithOtherBuild = makeFoldkitRoot({ 'data-foldkit-build': 'other-build' });

    expect(findSingleFoldkitRoot(makeRootContainer([rootWithoutBuild]))).toBe(rootWithoutBuild);
    expect(findSingleFoldkitRoot(makeRootContainer([rootWithOtherBuild]))).toBe(rootWithOtherBuild);
  });

  it('rejects absent or duplicated stamped FoldKit roots', () => {
    for (const children of [[], [makeFoldkitRoot(), makeFoldkitRoot()]]) {
      expect(() => findSingleFoldkitRoot(makeRootContainer(children))).toThrow(
        'exactly one stamped FoldKit root',
      );
    }
  });
});

describe('shouldSkipMetadata', () => {
  it('returns true for noMeta: true (JSX boolean prop)', () => {
    expect(shouldSkipMetadata({ noMeta: true })).toBe(true);
  });

  it('returns true for noMeta: "" (HTML boolean attribute shorthand)', () => {
    expect(shouldSkipMetadata({ noMeta: '' })).toBe(true);
  });

  it('returns false when noMeta is absent', () => {
    expect(shouldSkipMetadata({})).toBe(false);
  });

  it('returns false for noMeta: false', () => {
    expect(shouldSkipMetadata({ noMeta: false })).toBe(false);
  });

  it('returns false for unrelated props', () => {
    expect(shouldSkipMetadata({ title: 'hello', seed: 42 })).toBe(false);
  });
});

describe('makeNoMetaView', () => {
  it('forwards the render-frame builder and preserves document attributes', () => {
    const model = { count: 7 };
    const h = { frame: 'test-builder' } as unknown as HtmlBuilder<never>;
    const received: unknown[] = [];
    const appView = (nextModel: typeof model, nextH: HtmlBuilder<never>): Document => {
      received.push(nextModel, nextH);
      return {
        title: 'App title',
        lang: 'ar',
        dir: 'Rtl',
        body: null,
      };
    };
    const wrapped = makeNoMetaView(appView, 'Astro page title');

    expect(wrapped(model, h)).toEqual({
      title: 'Astro page title',
      lang: 'ar',
      dir: 'Rtl',
      body: null,
    });
    expect(received).toEqual([model, h]);
  });

  it('returns a view that replaces title with the captured initial title', () => {
    const appView = () => ({ title: 'Bar Chart — foldkit-viz', body: null });
    const wrapped = makeNoMetaView(appView, 'Charts — My App');

    expect(wrapped({}, h)).toEqual({ title: 'Charts — My App', body: null });
  });

  it('preserves all other Document fields from the original view', () => {
    const appView = () => ({
      title: 'App Title',
      canonical: 'https://example.com/app',
      ogUrl: 'https://example.com/og',
      body: null,
    });
    const wrapped = makeNoMetaView(appView, 'Page Title');
    const result = wrapped({}, h);

    expect(result.title).toBe('Page Title');
    expect(result.canonical).toBe('https://example.com/app');
    expect(result.ogUrl).toBe('https://example.com/og');
    expect(result.body).toBeNull();
  });

  it('passes the model through to the original view', () => {
    const received: unknown[] = [];
    const appView = (model: unknown) => {
      received.push(model);
      return { title: 'App', body: null };
    };
    const wrapped = makeNoMetaView(appView, 'Page');
    const model = { count: 7 };
    wrapped(model, h);

    expect(received).toEqual([model]);
  });

  it('uses the captured title on every call, not the latest document.title', () => {
    const appView = () => ({ title: 'Scatter Chart — foldkit-viz', body: null });
    const wrapped = makeNoMetaView(appView, 'Charts — My App');

    expect(wrapped({}, h)).toMatchObject({ title: 'Charts — My App' });
    expect(wrapped({}, h)).toMatchObject({ title: 'Charts — My App' });
  });
});
