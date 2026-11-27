import type { EditorEvent } from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';

import { Message } from './message';
import {
  PortAnchorPreset,
  PortSnapPriority,
  ReconnectLock,
  ReconnectionSnap,
  type Model,
} from './model';
import { architectureNativePanel } from './native-panel';
import { settingCheckbox } from './native-settings';
import { currentPreset } from './port-presets';

const isReconnectLock = Schema.is(ReconnectLock);
const isReconnectionSnap = Schema.is(ReconnectionSnap);
const isSnapPriority = Schema.is(PortSnapPriority);
const isAnchorPreset = Schema.is(PortAnchorPreset);

export const nativePortSettings = architectureNativePanel<Model>((h, model, request) => {
  const { editor } = model;
  const busy = editor.gesture.type !== 'idle';
  const observed = (message: EditorEvent) =>
    Message.ObservedModelInput({
      modelId: model.modelIdentity.id,
      epoch: model.modelEpoch,
      message,
    });
  const check = (
    label: string,
    checked: boolean,
    message: Message,
    disabled = false,
    fieldClass = 'workbench-field',
  ) =>
    h.label
      .class(fieldClass)
      .children(settingCheckbox(h, checked, request(message), disabled), label);
  const select = <A extends string>(
    label: string,
    current: string,
    choices: readonly (readonly [string, string])[],
    accepts: (value: string) => value is A,
    changed: (value: A) => Message,
    disabled = false,
    accessibleLabel = label,
  ) =>
    h.label.class('workbench-field').children(
      label,
      h.select
        .attr('aria-label', accessibleLabel)
        .disabled(disabled)
        .on('change', ({ value }) => (accepts(value) ? request(changed(value)) : undefined))
        .children(
          ...choices.map(([value, name]) =>
            h.option
              .key(value)
              .attr('value', value)
              .selected(current === value)
              .disabled(!accepts(value))
              .children(name),
          ),
        ),
    );
  const hysteresis = editor.connectionSnapHysteresis ?? 0;
  return h.div.children(
    select(
      'Draft → Review reconnection',
      model.reconnectLock,
      [
        ['none', 'Both ends enabled'],
        ['source', 'Source locked'],
        ['target', 'Target locked'],
        ['both', 'Both ends locked'],
      ],
      isReconnectLock,
      (reconnectLock) => Message.SelectedReconnectLock({ reconnectLock }),
      false,
      'Draft to Review reconnection',
    ),
    h.button
      .attr('type', 'button')
      .attr('aria-pressed', String(model.snapConnections))
      .on('click', request(Message.ClickedConnectionSnap()))
      .children('Snap new connections'),
    select(
      'Reconnection snap radius',
      model.reconnectionSnap,
      [
        ['match', 'Match new connections'],
        ['exact', 'Exact ports only'],
        ['wide', '48 px radius'],
      ],
      isReconnectionSnap,
      (reconnectionSnap) => Message.SelectedReconnectionSnap({ reconnectionSnap }),
    ),
    check(
      'Stable port snapping (12 px)',
      hysteresis > 0,
      observed({
        type: 'ConnectionSnapHysteresisChanged',
        distance: hysteresis ? 0 : 12,
      }),
      busy,
    ),
    check('Port labels', model.portLabels, Message.ClickedPortLabels()),
    check('Drag port anchors', model.portAnchorHandles, Message.ClickedPortAnchorHandles(), busy),
    check(
      'Snap port anchors to edges',
      (editor.portAnchorSnapDistance ?? 0) > 0,
      Message.ClickedPortAnchorSnap(),
      busy,
    ),
    check(
      'Snap port anchors to corners',
      (editor.portAnchorCornerSnapDistance ?? 0) > 0,
      Message.ClickedPortAnchorCornerSnap(),
      busy,
    ),
    check(
      'Snap port anchors to midpoints',
      (editor.portAnchorMidpointSnapDistance ?? 0) > 0,
      Message.ClickedPortAnchorMidpointSnap(),
      busy,
    ),
    check(
      'Stable port anchor snapping',
      (editor.portAnchorSnapHysteresis ?? 0) > 0,
      Message.ClickedPortAnchorSnapHysteresis(),
      busy,
    ),
    check(
      'Alt bypasses port snapping',
      model.portAnchorSnapBypass,
      Message.ClickedPortAnchorSnapBypass(),
      busy,
    ),
    check('Per-port snapping rules', model.perPortSnapping, Message.ClickedPerPortSnapping(), busy),
    model.perPortSnapping
      ? h.p.children(
          'Review input: midpoints. Review output: corners. Draft output: free placement. Other ports inherit editor settings.',
        )
      : null,
    check('Custom port sockets', model.customPorts, Message.ClickedCustomPorts()),
    check(
      'Visible socket reasons',
      model.socketReasonBadges,
      Message.ClickedSocketReasonBadges(),
      !model.customPorts,
      '',
    ),
    check(
      'Apply fixture socket policies',
      model.mixedPortProtection,
      Message.ClickedMixedPortProtection(),
      false,
      '',
    ),
    check(
      'Restricted snap targets',
      model.restrictedSnapTargets,
      Message.ClickedRestrictedSnapTargets(),
      busy,
    ),
    model.restrictedSnapTargets
      ? h.p.children(
          'Review input: left/right midpoints only. Review output: top edge and upper corners. Other ports keep their current rules.',
        )
      : null,
    check('Port snap guides', model.portAnchorGuides, Message.ClickedPortAnchorGuides()),
    check(
      'Custom snap guides',
      model.customPortAnchorGuides,
      Message.ClickedCustomPortAnchorGuides(),
    ),
    select(
      'Port snap priority',
      editor.portAnchorSnapPriority ?? 'corners-first',
      [
        ['corners-first', 'Corners first'],
        ['midpoints-first', 'Midpoints first'],
      ],
      isSnapPriority,
      (priority) => Message.SelectedPortAnchorSnapPriority({ priority }),
      busy,
    ),
    check(
      'Overlapping port snap zones',
      model.overlappingPortSnaps,
      Message.ClickedOverlappingPortSnaps(),
      busy,
    ),
    model.overlappingPortSnaps
      ? h.p.children(
          'Overlap demo takes precedence for Review ports: input inherits the selected priority; output keeps corners first. Other ports keep their current rules.',
        )
      : null,
    check('Keyboard snap targets', model.keyboardPortTargets, Message.ClickedKeyboardPortTargets()),
    model.keyboardPortTargets
      ? h.p.children(
          'Focus a port position handle. Page Down/Up cycle targets; Home/End choose first/last. Arrow keys keep precise nudging. Each position change is undoable.',
        )
      : null,
    select(
      'Port anchors',
      currentPreset(editor.graph),
      [
        ['cardinal', 'Cardinal'],
        ['diagonal', 'Diagonal · circle perimeter'],
        ['custom', 'Custom document positions'],
      ],
      isAnchorPreset,
      (preset) => Message.SelectedPortAnchors({ preset }),
      editor.readOnly || busy || editor.graph.nodes.every((node) => node.ports.length === 0),
    ),
    h.fieldset
      .style({ margin: '12px 0', padding: '8px 12px', border: '1px solid currentColor' })
      .children(
        h.legend.children('Port connections'),
        ...(
          [
            ['draftOutput', 'Lock Draft output'],
            ['publishInput', 'Lock Publish input'],
          ] as const
        ).map(([port, label]) =>
          h.label
            .key(port)
            .style({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginRight: '16px',
            })
            .children(
              settingCheckbox(h, model.portLocks[port], request(Message.ClickedPortLock({ port }))),
              label,
            ),
        ),
      ),
  );
});
