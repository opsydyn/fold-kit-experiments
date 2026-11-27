import { defaultFitViewPadding, defaultZoomLimits, type EditorEvent } from '@opsydyn/foldkit-zloz';
import { viewportControl, viewportControlActions } from '@opsydyn/foldkit-zloz/effect-ui';
import { resolveZlozDiagnostics } from '@opsydyn/foldkit-zloz/foldkit';
import { Schema } from 'effect';

import { Message } from './message';
import { NavigationDesign, WheelNavigation, type Model } from './model';
import { architectureNativePanel } from './native-panel';

type NavigationState = Pick<
  Model,
  | 'editor'
  | 'modelIdentity'
  | 'modelEpoch'
  | 'navigationDesign'
  | 'minimalMode'
  | 'diagnostics'
  | 'diagnosticsEnabled'
>;
type NavigationSettings = NavigationState &
  Pick<Model, 'wheelNavigation' | 'doubleClickZoom' | 'spaceToPan' | 'middleButtonPan'>;

function observed(model: NavigationState, message: EditorEvent): Message {
  return Message.ObservedModelInput({
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
    message,
  });
}

export const nativeViewportControls = architectureNativePanel<NavigationState>(
  'ArchitectureViewportControls',
  Schema.is(Message.cases.ObservedModelInput),
  (h, model, request) => {
    const { editor } = model;
    const actions = viewportControlActions(editor);
    const compact = model.navigationDesign === 'compact';
    const diagnostics = resolveZlozDiagnostics({
      minimalMode: model.minimalMode,
      diagnostics: model.diagnosticsEnabled ? model.diagnostics : false,
    });
    const button = (action: typeof actions.zoomIn, label = action.label) =>
      viewportControl(h, action, (event) => request(observed(model, event)))
        .style(
          compact
            ? {
                minWidth: '44px',
                minHeight: '44px',
                border: '0',
                borderRadius: '22px',
                background: action.pressed ? '#0369a1' : 'light-dark(#e0f2fe, #20384a)',
                color: action.pressed ? '#fff' : 'light-dark(#0c4a6e, #bde7ff)',
                padding: '0 16px',
                cursor: 'pointer',
              }
            : {
                minHeight: '44px',
                padding: '0 12px',
                color: action.pressed
                  ? 'var(--flow-control-color, #fff)'
                  : 'var(--flow-node-color, #172033)',
                background: action.pressed
                  ? 'var(--flow-selection, #2563eb)'
                  : 'var(--flow-node-background, #fff)',
                border: '1px solid var(--flow-canvas-border, #94a3b8)',
                borderRadius: '6px',
              },
        )
        .children(label);
    return h.div
      .attr('role', compact ? 'navigation' : 'group')
      .attr('aria-label', 'Viewport controls')
      .class(compact ? 'compact-navigation' : '')
      .style({
        display: 'flex',
        gap: compact ? '6px' : '8px',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: '8px',
      })
      .children(
        ...(compact
          ? [button(actions.zoomOut, '−'), button(actions.zoomIn, '+')]
          : [button(actions.zoomIn), button(actions.zoomOut)]),
        button(actions.fitView),
        button(actions.fitSelection),
        button(actions.zoomArea),
        button(actions.previousView),
        button(actions.selectionMode),
        diagnostics.zoomLevel
          ? h.span
              .attr('data-flow-zoom-level', '')
              .children(`${Math.round(editor.viewport.zoom * 100)}%`)
          : null,
      );
  },
);

