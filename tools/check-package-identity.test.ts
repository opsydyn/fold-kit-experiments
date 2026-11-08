import { expect, test } from 'bun:test';

import releases from '../release-please-config.json';
import { assertPackageIdentity } from './check-package-identity';

test('publication rejects obsolete Flow names and mismatched artifacts', () => {
  for (const suffix of ['', '-elk', '-force', '-mermaid']) {
    expect(() =>
      assertPackageIdentity(`foldkit-flow${suffix}`, { name: `@opsydyn/foldkit-flow${suffix}` }),
    ).toThrow();
    expect(() =>
      assertPackageIdentity(`foldkit-zloz${suffix}`, { name: `@opsydyn/foldkit-flow${suffix}` }),
    ).toThrow();
    expect(() =>
      assertPackageIdentity(`foldkit-zloz${suffix}`, { name: `@opsydyn/foldkit-zloz${suffix}` }),
    ).not.toThrow();
  }
  expect(() =>
    assertPackageIdentity('../foldkit-zloz', { name: '@opsydyn/foldkit-zloz' }),
  ).toThrow();
  expect(() =>
    assertPackageIdentity('foldkit-viz', { name: '@opsydyn/foldkit-viz' }),
  ).not.toThrow();
});

test('release automation contains only the four Zloz graph package identities', () => {
  const names = Object.values(releases.packages).map((entry) => entry['package-name']);
  expect(names.filter((name) => name.startsWith('@opsydyn/foldkit-flow'))).toEqual([]);
  expect(names.filter((name) => name.startsWith('@opsydyn/foldkit-zloz')).sort()).toEqual([
    '@opsydyn/foldkit-zloz',
    '@opsydyn/foldkit-zloz-elk',
    '@opsydyn/foldkit-zloz-force',
    '@opsydyn/foldkit-zloz-mermaid',
  ]);
});
