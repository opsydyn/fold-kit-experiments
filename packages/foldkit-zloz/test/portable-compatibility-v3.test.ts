import { expect, test } from 'bun:test';

import {
  assessPortableCompatibilityV3,
  parseModelDocumentV3,
  createGroupEditorV3,
  resolveGroupEditorBoundaryV3,
} from '../src/index';
import wire from './fixtures/model-v3.json';
test('v3 compatibility inventories every exact checkpoint and keeps unsupported adapters blocked without publishing a partial downgrade', () => {
  const model = parseModelDocumentV3(JSON.stringify(wire)),
    report = assessPortableCompatibilityV3(model);
  expect(report.version).toBe(3);
  expect(report.checkpoints).toHaveLength(model.editions.length + 1 + (model.origin ? 1 : 0));
  expect(report.downgrade.type).toBe('blocked');
  expect(Object.hasOwn(report.downgrade, 'document')).toBe(false);
  expect(report.adapters.find((a) => a.adapter === 'native-controls')?.status).toBe('supported');
  expect(report.adapters.find((a) => a.adapter === 'svg')?.status).toBe('supported');
  const editor = createGroupEditorV3(model.snapshot, { sessionId: 'boundaries-v3' });
  for (const boundary of ['model', 'editions', 'native-controls', 'layout', 'svg'] as const)
    expect(resolveGroupEditorBoundaryV3(editor, boundary)).toEqual({ type: 'unchanged', editor });
  expect(report.adapters.find((a) => a.adapter === 'layout')?.status).toBe('supported');
});
