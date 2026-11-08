/** Repo-only benchmark. No timing budgets are imposed on CI or package consumers. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { arch, cpus, release } from 'node:os';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';

import { zlozConnectionCreationField } from '../src/foldkit';
import {
  createEditor,
  resolveConnectionCreation,
  resolveEdgeReconnection,
  resolveEndpointChoices,
  updateEditor,
  type EditorEvent,
  type EditorPolicy,
  type ZlozGraph,
} from '../src/index';

const samples = 40;
const warmup = 8;
async function main() {
  let checksum = 0;

  function summary(values: readonly number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const rank = (fraction: number) =>
      sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
    return { p50Ms: rank(0.5), p95Ms: rank(0.95), samplesMs: values };
  }

  function measure(operation: () => number, batch = 1) {
    for (let i = 0; i < warmup; i++) checksum += operation();
    const values = [];
    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      for (let j = 0; j < batch; j++) checksum += operation();
      values.push((performance.now() - start) / batch);
    }
    return summary(values);
  }

  /** Independent synthetic fixture: four ports per node and two directed chains. */
  function fixture(count: number): ZlozGraph {
    const id = (index: number) => `node-${String(index).padStart(4, '0')}`;
    return {
      nodes: Array.from({ length: count }, (_, index) => ({
        id: id(index),
        label: `Node ${String(index).padStart(4, '0')}`,
        position: { x: (index % 16) * 220, y: Math.floor(index / 16) * 130 },
        size: { width: 180, height: 100 },
        ports: [
          { id: 'out-a', kind: 'output', side: 'right', offset: 0.25 },
          { id: 'out-b', kind: 'output', side: 'right', offset: 0.75 },
          { id: 'in-a', kind: 'input', side: 'left', offset: 0.25 },
          { id: 'in-b', kind: 'input', side: 'left', offset: 0.75 },
        ],
      })),
      edges: Array.from({ length: count - 1 }, (_, index) =>
        ['a', 'b'].map((port) => ({
          id: `link-${index}-${port}`,
          source: { node: id(index), port: `out-${port}` },
          target: { node: id(index + 1), port: `in-${port}` },
        })),
      ).flat(),
    };
  }

  const policy: EditorPolicy = {
    canConnectPort: ({ node, port }) =>
      node.endsWith('0') && port === 'in-b' ? 'Reserved input.' : null,
    canConnect: (edge) =>
      edge.source.node === edge.target.node ? 'Self connections are disabled.' : null,
  };

  async function fieldRendering(
    context: ReturnType<typeof resolveConnectionCreation>['target'],
    query: string,
  ) {
    const tree = [];
    const envelope = [];
    for (let i = -warmup; i < samples; i++) {
      let buildMs = 0;
      const start = performance.now();
      const rendered = await Effect.runPromise(
        renderToString(
          {
            Flags: Schema.Struct({}),
            init: () => ({ model: context }),
            view: (model, h: HtmlBuilder<EditorEvent>) => {
              const before = performance.now();
              const body = zlozConnectionCreationField(h, model, (event) => event, {
                idPrefix: 'bench',
                groupByNode: true,
                query,
              });
              buildMs = performance.now() - before;
              return { title: 'Chooser benchmark', body };
            },
          },
          { flags: {}, isHydratable: false },
        ),
      );
      const elapsed = performance.now() - start;
      assert(rendered.html.includes('<optgroup'), 'Grouped field was not rendered');
      checksum += rendered.html.length;
      if (i >= 0) {
        tree.push(buildMs);
        envelope.push(elapsed);
      }
    }
    return { tree: summary(tree), ssrEnvelope: summary(envelope) };
  }

  const rows = [];
  const sizes = [32, 320, 1000];
  const reverse = process.env.FLOW_CHOOSER_BENCH_REVERSE === '1';
  if (reverse) sizes.reverse();
  for (const nodes of sizes) {
    const graph = fixture(nodes);
    const source = { node: 'node-0000', port: 'out-a' };
    const initial = createEditor(graph);
    const state = updateEditor(initial, { type: 'PortActivated', endpoint: source });
    const target = resolveConnectionCreation(state, policy).target;
    assert.equal(target.entries.length, nodes * 2);
    assert.equal(state.past.length, 0);
    const query = `node-${String(nodes - 1).padStart(4, '0')}`;
    assert.equal(resolveEndpointChoices(target.entries, { query }).matchCount, 2);
    const calls = { port: 0, connection: 0 };
    resolveConnectionCreation(state, {
      canConnectPort: (endpoint, graph) => {
        calls.port++;
        return policy.canConnectPort?.(endpoint, graph) ?? null;
      },
      canConnect: (edge, graph) => {
        calls.connection++;
        return policy.canConnect?.(edge, graph) ?? null;
      },
    });
    const creation = measure(() => resolveConnectionCreation(state, policy).target.entries.length);
    const reconnection = measure(
      () => resolveEdgeReconnection(initial, 'link-0-a', 'target', policy)?.entries.length ?? 0,
    );
    const projection = {
      broad: measure(() => resolveEndpointChoices(target.entries).entries.length, 10),
      selective: measure(
        () => resolveEndpointChoices(target.entries, { query }).entries.length,
        10,
      ),
    };
    const render = {
      broad: await fieldRendering(target, ''),
      selective: await fieldRendering(target, query),
    };
    rows.push({
      nodes,
      ports: nodes * 4,
      edges: graph.edges.length,
      targetCandidates: target.entries.length,
      policy: 'constant-time port denial and self-connection rule',
      policyCallsPerCreationResolution: calls,
      creation,
      reconnection,
      projection,
      render,
    });
  }
  console.log(
    JSON.stringify(
      {
        productionHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        runtime: `Bun ${Bun.version}`,
        machine: { cpu: cpus()[0]?.model, arch: arch(), os: release() },
        samples,
        warmup,
        order: reverse ? 'reverse' : 'forward',
        percentile: 'nearest rank',
        checksum,
        rows,
      },
      null,
      2,
    ),
  );
}
await main();
