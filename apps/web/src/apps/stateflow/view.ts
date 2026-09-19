import { layoutStateFlow } from '@opsydyn/foldkit-viz/stateflow';
import type { StateFlowEdge, StateFlowGraph } from '@opsydyn/foldkit-viz/stateflow';
import { Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { svgRoot } from '../../ui/shared';
import { fixture } from './fixture';
import { graphFor } from './graph';
import { Message } from './message';
import type { Model, TransitionFact } from './model';

import * as styles from './stateflow.css';

const guardLabel = (edge: StateFlowEdge): string =>
  edge.guard === 'unguarded' ? 'unguarded' : `${edge.guard} #${edge.guardPosition ?? 0}`;

const matchesEdge = (record: TransitionFact, edge: StateFlowEdge): boolean =>
  record.outcome === 'transitioned' &&
  record.from === edge.source &&
  record.target === edge.target &&
  record.messageTag === edge.event;

const activation =
  (message: Message) =>
  (key: string): Option.Option<Message> =>
    key === 'Enter' || key === ' ' ? Option.some(message) : Option.none();

const graphView = (model: Model, graph: StateFlowGraph, h: HtmlBuilder<Message>): Html => {
  const layout = layoutStateFlow(graph, {
    width: 900,
    height: 620,
    linkDistance: 220,
    collideRadius: 85,
    strength: -800,
  });
  const latest = model.trace.at(-1);
  return h.div(
    [h.Class(styles.graphScroll)],
    [
      svgRoot(
        h,
        {
          width: 900,
          height: 620,
          interactive: true,
          ariaLabel: 'Request diagnostics state graph',
          ariaDescription:
            'Select a state to highlight related events. Tab reaches states and recorded transitions; Enter or Space selects. Edge numbers refer to the transition key below.',
          style: { 'min-width': '680px' },
        },
        null,
        [
          ...layout.edges.map((edge, index) => {
            const record = model.trace.findLast((item) => matchesEdge(item, edge));
            const message = record
              ? Message.SelectedTrace({ sequence: record.sequence })
              : Message.SelectedNode({ node: edge.source });
            const dx = edge.x2 - edge.x1;
            const dy = edge.y2 - edge.y1;
            const distance = Math.hypot(dx, dy) || 1;
            const ux = dx / distance;
            const uy = dy / distance;
            const offset = ((index % 3) - 1) * 18;
            const cx = (edge.x1 + edge.x2) / 2 - uy * offset;
            const cy = (edge.y1 + edge.y2) / 2 + ux * offset;
            const endX = edge.x2 - ux * 58;
            const endY = edge.y2 - uy * 58;
            const label = `${index + 1}. ${edge.source} → ${edge.target}: ${edge.event} (${guardLabel(edge)})`;
            return h.g(
              [
                h.Key(`${edge.id}:${latest && matchesEdge(latest, edge) ? latest.sequence : 0}`),
                h.Class(
                  [
                    styles.edge,
                    edge.transitionCount > 0 ? styles.visitedEdge : '',
                    latest && matchesEdge(latest, edge) ? styles.pulse : '',
                  ].join(' '),
                ),
                h.Role('button'),
                h.Tabindex(0),
                h.AriaLabel(label),
                h.OnClick(message),
                h.OnKeyDownPreventDefault(activation(message)),
              ],
              [
                h.title([], [label]),
                h.path(
                  [
                    h.D(`M${edge.x1 + ux * 58},${edge.y1 + uy * 58} Q${cx},${cy} ${endX},${endY}`),
                    h.Fill('none'),
                    h.Stroke('currentColor'),
                    h.StrokeWidth('2'),
                  ],
                  [],
                ),
                h.path(
                  [
                    h.D(
                      `M${endX - ux * 9 - uy * 4},${endY - uy * 9 + ux * 4} L${endX},${endY} L${endX - ux * 9 + uy * 4},${endY - uy * 9 - ux * 4}`,
                    ),
                    h.Fill('none'),
                    h.Stroke('currentColor'),
                    h.StrokeWidth('2'),
                  ],
                  [],
                ),
                h.text(
                  [h.X(String(cx)), h.Y(String(cy - 5)), h.Class(styles.edgeLabel)],
                  [`${index + 1} · ${guardLabel(edge)}`],
                ),
              ],
            );
          }),
          ...layout.nodes.map((node) => {
            const active = node.id === model.explorer._tag;
            const status = active
              ? 'active'
              : node.id === 'Failed'
                ? 'error state'
                : node.visitCount > 0
                  ? 'visited'
                  : node.role;
            const message = Message.SelectedNode({ node: node.id });
            return h.g(
              [
                h.Key(node.id),
                h.Transform(`translate(${node.x},${node.y})`),
                h.Class(
                  [
                    styles.node,
                    node.visitCount > 0 ? styles.visitedNode : '',
                    node.id === 'Failed' ? styles.errorNode : '',
                    active ? styles.activeNode : '',
                    model.selectedNode === node.id ? styles.selectedNode : '',
                  ].join(' '),
                ),
                h.Role('button'),
                h.Tabindex(0),
                h.AriaLabel(`Select state ${node.label}`),
                h.AriaPressed(model.selectedNode === node.id ? 'true' : 'false'),
                h.OnClick(message),
                h.OnKeyDownPreventDefault(activation(message)),
              ],
              [
                h.circle(
                  [
                    h.R('54'),
                    h.Fill('#171e28'),
                    h.Stroke('currentColor'),
                    h.StrokeWidth(active ? '3' : '1.5'),
                  ],
                  [],
                ),
                h.text([h.Y('-3'), h.Class(styles.nodeLabel)], [node.label]),
                h.text([h.Y('17'), h.Class(styles.nodeStatus)], [status]),
              ],
            );
          }),
        ],
      ),
    ],
  );
};

const inspectorView = (model: Model, graph: StateFlowGraph, h: HtmlBuilder<Message>): Html => {
  const selected = model.trace.find((record) => record.sequence === model.selectedSequence);
  const edges = selected ? graph.edges.filter((edge) => matchesEdge(selected, edge)) : [];
  return h.section(
    [h.Class(styles.inspector), h.AriaLabel('Selected trace inspector'), h.Tabindex(0)],
    [
      h.h2([h.Class(styles.sectionHeading)], ['Event inspector']),
      ...(selected
        ? [
            h.p([h.Class(styles.eventName)], [`#${selected.sequence} ${selected.messageTag}`]),
            h.p([], [`${selected.from} → ${selected.target ?? '—'}`]),
            h.p([], [`Outcome: ${selected.outcome}`]),
            h.p(
              [],
              [`Guard: ${edges.length > 0 ? edges.map(guardLabel).join(', ') : 'not recorded'}`],
            ),
            h.p([], [`Reason: ${selected.reason ?? '—'}`]),
            h.h3([h.Class(styles.sectionHeading)], ['Command names']),
            h.p([], [selected.commandNames.join(', ') || 'None']),
            h.h3([h.Class(styles.sectionHeading)], ['Structured event data']),
            h.p(
              [h.Class(styles.muted)],
              ['Redacted transition facts; original payload is not retained.'],
            ),
            h.pre([h.Class(styles.eventData)], [JSON.stringify(selected, null, 2)]),
          ]
        : [h.p([h.Class(styles.muted)], ['Select an event to inspect its recorded facts.'])]),
    ],
  );
};

const timelineView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class(styles.timeline), h.AriaLabel('Recent events')],
    [
      h.h2([h.Class(styles.sectionHeading)], ['Recent events']),
      h.p(
        [h.Class(styles.muted)],
        [
          model.selectedNode
            ? `Related events highlighted: ${model.selectedNode}`
            : 'Select a state to highlight related events.',
        ],
      ),
      h.div(
        [h.Class(styles.tableScroll)],
        [
          h.table(
            [h.Class(styles.table)],
            [
              h.thead(
                [],
                [
                  h.tr(
                    [],
                    ['Sequence', 'Event', 'From', 'Outcome', 'Target', 'Reason'].map((label) =>
                      h.th([h.Attribute('scope', 'col')], [label]),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                model.trace.slice(-30).map((record) => {
                  const related =
                    model.selectedNode !== null &&
                    (record.from === model.selectedNode || record.target === model.selectedNode);
                  return h.tr(
                    [
                      h.Key(String(record.sequence)),
                      h.Attribute('data-related', String(related)),
                      h.Class(related ? styles.relatedRow : ''),
                    ],
                    [
                      h.td([], [String(record.sequence)]),
                      h.td(
                        [],
                        [
                          h.button(
                            [
                              h.Class(styles.eventButton),
                              h.AriaLabel(`Inspect event ${record.sequence}: ${record.messageTag}`),
                              h.AriaPressed(
                                record.sequence === model.selectedSequence ? 'true' : 'false',
                              ),
                              h.OnClick(Message.SelectedTrace({ sequence: record.sequence })),
                            ],
                            [record.messageTag],
                          ),
                        ],
                      ),
                      ...[
                        record.from,
                        record.outcome,
                        record.target ?? '—',
                        record.reason ?? '—',
                      ].map((value) => h.td([], [value])),
                    ],
                  );
                }),
              ),
            ],
          ),
        ],
      ),
      ...(model.trace.length === 0
        ? [h.p([h.Class(styles.muted)], ['No events yet. Step or play the replay session.'])]
        : []),
    ],
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const graph = graphFor(model);
  const transitions = model.trace.filter((record) => record.outcome === 'transitioned').length;
  const control = (label: string, message: Message, disabled: boolean) =>
    h.button([h.Class(styles.control), h.OnClick(message), h.Disabled(disabled)], [label]);
  return {
    title: `Stateflow Observatory — ${model.explorer._tag}`,
    body: h.div(
      [h.Class(styles.root)],
      [
        h.header(
          [h.Class(styles.header)],
          [
            h.p([h.Class(styles.current)], [`Current state: ${model.explorer._tag}`]),
            h.p([], [`Transitions: ${transitions}`]),
            h.p([], [`Ignored: ${model.trace.length - transitions}`]),
            h.p([], [`Playback: ${model.playback}`]),
          ],
        ),
        h.div(
          [h.Class(styles.workspace)],
          [
            h.aside(
              [h.Class(styles.rail), h.AriaLabel('Replay and Ports')],
              [
                h.h2([h.Class(styles.sectionHeading)], ['Replay controls']),
                h.div(
                  [h.Class(styles.controls)],
                  [
                    control(
                      'Play',
                      Message.ClickedPlay(),
                      model.playback === 'playing' || model.replayIndex >= fixture.length,
                    ),
                    control('Pause', Message.ClickedPause(), model.playback === 'paused'),
                    control(
                      'Step',
                      Message.ClickedStep(),
                      model.playback === 'playing' || model.replayIndex >= fixture.length,
                    ),
                    control('Reset', Message.ClickedReset(), false),
                  ],
                ),
                h.p([], ['Replay session: Request diagnostics']),
                h.p(
                  [h.Class(styles.muted)],
                  [`Progress: ${Math.min(model.replayIndex, fixture.length)} / ${fixture.length}`],
                ),
                h.h3([h.Class(styles.sectionHeading)], ['Typed Ports']),
                h.p([], ['Inbound Port: replay input configured']),
                h.p(
                  [],
                  [
                    model.lastTelemetrySequence === null
                      ? 'Outbound Port: no emission recorded'
                      : `Outbound Port: emitted #${model.lastTelemetrySequence}`,
                  ],
                ),
                h.p(
                  [h.Class(styles.muted)],
                  ['Telemetry records command emission, not consumer delivery.'],
                ),
              ],
            ),
            h.section(
              [h.Class(styles.graph), h.AriaLabel('Machine graph')],
              [
                h.h2([h.Class(styles.sectionHeading)], ['Request diagnostics']),
                graphView(model, graph, h),
                h.details(
                  [],
                  [
                    h.summary([h.Class(styles.keySummary)], ['Transition key']),
                    h.ol(
                      [h.Class(styles.edgeKey)],
                      graph.edges.map((edge) =>
                        h.li(
                          [],
                          [`${edge.source} → ${edge.target} · ${edge.event} · ${guardLabel(edge)}`],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            inspectorView(model, graph, h),
          ],
        ),
        timelineView(model, h),
      ],
    ),
  };
};
