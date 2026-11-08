import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { parse as officialParse } from '@mermaid-js/parser';
import { createEditor, updateEditor } from '@opsydyn/foldkit-flow';
import mermaid from 'mermaid';
import { parseFlowchart } from 'mermaid-ast/parser';
import { renderFlowchart } from 'mermaid-ast/renderer';

import { importFlowchart, exportFlowchart } from './dist/spike.js';

const fixtures = JSON.parse(
  readFileSync(new URL('./fixtures/corpus.json', import.meta.url), 'utf8'),
);
const capture = (run) =>
  Promise.resolve()
    .then(run)
    .then(
      () => 'accepted',
      (error) => String(error).slice(0, 700),
    );
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
const upstream = parseFlowchart('flowchart LR\nA e1@--> B\nstyle B fill:red');
const cases = [];
for (const fixture of fixtures) {
  const imported = await importFlowchart(fixture.source, { lossPolicy: 'report' });
  assert.equal(imported.status, fixture.expected, fixture.id);
  let generated = null;
  if (imported.status === 'converted') {
    const edited = updateEditor(createEditor(imported.value.graph), {
      type: 'NodeLabelChanged',
      id: imported.value.graph.nodes[0].id,
      label: 'Edited "quote" & #quot; / 支付',
    });
    const exported = await exportFlowchart(edited.graph, {
      lossPolicy: 'report',
      direction: imported.value.direction,
    });
    assert.equal(exported.status, 'converted');
    generated = exported.value.source;
  }
  cases.push({
    id: fixture.id,
    status: imported.status,
    diagnostics: imported.diagnostics,
    generated,
  });
}
const lock = JSON.parse(readFileSync(new URL('./package-lock.json', import.meta.url), 'utf8'));
const dependencies = Object.fromEntries(
  ['@mermaid-js/parser', 'mermaid-ast', 'mermaid', '@opsydyn/foldkit-flow'].map((name) => [
    name,
    lock.packages[`node_modules/${name}`],
  ]),
);
console.log(
  JSON.stringify(
    {
      runtime: { node: process.version, bun: process.versions.bun ?? null },
      corpusSha256: createHash('sha256')
        .update(readFileSync(new URL('./fixtures/corpus.json', import.meta.url)))
        .digest('hex'),
      dependencies,
      probes: {
        officialParser: await capture(() => officialParse('flowchart', 'flowchart LR\nA --> B')),
        headlessMermaid: await capture(() => mermaid.parse('flowchart LR\nA --> B')),
        namedEdge: upstream.links[0].id,
        nodeStyle: upstream.nodes.get('B').props ?? null,
        upstreamRendererPreservesNamedEdge: renderFlowchart(upstream).includes('e1'),
      },
      cases,
    },
    null,
    2,
  ),
);
