import { Component, Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Effect, Schema, Stream } from 'effect';

import { Message } from './message';
import {
  AlignmentGuideDesign,
  CanvasCopyDesign,
  ConnectionDesign,
  ConnectionListDesign,
  ContextMenuDesign,
  EdgeDesign,
  EdgeLabelDesign,
  EdgeToolbarDesign,
  NodeDesign,
  NodeToolbarDesign,
  ResizeReadoutDesign,
  SelectionMarqueeDesign,
  WaypointDesign,
  type Model,
} from './model';
import { architectureNativePanel } from './native-panel';

// Let the browser acknowledge activation immediately while the parent processes the message.
const syncChecked = Mount.make(
  'ArchitectureSettingChecked',
  { args: { checked: Schema.Boolean } },
  (input: HTMLInputElement, _, changes) =>
    Stream.runForEach(changes, ({ checked }) =>
      Effect.sync(() => {
        input.checked = checked;
      }),
    ).pipe(Effect.map(() => Component.noop)),
);

function settingCheckbox<M>(h: Html.H<M>, checked: boolean, changed: M, disabled = false) {
  return h.input
    .attr('type', 'checkbox')
    .attr('checked', checked ? '' : undefined)
    .disabled(disabled)
    .onMount(syncChecked({ checked }))
    .on('change', changed);
}

type Appearance = Pick<
  Model,
  | 'contextMapPresentation'
  | 'nodeDesign'
  | 'edgeDesign'
  | 'edgeLabelDesign'
  | 'nodeToolbarDesign'
  | 'edgeToolbarDesign'
  | 'waypointDesign'
  | 'protectWaypointEdits'
  | 'contextMenuDesign'
  | 'connectionListDesign'
  | 'resizeReadoutDesign'
  | 'alignmentGuideDesign'
  | 'selectionMarqueeDesign'
  | 'canvasCopyDesign'
  | 'connectionDesign'
>;

const acceptsAppearance = Schema.is(
  Schema.Union([
    Message.cases.ClickedContextMapPresentation,
    Message.cases.SelectedNodeDesign,
    Message.cases.SelectedEdgeDesign,
    Message.cases.SelectedEdgeLabelDesign,
    Message.cases.SelectedNodeToolbarDesign,
    Message.cases.SelectedEdgeToolbarDesign,
    Message.cases.SelectedWaypointDesign,
    Message.cases.ClickedWaypointProtection,
    Message.cases.SelectedContextMenuDesign,
    Message.cases.SelectedConnectionListDesign,
    Message.cases.SelectedResizeReadoutDesign,
    Message.cases.SelectedAlignmentGuideDesign,
    Message.cases.SelectedSelectionMarqueeDesign,
    Message.cases.SelectedCanvasCopyDesign,
    Message.cases.SelectedConnectionDesign,
  ]),
);

