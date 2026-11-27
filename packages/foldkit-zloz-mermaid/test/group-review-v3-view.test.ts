import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { captureGroupDocumentV3 } from '@opsydyn/foldkit-zloz';

import wire from '../../foldkit-zloz/test/fixtures/group-document-v3-ported.json';
import { groupMermaidReviewV3, type GroupMermaidReviewOptions } from '../src/effect-ui';
import { createGroupMermaidReviewV3, resolveGroupMermaidReviewV3 } from '../src/index';
import { observedRequest, render as renderView, type Request } from './render-effect-ui';

async function render(options: Partial<GroupMermaidReviewOptions<Request>> = {}) {
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
  const document = await renderView((h) =>
    groupMermaidReviewV3(h, controls, () => observedRequest, { id: 'native-mermaid', ...options }),
  );
  return { document, controls };
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
          ? h.button.attr('type', 'button').children('Custom save')
          : undefined,
    renderFinding: (finding, h) => h.li.class('finding-badge').children(finding.code),
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
