import { describe, expect, it } from 'bun:test';

import fc from 'fast-check';

import { defineApp } from '../../src/define-app';
import { check } from '../../src/server';
import type { AppConfig } from '../../src/types';

const anyLoader = fc.func(fc.anything()).map((fn) => () => Promise.resolve(fn() as AppConfig));

describe('defineApp — properties', () => {
  it('always sets __foldkit: true regardless of loader', () => {
    fc.assert(
      fc.property(anyLoader, (loader) => {
        expect(defineApp(loader).__foldkit).toBe(true);
      }),
    );
  });

  it('preserves loader reference exactly as load', () => {
    fc.assert(
      fc.property(anyLoader, (loader) => {
        expect(defineApp(loader).load).toBe(loader);
      }),
    );
  });

  it('is always callable without throwing', () => {
    fc.assert(
      fc.property(anyLoader, (loader) => {
        expect(() => defineApp(loader)()).not.toThrow();
      }),
    );
  });

  it('two calls with the same loader produce independent instances', () => {
    fc.assert(
      fc.property(anyLoader, (loader) => {
        expect(defineApp(loader)).not.toBe(defineApp(loader));
      }),
    );
  });
});

describe('check × defineApp — consistency', () => {
  it('check always accepts the result of defineApp', async () => {
    await fc.assert(
      fc.asyncProperty(anyLoader, async (loader) => {
        expect(await check(defineApp(loader))).toBe(true);
      }),
    );
  });
});
