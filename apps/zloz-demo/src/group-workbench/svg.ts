import {
  captureGroupWorkbenchDocumentV3,
  captureGroupSvgLayoutV3,
  groupWorkbenchRoutesV3,
  resolveGroupSvgReviewV3,
  svgReviewForScope,
  type ZlozGroupSvgReviewContextV3,
} from '@opsydyn/foldkit-zloz';

import type { ReadyState } from './main';
/** The working model and detached edition each provide a full native source; overlays are not exported. */
export function groupSvgContext(state: ReadyState): ZlozGroupSvgReviewContextV3 {
  const current = state.review?.workbench ?? state.workbench;
  const document = captureGroupWorkbenchDocumentV3(current);
  const routes = groupWorkbenchRoutesV3(current);
  const readyRoutes = routes.length === document.graph.edges.length;
  const context: ZlozGroupSvgReviewContextV3 = {
    scope: `${current.editor.sessionId}:svg`,
    sourceRevision: current.editor.revision,
    document,
    surface: current.surface,
    title: state.review ? `Orders — ${state.review.edition.name}` : 'Orders — native v3',
    description:
      'Static model artwork. Controls, selection, collapsed presentation and diagnostic overlays are not exported.',
    fileName: 'zloz-native-v3.svg',
    theme: { colorScheme: state.theme },
    renderers: {
      nodes: 'built-in',
      edges: 'built-in',
      overrides: state.svgCustom
        ? document.graph.nodes.map((node) => ({
            target: { kind: 'node', id: node.id },
            renderer: {
              type: 'fallback',
              reason:
                'The custom workshop badge and interactive drag handle become canonical static model artwork; group ports and connections remain.',
            },
          }))
        : [],
    },
    canDownload: () =>
      state.protectSvg
        ? 'SVG downloads are protected in this workspace.'
        : current.gesture.type !== 'idle'
          ? 'Finish the active gesture before downloading SVG.'
          : state.pendingLayout
            ? 'Wait for or cancel layout before downloading SVG.'
            : state.svgRetained && !readyRoutes
              ? 'Arrange with ELK and expand groups before exporting retained routes.'
              : null,
  };
  if (!state.svgRetained || !readyRoutes) return context;
  const renderKey = `native-v3:${state.theme}:${state.svgCustom ? 'badge' : 'canonical'}`;
  return {
    ...context,
    layout: { snapshot: captureGroupSvgLayoutV3(document, routes, renderKey), renderKey },
  };
}
export function groupSvgControls(state: ReadyState) {
  const context = groupSvgContext(state);
  return resolveGroupSvgReviewV3(svgReviewForScope(state.svgReview, context.scope), context);
}
