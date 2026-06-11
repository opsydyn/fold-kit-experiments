import { describe, expect, it } from 'bun:test';
import { makeNoMetaView, shouldSkipMetadata } from '../../src/client-helpers';

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
  it('returns a view that replaces title with the captured initial title', () => {
    const appView = () => ({ title: 'Bar Chart — foldkit-viz', body: 'body-content' });
    const wrapped = makeNoMetaView(appView, 'Charts — My App');

    expect(wrapped({})).toEqual({ title: 'Charts — My App', body: 'body-content' });
  });

  it('preserves all other Document fields from the original view', () => {
    const appView = () => ({
      title: 'App Title',
      canonical: 'https://example.com/app',
      ogUrl: 'https://example.com/og',
      body: '<svg />',
    });
    const wrapped = makeNoMetaView(appView, 'Page Title');
    const result = wrapped({});

    expect(result.title).toBe('Page Title');
    expect(result.canonical).toBe('https://example.com/app');
    expect(result.ogUrl).toBe('https://example.com/og');
    expect(result.body).toBe('<svg />');
  });

  it('passes the model through to the original view', () => {
    const received: unknown[] = [];
    const appView = (model: unknown) => {
      received.push(model);
      return { title: 'App', body: null };
    };
    const wrapped = makeNoMetaView(appView, 'Page');
    const model = { count: 7 };
    wrapped(model);

    expect(received).toEqual([model]);
  });

  it('uses the captured title on every call, not the latest document.title', () => {
    const appView = () => ({ title: 'Scatter Chart — foldkit-viz', body: null });
    const wrapped = makeNoMetaView(appView, 'Charts — My App');

    expect(wrapped({})).toMatchObject({ title: 'Charts — My App' });
    expect(wrapped({})).toMatchObject({ title: 'Charts — My App' });
  });
});
