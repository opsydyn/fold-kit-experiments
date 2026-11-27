import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { type EditorState } from '@opsydyn/foldkit-zloz';
import { historyMinimap, viewportControlActions } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { alchemyReviewCanvas } from './alchemy-review';
import { Message } from './message';
import { ThemePreference, type Model, type WorkbenchSection } from './model';
import {
  nativeMiniMapControls,
  nativeNavigationSettings,
  nativeViewportControls,
} from './native-navigation';
import { architectureNativePanel } from './native-panel';
import { packetReviewActive, packetReviewCanvas } from './packet-reader';
import { receiptReviewCanvas } from './receipt-review';

export type WorkbenchControls<M> = Readonly<
  Record<Exclude<WorkbenchSection, 'navigation'>, readonly View.Content<M>[]>
>;
const sections: readonly (readonly [WorkbenchSection, string])[] = [
  ['diagram', 'Diagram'],
  ['history', 'History'],
  ['appearance', 'Appearance'],
  ['navigation', 'Navigation'],
  ['ports', 'Ports'],
  ['policies', 'Policies'],
  ['inspect', 'Inspect'],
  ['mapping', 'Mapping review'],
  ['c4mapping', 'C4 mapping review'],
  ['diagnostics', 'Diagnostics'],
  ['export', 'Mermaid export'],
  ['svg', 'SVG export'],
  ['png', 'PNG export'],
  ['review', 'Review packets'],
  ['patch', 'Patch review'],
  ['alchemy', 'Domain review'],
];

type Chrome = Readonly<{
  collapsed: boolean;
  canvasId: string;
  fit: Readonly<{ disabled: boolean; message: Message }>;
}>;
const chrome = architectureNativePanel<Chrome>((h, { collapsed, canvasId, fit }, request) =>
  h.div(
    h.a
      .class('workbench-skip')
      .attr('href', '#' + encodeURIComponent(canvasId))
      .children('Skip to canvas'),
    h.div.class('workbench-sidebar-heading').children(
      collapsed
        ? null
        : h.div(h.p.class('workbench-eyebrow').children('ZLOZ'), h.h1('Workflow patterns')),
      h.button
        .key('sidebar-toggle')
        .class('workbench-sidebar-toggle')
        .attr('type', 'button')
        .attr('aria-label', collapsed ? 'Show controls' : 'Hide controls')
        .attr('aria-expanded', String(!collapsed))
        .attr('aria-controls', 'workbench-sidebar-content')
        .on('click', request(Message.ClickedWorkbenchSidebar()))
        .children(collapsed ? '☰' : '‹'),
    ),
    collapsed
      ? h.button
          .class('workbench-rail-fit')
          .attr('type', 'button')
          .attr('aria-label', 'Fit view')
          .disabled(fit.disabled)
          .on('click', request(fit.message))
          .children('Fit')
      : null,
  ),
);

type Navigation = Readonly<{
  selected: WorkbenchSection;
  theme: typeof ThemePreference.Type;
  allowed: readonly WorkbenchSection[];
}>;
const setTheme = Schema.decodeUnknownSync(ThemePreference);
const navigation = architectureNativePanel<Navigation>((h, { selected, theme, allowed }, request) =>
  h.div(
    h.div.class('workbench-theme').children(
      h.label.class('workbench-theme-picker').children(
        'Theme',
        h.select
          .value(theme)
          .on('change', ({ value }) =>
            request(Message.SelectedThemePreference({ themePreference: setTheme(value) })),
          )
          .children(
            h.option
              .attr('value', 'system')
              .selected(theme === 'system')
              .children('System'),
            h.option
              .attr('value', 'light')
              .selected(theme === 'light')
              .children('Light'),
            h.option
              .attr('value', 'dark')
              .selected(theme === 'dark')
              .children('Dark'),
          ),
      ),
    ),
    h.nav
      .class('workbench-sections')
      .attr('aria-label', 'Workbench sections')
      .children(
        ...sections.map(([section, label]) =>
          h.button
            .key(section)
            .attr('type', 'button')
            .disabled(!allowed.includes(section))
            .attr('aria-pressed', String(selected === section))
            .attr('aria-controls', `workbench-${section}`)
            .on('click', request(Message.SelectedWorkbenchSection({ section })))
            .children(label),
        ),
      ),
  ),
);

const overview = architectureNativePanel<
  Readonly<{
    editor: EditorState;
    modelId: string;
    epoch: number;
    compact: boolean;
  }>
>((h, { editor, modelId, epoch, compact }, request) =>
  h.div(
    historyMinimap(
      h,
      editor,
      (message) => request(Message.ObservedModelInput({ modelId, epoch, message })),
      { compact },
    ),
  ),
);

