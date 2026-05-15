import { describe, expect, it } from 'bun:test';
import { check } from '../../src/server';

describe('check', () => {
  it('accepts a valid FoldKit component', async () => {
    const component = { __foldkit: true as const, load: () => Promise.resolve({} as any) };
    expect(await check(component)).toBe(true);
  });

  it('rejects null', async () => {
    expect(await check(null)).toBe(false);
  });

  it('rejects undefined', async () => {
    expect(await check(undefined)).toBe(false);
  });

  it('rejects a plain object without __foldkit', async () => {
    expect(await check({})).toBe(false);
  });

  it('rejects an object with __foldkit: false', async () => {
    expect(await check({ __foldkit: false })).toBe(false);
  });

  it('rejects a plain function', async () => {
    expect(await check(() => {})).toBe(false);
  });

  it('rejects a string', async () => {
    expect(await check('foldkit')).toBe(false);
  });
});