export const nativeAppearanceSettings = architectureNativePanel<Appearance>(
  'ArchitectureAppearanceSettings',
  acceptsAppearance,
  (h, model, request) => {
    const select = <A extends string>(
      label: string,
      isValue: (value: string) => value is A,
      current: NoInfer<A>,
      options: readonly (readonly [NoInfer<A>, string])[],
      changed: (value: NoInfer<A>) => Message,
    ) =>
      h.label.class('workbench-field').children(
        label,
        h.select
          .attr('aria-label', label)
          .on('change', ({ value }) => (isValue(value) ? request(changed(value)) : undefined))
          .children(
            ...options.map(([value, label]) =>
              h.option
                .key(value)
                .attr('value', value)
                .selected(value === current)
                .children(label),
            ),
          ),
      );
    const checkbox = (label: string, checked: boolean, message: Message, css: string) =>
      h.label.class(css).children(settingCheckbox(h, checked, request(message)), label);
    return h.div.children(
      checkbox(
        'Context-map presentation',
        model.contextMapPresentation,
        Message.ClickedContextMapPresentation(),
        'workbench-field',
      ),
      select(
        'Node design',
        Schema.is(NodeDesign),
        model.nodeDesign,
        [
          ['cards', 'Cards'],
          ['c4', 'C4 · package presets'],
          ['event-storming', 'Event-storming · package notes'],
          ['ddd', 'DDD · package presets'],
          ['orbits', 'Orbits · custom SVG shells'],
        ],
        (nodeDesign) => Message.SelectedNodeDesign({ nodeDesign }),
      ),
      select(
        'Edge design',
        Schema.is(EdgeDesign),
        model.edgeDesign,
        [
          ['default', 'Default'],
          ['raised', 'Raised arcs'],
        ],
        (edgeDesign) => Message.SelectedEdgeDesign({ edgeDesign }),
      ),
      select(
        'Edge labels',
        Schema.is(EdgeLabelDesign),
        model.edgeLabelDesign,
        [
          ['standard', 'Standard'],
          ['badge', 'Badge and inline editor'],
        ],
        (edgeLabelDesign) => Message.SelectedEdgeLabelDesign({ edgeLabelDesign }),
      ),
      select(
        'Node toolbar',
        Schema.is(NodeToolbarDesign),
        model.nodeToolbarDesign,
        [
          ['off', 'Off'],
          ['standard', 'Standard'],
          ['compact', 'Compact · below node'],
        ],
        (nodeToolbarDesign) => Message.SelectedNodeToolbarDesign({ nodeToolbarDesign }),
      ),
      select(
        'Edge actions',
        Schema.is(EdgeToolbarDesign),
        model.edgeToolbarDesign,
        [
          ['standard', 'Standard'],
          ['compact', 'Compact · path and delete'],
        ],
        (edgeToolbarDesign) => Message.SelectedEdgeToolbarDesign({ edgeToolbarDesign }),
      ),
      select(
        'Waypoint controls',
        Schema.is(WaypointDesign),
        model.waypointDesign,
        [
          ['off', 'off'],
          ['native', 'native'],
          ['custom', 'custom'],
        ],
        (waypointDesign) => Message.SelectedWaypointDesign({ waypointDesign }),
      ),
      checkbox(
        'Protect bend editing',
        model.protectWaypointEdits,
        Message.ClickedWaypointProtection(),
        'workbench-check',
      ),
      select(
        'Context menus',
        Schema.is(ContextMenuDesign),
        model.contextMenuDesign,
        [
          ['standard', 'Standard'],
          ['panel', 'Custom action panel'],
        ],
        (contextMenuDesign) => Message.SelectedContextMenuDesign({ contextMenuDesign }),
      ),
      select(
        'Connection list layout',
        Schema.is(ConnectionListDesign),
        model.connectionListDesign,
        [
          ['standard', 'Standard'],
          ['rows', 'Connection rows'],
        ],
        (connectionListDesign) => Message.SelectedConnectionListDesign({ connectionListDesign }),
      ),
      select(
        'Resize readout',
        Schema.is(ResizeReadoutDesign),
        model.resizeReadoutDesign,
        [
          ['standard', 'Standard'],
          ['labeled', 'Labeled dimensions'],
        ],
        (resizeReadoutDesign) => Message.SelectedResizeReadoutDesign({ resizeReadoutDesign }),
      ),
      select(
        'Alignment guide design',
        Schema.is(AlignmentGuideDesign),
        model.alignmentGuideDesign,
        [
          ['standard', 'Standard'],
          ['endpoints', 'Solid with endpoints'],
        ],
        (alignmentGuideDesign) => Message.SelectedAlignmentGuideDesign({ alignmentGuideDesign }),
      ),
      select(
        'Selection marquee',
        Schema.is(SelectionMarqueeDesign),
        model.selectionMarqueeDesign,
        [
          ['standard', 'Standard'],
          ['hatched', 'Hatched outline'],
        ],
        (selectionMarqueeDesign) =>
          Message.SelectedSelectionMarqueeDesign({ selectionMarqueeDesign }),
      ),
      select(
        'Canvas help and status',
        Schema.is(CanvasCopyDesign),
        model.canvasCopyDesign,
        [
          ['standard', 'Standard'],
          ['card', 'Help card and status badge'],
        ],
        (canvasCopyDesign) => Message.SelectedCanvasCopyDesign({ canvasCopyDesign }),
      ),
      select(
        'Connection preview',
        Schema.is(ConnectionDesign),
        model.connectionDesign,
        [
          ['dashed', 'Dashed'],
          ['ribbon', 'Ribbon'],
          ['hidden', 'Hidden'],
        ],
        (connectionDesign) => Message.SelectedConnectionDesign({ connectionDesign }),
      ),
    );
  },
);