export function workbenchLayout<M>(
  h: Html.H<M>,
  model: Model,
  parts: Readonly<{
    canvasId: string;
    help: View.Content<M>;
    status: View.Content<M>;
    connections: View.Content<M>;
    creation: View.Content<M> | null;
    canvas: View.Content<M>;
  }>,
  controls: WorkbenchControls<M>,
  theme: typeof ThemePreference.Type,
  notice: View.Content<M>,
  send: (message: Message) => M,
) {
  const alchemy = model.alchemyReview.review;
  const packet = packetReviewActive(model) ? model.packetPreview : null;
  const receipt = model.receiptReview;
  const fitView = viewportControlActions(alchemy?.editor ?? packet?.editor ?? model.editor).fitView;
  const canvasId = alchemy
    ? `alchemy-${alchemy.id}-surface`
    : packet
      ? `packet-${packet.id}-${packet.side}-surface`
      : receipt
        ? `receipt-${receipt.id}-${receipt.side}-surface`
        : parts.canvasId;
  const fitMessage = alchemy
    ? Message.ObservedAlchemyInput({ id: alchemy.id, message: fitView.event })
    : packet
      ? Message.ObservedPacketCanvasInput({
          scope: packet.scope,
          id: packet.id,
          side: packet.side,
          message: fitView.event,
        })
      : Message.ObservedModelInput({
          modelId: model.modelIdentity.id,
          epoch: model.modelEpoch,
          message: fitView.event,
        });
  const allowed = sections.flatMap(([section]) =>
    ((alchemy !== null || model.alchemyReview.pending !== null) &&
      section !== 'alchemy' &&
      section !== 'diagnostics') ||
    (receipt !== null && section !== 'mapping' && section !== 'diagnostics') ||
    (packetReviewActive(model) && section !== 'review' && section !== 'diagnostics')
      ? []
      : [section],
  );
  const showOverview = !model.minimalMode && model.diagnosticsEnabled && model.diagnostics.overview;
  const navigationContent =
    model.sidebarSection === 'navigation' && !model.sidebarCollapsed
      ? [
          nativeViewportControls(h, model, 'architecture-effect-ui', 'viewport', send),
          nativeMiniMapControls(h, model, 'architecture-effect-ui', 'overview-settings', send),
          ...(showOverview
            ? [
                overview(
                  h,
                  {
                    editor: model.editor,
                    modelId: model.modelIdentity.id,
                    epoch: model.modelEpoch,
                    compact: model.navigationDesign === 'compact',
                  },
                  'architecture-effect-ui',
                  'overview',
                  send,
                ),
              ]
            : []),
          nativeNavigationSettings(h, model, 'architecture-effect-ui', 'navigation-settings', send),
        ]
      : [];
  const content = {
    ...controls,
    navigation: navigationContent,
    ports: [...(parts.creation ? [parts.creation] : []), ...controls.ports],
    inspect: [...controls.inspect, parts.connections],
    diagnostics: [...controls.diagnostics, parts.help, parts.status],
  } satisfies Readonly<Record<WorkbenchSection, readonly View.Content<M>[]>>;
  return h.div
    .class(
      model.sidebarCollapsed ? 'workbench-layout workbench-layout--collapsed' : 'workbench-layout',
    )
    .children(
      h.aside
        .class('workbench-sidebar')
        .attr('aria-label', 'Workbench controls')
        .children(
          chrome(
            h,
            {
              collapsed: model.sidebarCollapsed,
              canvasId,
              fit: {
                disabled:
                  fitView.disabled || (model.alchemyReview.pending !== null && alchemy === null),
                message: fitMessage,
              },
            },
            'architecture-effect-ui',
            'chrome',
            send,
          ),
          h.div
            .id('workbench-sidebar-content')
            .class('workbench-sidebar-content')
            .style({ display: model.sidebarCollapsed ? 'none' : 'flex' })
            .children(
              navigation(
                h,
                { selected: model.sidebarSection, theme, allowed },
                'architecture-effect-ui',
                'navigation',
                send,
              ),
              h.div
                .class('workbench-sidebar-scroll')
                .attr('tabindex', String(0))
                .attr('aria-label', 'Workbench settings')
                .children(
                  ...sections.map(([section, label]) =>
                    h.section
                      .key(section)
                      .id(`workbench-${section}`)
                      .attr('aria-label', label + ' settings')
                      .style({ display: model.sidebarSection === section ? 'block' : 'none' })
                      .children(h.h2.children(label), ...content[section]),
                  ),
                ),
              ...(model.notice ? [h.div.class('workbench-notice').children(notice)] : []),
            ),
        ),
      h.section
        .key(`model:${model.modelIdentity.id}:${model.modelEpoch}`)
        .class('workbench-canvas')
        .attr('aria-label', 'Diagram canvas')
        .style({ position: 'relative' })
        .children(
          model.alchemyReview.review
            ? alchemyReviewCanvas(model, h, send)
            : packetReviewActive(model)
              ? packetReviewCanvas(model, h, send)
              : model.receiptReview
                ? receiptReviewCanvas(model, h, send)
                : parts.canvas,
          ...(model.historyReview &&
          !model.receiptReview &&
          !model.alchemyReview.review &&
          !packetReviewActive(model)
            ? [
                h.div
                  .attr('role', 'status')
                  .attr('aria-label', 'Historical edition notice')
                  .style({
                    position: 'absolute',
                    top: '12px',
                    left: '16px',
                    zIndex: '5',
                    padding: '8px 12px',
                    background: 'light-dark(#fffefa, #191c24)',
                    color: 'light-dark(#172033, #eef0f5)',
                    border: '1px solid #64748b',
                    borderRadius: '6px',
                  })
                  .children(
                    'Read-only history · working model preserved ',
                    h.button
                      .attr('type', 'button')
                      .on('click', send(Message.ClickedHistoryPresent()))
                      .children('Back to present'),
                  ),
              ]
            : []),
        ),
    );
}
