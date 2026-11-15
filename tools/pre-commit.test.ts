import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stagedStrictChecks } from './pre-commit';

const scriptsFor = (name: string) => {
  const manifest: { scripts?: Readonly<Record<string, string>> } = JSON.parse(
    readFileSync(join(import.meta.dir, '..', 'packages', name, 'package.json'), 'utf8'),
  );
  return manifest.scripts ?? {};
};
test('sample changes keep staged lint without invoking a nonexistent strict check', () => {
  expect(
    stagedStrictChecks(['packages/effect-three-samples/src/room/main.ts'], scriptsFor),
  ).toEqual([]);
});
test('strict package checks deduplicate and retain every real check script', () => {
  expect(
    stagedStrictChecks(
      [
        'packages/effect-three/src/index.ts',
        'packages/effect-three/src/math.ts',
        'packages/effect-three-foldkit/src/index.ts',
        'packages/effect-three-rapier/src/index.ts',
        'packages/effect-three-troika/src/index.ts',
        'packages/effect-three-samples/src/index.ts',
        'packages/foldkit-zloz/src/index.ts',
      ],
      scriptsFor,
    ),
  ).toEqual(['effect-three', 'effect-three-foldkit', 'effect-three-rapier', 'effect-three-troika']);
});
