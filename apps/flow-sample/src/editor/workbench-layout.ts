import {
  flowViewportControl,
  viewportControlActions,
  type FlowViewLayoutParts,
} from '@opsydyn/foldkit-flow/foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import type { Model, WorkbenchSection } from './model';

export type WorkbenchControls = Readonly<Record<WorkbenchSection, readonly Html[]>>;
const sections: readonly (readonly [WorkbenchSection, string])[] = [
  ['diagram', 'Diagram'],
  ['appearance', 'Appearance'],
  ['navigation', 'Navigation'],
  ['ports', 'Ports'],
  ['policies', 'Policies'],
  ['inspect', 'Inspect'],
  ['diagnostics', 'Diagnostics'],
  ['export', 'Mermaid export'],
];

function miniMapControls(h: HtmlBuilder<Message>, model: Model): Html {
  const masked = model.minimalMode || !model.diagnosticsEnabled;
  const busy = model.editor.gesture.type !== 'idle';
  const help = model.minimalMode
    ? 'Hidden by Minimal mode. Turn Minimal mode off in Diagnostics to show the mini map.'
    : !model.diagnosticsEnabled
      ? 'Diagnostics are disabled. Turn Show diagnostics on to show the mini map.'
      : busy
        ? 'Finish the current gesture before changing the mini map.'
        : 'Show the mini map here. Click it or use its arrow keys to navigate.';
  return h.div(
    [],
    [
      h.label(
        [h.Class('workbench-field')],
        [
          h.input([
            h.Type('checkbox'),
            h.Checked(model.diagnostics.overview),
            h.Disabled(masked || busy),
            h.AriaDescribedBy('workbench-mini-map-help'),
            h.OnClick(Message.ClickedDiagnostic({ diagnostic: 'overview' })),
          ]),
          'Mini map',
        ],
      ),
      h.p([h.Id('workbench-mini-map-help')], [help]),
      ...(masked
        ? [
            h.button(
              [
                h.Type('button'),
                h.OnClick(Message.SelectedWorkbenchSection({ section: 'diagnostics' })),
              ],
              ['Open diagnostics'],
            ),
          ]
        : []),
    ],
  );
}

export function workbenchLayout(
  h: HtmlBuilder<Message>,
  model: Model,
  parts: FlowViewLayoutParts,
  controls: WorkbenchControls,
  theme: Html,
  notice: Html,
) {
  const content = {
    ...controls,
    navigation: [
      ...(parts.controls ? [parts.controls] : []),
      miniMapControls(h, model),
      ...(parts.minimap ? [parts.minimap] : []),
      ...controls.navigation,
    ],
    ports: [...(parts.creation ? [parts.creation] : []), ...controls.ports],
    inspect: [...controls.inspect, parts.connections],
    diagnostics: [...controls.diagnostics, parts.help, parts.status],
  } satisfies WorkbenchControls;
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
          h.a(
            [h.Class('workbench-skip'), h.Href('#' + encodeURIComponent(parts.canvasId))],
            ['Skip to canvas'],
          ),
          h.div(
            [h.Class('workbench-sidebar-heading')],
            [
              ...(!model.sidebarCollapsed
                ? [
                    h.div(
                      [],
                      [
                        h.p([h.Class('workbench-eyebrow')], ['FOLDKIT ZLOZ']),
                        h.h1([], ['Workflow patterns']),
                      ],
                    ),
                  ]
                : []),
              h.button(
                [
                  h.Type('button'),
                  h.Class('workbench-sidebar-toggle'),
                  h.AriaLabel(model.sidebarCollapsed ? 'Show controls' : 'Hide controls'),
                  h.AriaExpanded(!model.sidebarCollapsed),
                  h.AriaControls('workbench-sidebar-content'),
                  h.OnClick(Message.ClickedWorkbenchSidebar()),
                ],
                [model.sidebarCollapsed ? '☰' : '‹'],
              ),
            ],
          ),
          ...(model.sidebarCollapsed
            ? [
                flowViewportControl(
                  h,
                  viewportControlActions(model.editor).fitView,
                  (event) => Message.ObservedFlowInput({ message: event }),
                  [h.Class('workbench-rail-fit')],
                  ['Fit'],
                ),
              ]
            : []),
          h.div(
            [
              h.Id('workbench-sidebar-content'),
              h.Class('workbench-sidebar-content'),
              h.Style({ display: model.sidebarCollapsed ? 'none' : 'flex' }),
            ],
            [
              h.div([h.Class('workbench-theme')], [theme]),
              h.nav(
                [h.Class('workbench-sections'), h.AriaLabel('Workbench sections')],
                sections.map(([section, label]) =>
                  h.button(
                    [
                      h.Key(section),
                      h.Type('button'),
                      h.AriaPressed(String(model.sidebarSection === section)),
                      h.AriaControls(`workbench-${section}`),
                      h.OnClick(Message.SelectedWorkbenchSection({ section })),
                    ],
                    [label],
                  ),
                ),
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
      h.section([h.Class('workbench-canvas'), h.AriaLabel('Diagram canvas')], [parts.canvas]),
    ],
  );
}