type Diagnostics = Pick<
  Model,
  | 'minimalMode'
  | 'viewportCulling'
  | 'retainNodeViews'
  | 'showWorldAnnotation'
  | 'diagnosticsPanelOpen'
  | 'diagnosticsEnabled'
  | 'diagnostics'
> &
  Readonly<{ busy: boolean }>;

const diagnosticOptions = [
  ['measurements', 'Measurements'],
  ['alignmentGuides', 'Alignment guides'],
  ['zoomLevel', 'Zoom percentage'],
  ['status', 'Visible status'],
  ['instructions', 'Instructions'],
  ['connectionList', 'Connection list'],
] as const;

const acceptsDiagnostics = Schema.is(
  Schema.Union([
    Message.cases.ClickedMinimalMode,
    Message.cases.ClickedViewportCulling,
    Message.cases.ClickedRetainNodeViews,
    Message.cases.ClickedWorldAnnotation,
    Message.cases.ClickedDiagnosticsEnabled,
    Message.cases.ClickedDiagnostic,
  ]),
);

export const nativeDiagnosticSettings = architectureNativePanel<Diagnostics>(
  'ArchitectureDiagnosticSettings',
  acceptsDiagnostics,
  (h, model, request) => {
    const toggle = (
      label: string,
      checked: boolean,
      message: Message,
      disabled = false,
      title?: string,
    ) =>
      h.button
        .attr('type', 'button')
        .attr('aria-pressed', String(checked))
        .attr('title', title)
        .disabled(disabled)
        .on('click', request(message))
        .children(label);
    const checkbox = (label: string, checked: boolean, message: Message, disabled: boolean) =>
      h.label.children(settingCheckbox(h, checked, request(message), disabled), label);
    const diagnosticsDisabled = model.minimalMode || model.busy;
    return h.div.children(
      h.div
        .attr('role', 'group')
        .attr('aria-label', 'Presentation')
        .style({ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' })
        .children(
          toggle('Minimal mode', model.minimalMode, Message.ClickedMinimalMode(), model.busy),
          toggle(
            'Viewport culling',
            model.viewportCulling,
            Message.ClickedViewportCulling(),
            model.busy,
          ),
          toggle(
            'Retain node views',
            model.retainNodeViews,
            Message.ClickedRetainNodeViews(),
            false,
            'Retain built-in bodies; port protections and custom ports stay live.',
          ),
          toggle('World annotation', model.showWorldAnnotation, Message.ClickedWorldAnnotation()),
        ),
      model.diagnosticsPanelOpen
        ? h.div
            .attr('role', 'group')
            .attr('aria-label', 'Diagnostic options')
            .style({ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' })
            .children(
              checkbox(
                'Show diagnostics',
                model.diagnosticsEnabled,
                Message.ClickedDiagnosticsEnabled(),
                diagnosticsDisabled,
              ),
              ...diagnosticOptions.map(([diagnostic, label]) =>
                checkbox(
                  label,
                  model.diagnostics[diagnostic],
                  Message.ClickedDiagnostic({ diagnostic }),
                  diagnosticsDisabled || !model.diagnosticsEnabled,
                ),
              ),
              h.p.children(
                'Minimal mode and the global switch override individual flags; stored choices return when re-enabled.',
              ),
            )
        : null,
    );
  },
);
