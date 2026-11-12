import { readFile, writeFile } from 'node:fs/promises';

import {
  createArchitecturePattern,
  createEditor,
  inspectSvgFontCoverage,
  writeSvgExport,
} from '../src/index';
const resource = {
  assetId: 'inter',
  format: 'truetype' as const,
  bytes: new Uint8Array(
    await readFile(new URL('../test/fixtures/font/inter-latin-400.ttf', import.meta.url)),
  ),
};
const pattern = createArchitecturePattern('c4-context');
const editor = createEditor({
  ...pattern,
  nodes: pattern.nodes.map((node, index) =>
    index === 0 ? { ...node, label: 'Orders 漢😀' } : node,
  ),
});
const before = JSON.stringify(editor);
const options = {
  title: 'Coverage review',
  region: { type: 'model' as const, padding: 24 },
  theme: { colorScheme: 'light' as const },
  background: { type: 'theme' as const },
  font: { family: 'Inter', size: 14, weight: 400, assetId: 'inter' },
  assets: [{ id: 'inter', kind: 'font' as const, availability: 'embedded' as const }],
  renderers: { nodes: 'built-in' as const, edges: 'built-in' as const },
};
const coverage = inspectSvgFontCoverage(resource, 'Orders 漢😀');
const blocked = writeSvgExport(editor, options, { fontResources: [resource] });
const accepted = writeSvgExport(editor, options, { fontResources: [resource], allowLosses: true });
if (
  coverage.type !== 'checked' ||
  blocked.type !== 'blocked' ||
  accepted.type !== 'written' ||
  before !== JSON.stringify(editor)
)
  throw new Error('Coverage qualification failed');
await writeFile(
  new URL('svg-font-coverage.json', import.meta.url),
  JSON.stringify(
    {
      coverage,
      beforeAcceptance: { type: blocked.type, findings: blocked.findings },
      afterAcceptance: { type: accepted.type, findings: accepted.findings },
      editorUnchanged: before === JSON.stringify(editor),
    },
    null,
    2,
  ) + '\n',
);
