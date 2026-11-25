import {
  captureSvgLayout,
  resolveSvgReview,
  updateSvgReview,
  svgReviewForScope,
  type ZlozSvgReviewContext,
  type ZlozSvgReviewRequest,
} from '@opsydyn/foldkit-zloz';
import type { Return } from 'foldkit/update';

import { DownloadSvg } from './command';
import type { Message } from './message';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
export function workbenchSvgContext(
  model: Model,
  format: 'svg' | 'png' = 'svg',
): ZlozSvgReviewContext {
  const label = format.toUpperCase();
  const retained = format === 'svg' ? model.retainedSvgLayout : model.retainedPngLayout;
  const scheme =
    model.themePreference === 'dark' ||
    (model.themePreference === 'system' && model.systemColorScheme === 'dark')
      ? 'dark'
      : 'light';
  const context: ZlozSvgReviewContext = {
    scope: `${model.modelIdentity.id}/${model.modelEpoch}`,
    sourceRevision: model.editor.revision,
    snapshot: model.editor,
    surface: model.editor.surface,
    title: `${model.modelIdentity.name}${model.historyReview ? ` — edition ${model.historyReview.editionId}` : ''}`,
    description: 'Canonical ZLOZ model; editor controls and host overlays are not captured.',
    fileName: 'zloz-workbench.svg',
    theme: { colorScheme: scheme },
    themes: [
      { id: 'source', label: `Portable ${scheme} palette`, value: { colorScheme: scheme } },
      { id: 'light', label: 'Light', value: { colorScheme: 'light' } },
      { id: 'dark', label: 'Dark', value: { colorScheme: 'dark' } },
    ],
    renderers: {
      nodes: 'built-in',
      edges: 'built-in',
      overrides: [
        ...(model.nodeDesign !== 'cards'
          ? model.editor.graph.nodes.map((node) => ({
              target: { kind: 'node' as const, id: node.id },
              renderer: {
                type: 'fallback' as const,
                reason:
                  node.architecture?.family === 'event-storming' &&
                  node.architecture.role === 'hotspot'
                    ? 'Custom badges become canonical hotspot artwork with authored Open question/Resolved status.'
                    : `The ${model.nodeDesign} UI shell becomes canonical static model artwork.`,
              },
            }))
          : []),
        ...(model.edgeDesign !== 'default'
          ? model.editor.graph.edges.map((edge) => ({
              target: { kind: 'edge' as const, id: edge.id },
              renderer: {
                type: 'fallback' as const,
                reason: 'Custom edge artwork becomes the canonical path and plain label.',
              },
            }))
          : []),
      ],
    },
    canDownload: () =>
      (format === 'svg' ? model.protectSvgDownloads : model.protectPngDownloads)
        ? `${label} downloads are protected in this workspace.`
        : retained && model.editor.routes.length === 0
          ? 'Arrange with ELK or another routing engine before exporting retained layout.'
          : model.receiptReview
            ? 'Close the receipt comparison before exporting the model.'
            : model.historyPlayback?.cursor.status === 'playing'
              ? `Pause edition playback before reviewing ${label}.`
              : modelSessionBusy(model)
                ? `Finish active edits, imports or layout before downloading ${label}.`
                : null,
  };
  if (!retained || modelSessionBusy(model)) return context;
  const renderKey = `workbench-${format}:${scheme}:${model.nodeDesign}:${model.edgeDesign}`;
  return { ...context, layout: { snapshot: captureSvgLayout(model.editor, renderKey), renderKey } };
}
export function workbenchSvgReview(model: Model) {
  const ctx = workbenchSvgContext(model);
  return resolveSvgReview(svgReviewForScope(model.svgReview, ctx.scope), ctx);
}
export function updateWorkbenchSvgReview(
  model: Model,
  request: ZlozSvgReviewRequest,
): Return<Model, Message> {
  const ctx = workbenchSvgContext(model),
    result = updateSvgReview(svgReviewForScope(model.svgReview, ctx.scope), ctx, request);
  const next = { ...model, svgReview: result.state, notice: result.notice || model.notice };
  return result.payload
    ? { model: next, commands: [DownloadSvg(result.payload)] }
    : { model: next };
}
