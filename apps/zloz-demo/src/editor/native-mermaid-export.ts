import { mermaidExportSource, mermaidPreview } from './mermaid-preview';
import { Message } from './message';
import type { Model } from './model';
import { architectureNativePanel } from './native-panel';
import { settingCheckbox } from './native-settings';

export const nativeMermaidExport = architectureNativePanel<
  Pick<
    Model,
    'editor' | 'mermaidLossConsentRevision' | 'historyReview' | 'modelIdentity' | 'modelEpoch'
  >
>((h, model, request) => {
  const result = mermaidPreview(model);
  const source = mermaidExportSource(model);
  const reviewing = model.historyReview !== null;
  const converted = result.status === 'converted';
  return h.section
    .attr('id', 'flow-mermaid-preview')
    .attr('aria-label', 'Mermaid export preview')
    .class('workbench-mermaid-preview')
    .children(
      h.h3.children('Source preview'),
      h.p.children(
        'Export a flowchart projection. Keep ZLOZ JSON as the authoritative document. The download bundles source, identity metadata and conversion diagnostics.',
      ),
      h.p
        .attr('role', 'status')
        .children(
          converted
            ? 'Projection ready. Conversion losses remain listed below.'
            : 'Download unavailable. Review the conversion losses or unsupported features below.',
        ),
      h.ul
        .attr('aria-label', 'Mermaid conversion diagnostics')
        .children(
          ...result.diagnostics.map((item, index) =>
            h.li
              .key(`${index}:${item.code}`)
              .children(
                item.severity,
                ': ',
                item.subject === null ? null : `${item.subject}: `,
                item.message,
              ),
          ),
        ),
      h.label.children(
        settingCheckbox(
          h,
          model.mermaidLossConsentRevision === model.editor.revision,
          request(Message.ClickedMermaidLossConsent(source)),
          reviewing,
        ),
        'Allow reported conversion losses for this revision',
      ),
      converted
        ? h.pre
            .attr('aria-label', 'Mermaid source')
            .attr('tabindex', '0')
            .style({
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              maxHeight: '300px',
              overflow: 'auto',
            })
            .children(result.value.source)
        : null,
      h.div.style({ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }).children(
        h.button
          .attr('type', 'button')
          .style({ padding: '10px 16px' })
          .disabled(reviewing || !converted)
          .on('click', request(Message.ClickedMermaidDownload(source)))
          .children('Download Mermaid bundle'),
        h.button
          .attr('type', 'button')
          .style({ padding: '10px 16px' })
          .disabled(reviewing)
          .on('click', request(Message.ClickedMermaidPreview()))
          .children('Close Mermaid preview'),
      ),
    );
});