export const nativeNavigationSettings = architectureNativePanel<NavigationSettings>(
  'ArchitectureNavigationSettings',
  Schema.is(
    Schema.Union([
      Message.cases.ObservedModelInput,
      Message.cases.SelectedNavigationDesign,
      Message.cases.SelectedWheelNavigation,
      Message.cases.ClickedDoubleClickZoom,
      Message.cases.ClickedSpaceToPan,
      Message.cases.ClickedMiddleButtonPan,
    ]),
  ),
  (h, model, request) => {
    const { editor } = model;
    const busy = editor.gesture.type !== 'idle';
    const constrained = editor.fitViewPadding === 96;
    const checkbox = (label: string, checked: boolean, message: Message, disabled = false) =>
      h.label
        .class('workbench-field')
        .children(
          h.input
            .attr('type', 'checkbox')
            .checked(checked)
            .disabled(disabled)
            .on('click', request(message)),
          label,
        );
    const select = (
      label: string,
      current: string,
      options: readonly (readonly [string, string])[],
      changed: (value: string) => Message,
      disabled = false,
    ) =>
      h.label.class('workbench-field').children(
        label,
        h.select
          .attr('aria-label', label)
          .disabled(disabled)
          .style({ padding: '8px' })
          .on('change', ({ value }) => request(changed(value)))
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
    return h.div(
      select(
        'Box selection match',
        editor.boxSelectionMatch,
        [
          ['full', 'Full containment'],
          ['partial', 'Partial overlap'],
        ],
        (value) =>
          observed(model, {
            type: 'BoxSelectionMatchChanged',
            match: Schema.decodeUnknownSync(Schema.Literals(['full', 'partial']))(value),
          }),
        busy,
      ),
      select(
        'Navigation design',
        model.navigationDesign,
        [
          ['standard', 'Standard'],
          ['compact', 'Compact · framed overview'],
        ],
        (value) =>
          Message.SelectedNavigationDesign({
            navigationDesign: Schema.decodeUnknownSync(NavigationDesign)(value),
          }),
      ),
      select(
        'Wheel navigation',
        model.wheelNavigation,
        [
          ['zoom', 'Scroll to zoom'],
          ['pan', 'Scroll to pan · Ctrl/Command to zoom'],
          ['off', 'Page scrolling'],
        ],
        (value) =>
          Message.SelectedWheelNavigation({
            wheelNavigation: Schema.decodeUnknownSync(WheelNavigation)(value),
          }),
      ),
      checkbox('Double-click zoom', model.doubleClickZoom, Message.ClickedDoubleClickZoom()),
      checkbox('Space-drag to pan', model.spaceToPan, Message.ClickedSpaceToPan()),
      checkbox('Middle-drag to pan', model.middleButtonPan, Message.ClickedMiddleButtonPan()),
      checkbox(
        'Constrain camera (75–130% zoom, 96 px fit padding)',
        constrained,
        observed(model, {
          type: 'ViewportConstraintsChanged',
          zoomLimits: constrained ? defaultZoomLimits : { minZoom: 0.75, maxZoom: 1.3 },
          fitViewPadding: constrained ? defaultFitViewPadding : 96,
        }),
        busy,
      ),
      checkbox(
        'Animate Fit view',
        editor.fitViewDuration > 0,
        observed(model, {
          type: 'FitViewDurationChanged',
          duration: editor.fitViewDuration === 0 ? 400 : 0,
        }),
      ),
    );
  },
);

export const nativeMiniMapControls = architectureNativePanel<NavigationState>(
  'ArchitectureOverviewSettings',
  Schema.is(
    Schema.Union([Message.cases.ClickedDiagnostic, Message.cases.SelectedWorkbenchSection]),
  ),
  (h, model, request) => {
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
      h.label.class('workbench-field').children(
        h.input
          .attr('type', 'checkbox')
          .attr('aria-describedby', 'workbench-mini-map-help')
          .checked(model.diagnostics.overview)
          .disabled(masked || busy)
          .on('click', request(Message.ClickedDiagnostic({ diagnostic: 'overview' }))),
        'Mini map',
      ),
      h.p.id('workbench-mini-map-help').children(help),
      masked
        ? h.button
            .attr('type', 'button')
            .on('click', request(Message.SelectedWorkbenchSection({ section: 'diagnostics' })))
            .children('Open diagnostics')
        : null,
    );
  },
);
