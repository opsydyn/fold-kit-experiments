import { exportMermaid } from '@opsydyn/foldkit-flow-mermaid';
import type { HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import type { Model } from './model';

export function mermaidPreview(model: Model) {
  return exportMermaid(model.editor.graph, {
    lossPolicy: model.mermaidLossConsentRevision === model.editor.revision ? 'report' : 'reject',
  });
}

export function mermaidExportPanel(model: Model, h: HtmlBuilder<Message>) {
  const result = mermaidPreview(model);
  return h.section(
    [
      h.Id('flow-mermaid-preview'),
      h.AriaLabel('Mermaid export preview'),
      h.Class('workbench-mermaid-preview'),
    ],
    [
      h.h3([], ['Source preview']),
      h.p(
        [],
        [
          'Export a flowchart projection. Keep Flow JSON as the authoritative document. The download bundles source, identity metadata and conversion diagnostics.',
        ],
      ),
      h.p(
        [h.Role('status')],
        [
          result.status === 'converted'
            ? 'Projection ready. Conversion losses remain listed below.'
            : 'Download unavailable. Review the conversion losses or unsupported features below.',
        ],
      ),
      h.ul(
        [h.AriaLabel('Mermaid conversion diagnostics')],
        result.diagnostics.map((item, index) =>
          h.li(
            [h.Key(`${index}:${item.code}`)],
            [
              `${item.severity}: ${item.subject === null ? '' : `${item.subject}: `}${item.message}`,
            ],
          ),
        ),
      ),
      h.label(
        [],
        [
          h.input([
            h.Type('checkbox'),
            h.Checked(model.mermaidLossConsentRevision === model.editor.revision),
            h.OnClick(Message.ClickedMermaidLossConsent()),
          ]),
          'Allow reported conversion losses for this revision',
        ],
      ),
      ...(result.status === 'converted'
        ? [
            h.pre(
              [
                h.AriaLabel('Mermaid source'),
                h.Tabindex(0),
                h.Style({
                  'white-space': 'pre-wrap',
                  'overflow-wrap': 'anywhere',
                  'max-height': '300px',
                  overflow: 'auto',
                }),
              ],
              [result.value.source],
            ),
          ]
        : []),
      h.div(
        [h.Style({ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'margin-top': '12px' })],
        [
          h.button(
            [
              h.Type('button'),
              h.Style({ padding: '10px 16px' }),
              h.Disabled(result.status !== 'converted'),
              h.OnClick(Message.ClickedMermaidDownload()),
            ],
            ['Download Mermaid bundle'],
          ),
          h.button(
            [
              h.Type('button'),
              h.Style({ padding: '10px 16px' }),
              h.OnClick(Message.ClickedMermaidPreview()),
            ],
            ['Close Mermaid preview'],
          ),
        ],
      ),
    ],
  );
}
