import { type EditorState } from '@opsydyn/foldkit-zloz';
import { historyMinimap } from '@opsydyn/foldkit-zloz/effect-ui';
import { viewportControlActions, type ZlozViewLayoutParts } from '@opsydyn/foldkit-zloz/foldkit';
import { Schema } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';

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

export type WorkbenchControls = Readonly<
  Record<Exclude<WorkbenchSection, 'navigation'>, readonly Html[]>
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
const chrome = architectureNativePanel<Chrome>(
  'ArchitectureSidebarChrome',
  Schema.is(
    Schema.Union([
      Message.cases.ClickedWorkbenchSidebar,
      Message.cases.ObservedAlchemyInput,
      Message.cases.ObservedPacketCanvasInput,
      Message.cases.ObservedModelInput,
    ]),
  ),
  (h, { collapsed, canvasId, fit }, request) =>
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
const navigation = architectureNativePanel<Navigation>(
  'ArchitectureSidebarNavigation',
  Schema.is(
    Schema.Union([Message.cases.SelectedThemePreference, Message.cases.SelectedWorkbenchSection]),
  ),
  (h, { selected, theme, allowed }, request) =>
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
>(
  'ArchitectureMinimap',
  Schema.is(Message.cases.ObservedModelInput),
  (h, { editor, modelId, epoch, compact }, request) =>
    h.div(
      historyMinimap(
        h,
        editor,
        (message) => request(Message.ObservedModelInput({ modelId, epoch, message })),
        { compact },
      ),
    ),
);

export function workbenchLayout(
  h: HtmlBuilder<Message>,
  model: Model,
  parts: ZlozViewLayoutParts,
  controls: WorkbenchControls,
  theme: typeof ThemePreference.Type,
  notice: Html,
  nativeCanvas?: Html,
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
          nativeViewportControls(h, model, 'architecture-effect-ui', 'viewport'),
          nativeMiniMapControls(h, model, 'architecture-effect-ui', 'overview-settings'),
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
                ),
              ]
            : []),
          nativeNavigationSettings(h, model, 'architecture-effect-ui', 'navigation-settings'),
        ]
      : [];
  const content = {
    ...controls,
    navigation: navigationContent,
    ports: [...(parts.creation ? [parts.creation] : []), ...controls.ports],
    inspect: [...controls.inspect, parts.connections],
    diagnostics: [...controls.diagnostics, parts.help, parts.status],
  } satisfies Readonly<Record<WorkbenchSection, readonly Html[]>>;
  return h.div(
    [
      h.Class(
        model.sidebarCollapsed
          ? 'workbench-layout workbench-layout--collapsed'
          : 'workbench-layout',
      ),
    ],
    [
      h.aside(
        [h.Class('workbench-sidebar'), h.AriaLabel('Workbench controls')],
        [
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
          ),
          h.div(
            [
              h.Id('workbench-sidebar-content'),
              h.Class('workbench-sidebar-content'),
              h.Style({ display: model.sidebarCollapsed ? 'none' : 'flex' }),
            ],
            [
              navigation(
                h,
                { selected: model.sidebarSection, theme, allowed },
                'architecture-effect-ui',
                'navigation',
              ),
              h.div(
                [
                  h.Class('workbench-sidebar-scroll'),
                  h.Tabindex(0),
                  h.AriaLabel('Workbench settings'),
                ],
                sections.map(([section, label]) =>
                  h.section(
                    [
                      h.Key(section),
                      h.Id(`workbench-${section}`),
                      h.AriaLabel(label + ' settings'),
                      h.Style({ display: model.sidebarSection === section ? 'block' : 'none' }),
                    ],
                    [h.h2([], [label]), ...content[section]],
                  ),
                ),
              ),
              ...(model.notice ? [h.div([h.Class('workbench-notice')], [notice])] : []),
            ],
          ),
        ],
      ),
      h.section(
        [
          h.Key(`model:${model.modelIdentity.id}:${model.modelEpoch}`),
          h.Class('workbench-canvas'),
          h.AriaLabel('Diagram canvas'),
          h.Style({ position: 'relative' }),
        ],
        [
          model.alchemyReview.review
            ? alchemyReviewCanvas(model, h)
            : packetReviewActive(model)
              ? packetReviewCanvas(model, h)
              : model.receiptReview
                ? receiptReviewCanvas(model, h)
                : (nativeCanvas ?? parts.canvas),
          ...(model.historyReview &&
          !model.receiptReview &&
          !model.alchemyReview.review &&
          !packetReviewActive(model)
            ? [
                h.div(
                  [
                    h.Role('status'),
                    h.AriaLabel('Historical edition notice'),
                    h.Style({
                      position: 'absolute',
                      top: '12px',
                      left: '16px',
                      'z-index': '5',
                      padding: '8px 12px',
                      background: 'light-dark(#fffefa, #191c24)',
                      color: 'light-dark(#172033, #eef0f5)',
                      border: '1px solid #64748b',
                      'border-radius': '6px',
                    }),
                  ],
                  [
                    'Read-only history · working model preserved ',
                    h.button(
                      [h.Type('button'), h.OnClick(Message.ClickedHistoryPresent())],
                      ['Back to present'],
                    ),
                  ],
                ),
              ]
            : []),
        ],
      ),
    ],
  );
}
