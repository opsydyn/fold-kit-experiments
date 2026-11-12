import { readFile, writeFile } from 'node:fs/promises';

import { createArchitecturePattern, createEditor, writeSvgExport } from '../src/index';
const bytes = new Uint8Array(
  await readFile(new URL('../test/fixtures/font/inter-latin-400.ttf', import.meta.url)),
);
const pattern = createArchitecturePattern('c4-context');
const spaced = {
  ...pattern,
  nodes: pattern.nodes.map((node, index) =>
    index === 1 ? { ...node, position: { ...node.position, x: 600 } } : node,
  ),
};
const result = writeSvgExport(
  createEditor(spaced),
  {
    title: 'Standalone SVG with embedded Inter',
    description:
      'Trusted single-face TrueType font; structurally checked, rendering qualified separately.',
    region: { type: 'model', padding: 40 },
    theme: { colorScheme: 'light' },
    background: { type: 'theme' },
    font: { family: 'Inter', size: 16, weight: 400, assetId: 'inter' },
    assets: [{ id: 'inter', kind: 'font', availability: 'embedded' }],
    renderers: { nodes: 'built-in', edges: 'built-in' },
  },
  { fontResources: [{ assetId: 'inter', format: 'truetype', bytes }] },
);
if (result.type !== 'written') throw new Error(JSON.stringify(result.findings));
await writeFile(new URL('svg-font-embedded.svg', import.meta.url), result.svg);
console.log(JSON.stringify({ type: result.type, findings: result.findings }));
