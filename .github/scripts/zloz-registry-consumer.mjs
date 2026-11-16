import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  captureGroupDocumentV3,
  createGroupEditorV3,
  captureGroupEditorSourceV3,
  groupLayoutRequestV3,
  applyGroupLayoutV3,
  updateGroupEditorV3,
  serializeGroupDocumentV3,
  parseGroupDocumentV3,
  writeGroupSvgExportV3,
  createEditor,
  layoutRequest,
  applyLayout,
} from '@opsydyn/foldkit-zloz';
import { createElkGroupLayoutV3 } from '@opsydyn/foldkit-zloz-elk';
import { createForceLayout } from '@opsydyn/foldkit-zloz-force';
import { supportsForceLayout } from '@opsydyn/foldkit-zloz-force/eligibility';
import { exportGroupMermaidV3 } from '@opsydyn/foldkit-zloz-mermaid';

const document = captureGroupDocumentV3({
  version: 3,
  coordinateSpace: 'world',
  connectionMode: 'strict',
  capabilities: { groupPorts: true },
  graph: {
    nodes: [
      {
        id: 'child',
        label: 'Child',
        parentId: 'g',
        position: { x: 140, y: 140 },
        size: { width: 120, height: 80 },
        ports: [],
      },
      {
        id: 'g',
        label: 'Boundary',
        kind: 'group',
        position: { x: 100, y: 80 },
        size: { width: 400, height: 300 },
        ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
      },
      {
        id: 'b',
        label: 'Other system',
        position: { x: 600, y: 140 },
        size: { width: 200, height: 100 },
        ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
      },
    ],
    edges: [
      {
        id: 'boundary-link',
        source: { node: 'g', port: 'out' },
        target: { node: 'b', port: 'in' },
      },
    ],
  },
  viewport: { x: 12, y: -4, zoom: 1.25 },
});
const before = structuredClone(document);
assert.equal(parseGroupDocumentV3(serializeGroupDocumentV3(document)).status, 'parsed');
const editor = createGroupEditorV3(document, { sessionId: 'registry-release-train' });
const request = groupLayoutRequestV3(editor, 'registry-layout');
const layout = await createElkGroupLayoutV3({ direction: 'RIGHT' })(request);
const applied = applyGroupLayoutV3(editor, request, layout);
assert.equal(applied.type, 'applied', applied.reason);
assert.equal(applied.editor.history.past.length, 1);
assert.deepEqual(applied.editor.document.graph.edges, before.graph.edges);
assert.deepEqual(
  applied.editor.document.graph.nodes.find((node) => node.id === 'g').ports,
  before.graph.nodes.find((node) => node.id === 'g').ports,
);
const undo = updateGroupEditorV3(applied.editor, {
  type: 'UndoPressed',
  source: captureGroupEditorSourceV3(applied.editor),
});
assert.deepEqual(undo.editor.document, before);
assert.deepEqual(document, before);
const svg = writeGroupSvgExportV3(document, {
  title: 'Registry smoke',
  region: { type: 'model', padding: 40 },
  theme: { colorScheme: 'dark' },
  background: { type: 'theme' },
  font: { family: 'sans-serif', size: 14, weight: 400 },
  renderers: { nodes: 'built-in', edges: 'built-in' },
});
assert.equal(svg.type, 'written');
assert(svg.svg.includes('data-zloz-document-version="3"'));
const mermaid = exportGroupMermaidV3(document, { lossPolicy: 'report' });
assert.equal(mermaid.status, 'converted');
assert.equal(mermaid.value.identity.version, 3);
assert(mermaid.diagnostics.some((finding) => finding.code === 'group-port-attachment-omitted'));
assert.equal(supportsForceLayout(document.graph), false);
const flat = createEditor({
  nodes: [
    { id: 'a', label: 'A', position: { x: 0, y: 0 }, size: { width: 240, height: 100 }, ports: [] },
    { id: 'b', label: 'B', position: { x: 0, y: 0 }, size: { width: 100, height: 80 }, ports: [] },
  ],
  edges: [],
});
assert.equal(supportsForceLayout(flat.graph), true);
const forceRequest = layoutRequest(flat, 'registry-force');
const force = await createForceLayout()(forceRequest);
assert.equal(applyLayout(flat, forceRequest, force).past.length, 1);
const version = JSON.parse(
  readFileSync(new URL('node_modules/@opsydyn/foldkit-zloz/package.json', import.meta.url)),
).version;
for (const name of ['foldkit-zloz-elk', 'foldkit-zloz-force', 'foldkit-zloz-mermaid']) {
  const manifest = JSON.parse(
    readFileSync(new URL(`node_modules/@opsydyn/${name}/package.json`, import.meta.url)),
  );
  assert.equal(manifest.version, version);
  assert.equal(manifest.peerDependencies['@opsydyn/foldkit-zloz'], version);
}
for (const name of [
  'foldkit',
  'effect',
  '@opsydyn/foldkit-zloz-cli',
  '@opsydyn/foldkit-zloz-alchemy',
])
  assert.equal(existsSync(new URL(`node_modules/${name}`, import.meta.url)), false);
console.log(
  `Registry consumer passed on Node ${process.versions.node}: Zloz ${version}, ELK group ports/Undo, SVG, Mermaid fidelity and Force.`,
);
