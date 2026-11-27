import type {
  ZlozGroupHeaderMeasurementRequest,
  ZlozLabelMeasurementRequest,
} from '@opsydyn/foldkit-zloz';
import {
  graphSurface,
  groupHeaderMeasurementProbe,
  labelMeasurementProbe,
  type GraphSurfaceOptions,
} from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { alchemyGroupHeader } from './alchemy-group-header';
import { alchemyPreviewLabelSize } from './alchemy-labels';
import type { AlchemyReviewState } from './alchemy-state';
import { Message } from './message';
import { architectureNativePanel } from './native-panel';
import { workbenchThemes } from './theme';

type DescriptorCanvas = Readonly<{
  review: NonNullable<AlchemyReviewState['review']>;
  scheme: keyof typeof workbenchThemes;
  headings?: ZlozGroupHeaderMeasurementRequest | undefined;
  labels?: ZlozLabelMeasurementRequest | undefined;
}>;

export const nativeAlchemyCanvas = architectureNativePanel<DescriptorCanvas>(
  'ArchitectureAlchemyReview',
  Schema.is(
    Schema.Union([
      Message.cases.ObservedAlchemyInput,
      Message.cases.ObservedAlchemyHeadings,
      Message.cases.ObservedAlchemyLabels,
    ]),
  ),
  (h, { review, scheme, headings, labels }, request) => {
    const { id, editor, layout } = review;
    const headingMode = layout.header;
    const labelDetail = layout.labels.mode === 'measured' ? layout.labels.detail : undefined;
    const options: GraphSurfaceOptions<ReturnType<typeof request>> = {
      id: `alchemy-${id}`,
      label: 'Read-only Domain descriptor diagram',
      theme: workbenchThemes[scheme],
      background: { type: 'dots' },
      architectureNotation: true,
      wheelNavigation: 'zoom',
      pinchZoom: false,
      onInput: (message) => request(Message.ObservedAlchemyInput({ id, message })),
      edgeEditing: {
        onEdit: (message) => request(Message.ObservedAlchemyInput({ id, message })),
        renderLabel: ({ edge }, builder) => {
          const label = edge.label ?? 'Relation';
          const expanded = labelDetail === 'expanded';
          const kind =
            edge.architecture?.family === 'ddd'
              ? expanded
                ? 'DDD relationship'
                : 'DDD'
              : expanded
                ? 'source declaration'
                : 'source';
          return builder.div
            .class('alchemy-native-relation-badge')
            .attr('data-alchemy-relation-badge', edge.id)
            .attr('data-zloz-measured-label', edge.id)
            .attr('data-label-detail', labelDetail)
            .attr('title', label)
            .style({
              width: labelDetail ? 'max-content' : `${alchemyPreviewLabelSize.width}px`,
              height: labelDetail ? 'auto' : `${alchemyPreviewLabelSize.height}px`,
            })
            .children(builder.span.children(label), builder.span.children(kind));
        },
      },
      renderGroupShell: ({ node, collapsed }, builder) => {
        const declared = alchemyGroupHeader(node);
        if (!declared || collapsed || headingMode === 'default') return undefined;
        const intrinsic = headingMode === 'measured';
        const provenance = intrinsic && layout.heading.detail === 'provenance';
        return {
          title: {
            style: {
              position: 'absolute',
              left: `${declared.padding.left}px`,
              top: `${declared.padding.top}px`,
              padding: '0',
              width: 'max-content',
              height: 'auto',
              border: 'none',
            },
            content: builder.span
              .class('alchemy-native-group-heading')
              .attr('data-zloz-group-header', node.id)
              .attr('data-alchemy-group-heading', node.id)
              .style({
                width: intrinsic ? 'max-content' : `${declared.size.width}px`,
                height: intrinsic ? 'auto' : `${declared.size.height}px`,
                whiteSpace: intrinsic ? 'nowrap' : 'normal',
              })
              .children(
                builder.span.children(
                  node.architecture?.family === 'c4'
                    ? 'C4 architecture boundary'
                    : 'DDD bounded context',
                ),
                builder.strong.children(node.label),
                builder.span.children(
                  intrinsic && !provenance
                    ? 'Read-only review'
                    : 'Source identity retained · Read-only architecture review',
                ),
                provenance
                  ? builder.span.children(
                      'Source roles, relationships and findings stay unchanged.',
                    )
                  : null,
              ),
          },
        };
      },
    };
    return h.div
      .class('alchemy-native-measurement-scope')
      .attr('data-zloz-label-measurement-scope', '')
      .attr('data-zloz-group-header-measurement-scope', '')
      .children(
        graphSurface(h, editor, options),
        labels
          ? labelMeasurementProbe(h, labels, (result) =>
              request(Message.ObservedAlchemyLabels({ id, result })),
            )
          : null,
        headings
          ? groupHeaderMeasurementProbe(h, headings, (result) =>
              request(Message.ObservedAlchemyHeadings({ id, result })),
            )
          : null,
      );
  },
);
