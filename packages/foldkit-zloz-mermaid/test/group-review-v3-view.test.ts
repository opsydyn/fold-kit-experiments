import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { captureGroupDocumentV3 } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import wire from '../../foldkit-zloz/test/fixtures/group-document-v3-ported.json';
import { zlozGroupMermaidReviewV3, type ZlozGroupMermaidReviewViewOptionsV3 } from '../src/foldkit';
import {
  createGroupMermaidReviewV3,
  resolveGroupMermaidReviewV3,
  type ZlozGroupMermaidReviewRequestV3,
} from '../src/index';
async function render(
  options: Partial<ZlozGroupMermaidReviewViewOptionsV3<ZlozGroupMermaidReviewRequestV3>> = {},
) {
  const source = captureGroupDocumentV3({
      ...wire,
      graph: {
        ...wire.graph,
        nodes: wire.graph.nodes.map((n) =>
          n.id === 'g' ? { ...n, label: '<script>end</script>' } : n,
        ),
      },
    }),
    state = createGroupMermaidReviewV3('render'),
    controls = resolveGroupMermaidReviewV3(state, {
      scope: 'render',
      sourceRevision: 0,
      document: source,
      canDownload: () => 'Export protected.',
    });
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: controls }),
        view: (model, h: HtmlBuilder<ZlozGroupMermaidReviewRequestV3>) => ({
          title: 'Native Mermaid',
          body: zlozGroupMermaidReviewV3(h, model, (r) => r, { id: 'native-mermaid', ...options }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return { document: window.document, controls };
}
test('native optional controls retain fidelity and protection in minimal mode with safe highlighted source and exact labels', async () => {
  const { document, controls } = await render({ minimalMode: true });
  expect(document.querySelector('label[for="native-mermaid-direction"]')?.textContent).toBe(
    'Mermaid direction',
  );
  expect(document.querySelector('select')?.id).toBe('native-mermaid-direction');
  expect(document.body.textContent).toContain('Export protected.');
  expect(
    document.querySelector('[data-zloz-mermaid-finding="group-port-attachment-omitted"]'),
  ).not.toBeNull();
  expect(document.querySelector('[role="status"]')).toBeNull();
  expect(document.querySelector('button')?.disabled).toBe(true);
  expect(document.querySelector('input')?.disabled).toBe(true);
  expect(document.querySelectorAll('script')).toHaveLength(0);
  assert(controls.result.status === 'converted');
  expect(document.querySelector('pre code')?.textContent).toBe(controls.result.value.source);
  expect(document.querySelectorAll('pre span').length).toBeGreaterThan(0);
});
test('nullable part slots and custom findings/layout need no DOM overrides', async () => {
  const { document } = await render({
    diagnostics: false,
    renderPart: (part, _controls, h) =>
      part === 'source'
        ? null
        : part === 'download'
          ? h.button([h.Type('button')], ['Custom save'])
          : undefined,
    renderFinding: (finding, h) => h.li([h.Class('finding-badge')], [finding.code]),
    renderLayout: (parts) => [
      ...parts.findings,
      ...[parts.source, parts.download, parts.reason].filter(
        (part): part is NonNullable<typeof part> => part !== null,
      ),
    ],
  });
  expect(document.querySelector('pre')).toBeNull();
  expect(document.querySelector('.finding-badge')).not.toBeNull();
  expect(document.querySelector('button')?.textContent).toBe('Custom save');
  expect(document.body.textContent).toContain('Export protected.');
});
