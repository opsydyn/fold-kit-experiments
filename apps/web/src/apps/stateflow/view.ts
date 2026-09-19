import { layoutStateFlow } from '@opsydyn/foldkit-viz/stateflow';
import type {
  StateFlowEdge,
  StateFlowGraph,
  StateFlowLayout,
  StateFlowLayoutEdge,
  StateFlowLayoutNode,
} from '@opsydyn/foldkit-viz/stateflow';
import { Match, Option, Schema } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { svgRoot } from '../../ui/shared';
import { fixture } from './fixture';
import { graphFor } from './graph';
import { Message } from './message';
import type { Model, TransitionFact } from './model';
import { TransitionRecorded } from './ports';

import * as styles from './stateflow.css';

const guardLabel = (edge: StateFlowEdge): string =>
  Match.value(edge.guard).pipe(
    Match.when('unguarded', () => 'unguarded'),
    Match.orElse((guard) => `${guard} #${edge.guardPosition ?? 0}`),
  );

const isTransitioned = (record: TransitionFact): boolean =>
  Match.value(record.outcome).pipe(
    Match.when('transitioned', () => true),
    Match.orElse(() => false),
  );

const matchesEdge = (record: TransitionFact, edge: StateFlowEdge): boolean =>
  [
    isTransitioned(record),
    record.from === edge.source,
    record.target === edge.target,
    record.messageTag === edge.event,
  ].every(Boolean);

const textWhen = (condition: boolean, whenTrue: string, whenFalse = ''): string =>
  Match.value(condition).pipe(
    Match.when(true, () => whenTrue),
    Match.orElse(() => whenFalse),
  );

const activation =
  (message: Message) =>
  (key: string): Option.Option<Message> =>
    Match.value(key).pipe(
      Match.whenOr('Enter', ' ', () => Option.some(message)),
      Match.orElse(() => Option.none()),
    );

const encodeEvent = Schema.encodeSync(Schema.fromJsonString(TransitionRecorded, { space: 2 }));

const edgePair = (edge: StateFlowEdge): string => [edge.source, edge.target].sort().join(':');

const edgeCaption = (edge: StateFlowEdge, index: number): string =>
  `${index + 1} · ${guardLabel(edge)}`;

function edgeLabelPosition(edge: StateFlowLayoutEdge, edges: ReadonlyArray<StateFlowLayoutEdge>) {
  const pair = edgePair(edge);
  const peers = edges.filter((candidate) => edgePair(candidate) === pair);
  const lane = peers.findIndex((candidate) => candidate.id === edge.id) - (peers.length - 1) / 2;
  const dx = edge.x2 - edge.x1;
  const dy = edge.y2 - edge.y1;
  const distance = Math.hypot(dx, dy) || 1;
  const direction = Match.value(edge.source < edge.target).pipe(
    Match.when(true, () => 1),
    Match.orElse(() => -1),
  );
  const nx = (-dy / distance) * direction;
  const ny = (dx / distance) * direction;
  const maxWidth = Math.max(
    ...peers.map(
      (candidate) =>
        edgeCaption(
          candidate,
          edges.findIndex((item) => item.id === candidate.id),
        ).length * 7,
    ),
  );
  // Use one normal for both directions, reserving the full label width and line height.
  const spacing = Math.abs(nx) * (maxWidth + 16) + Math.abs(ny) * 28;
  return {
    x: (edge.x1 + edge.x2) / 2 + nx * lane * spacing,
    y: (edge.y1 + edge.y2) / 2 + ny * lane * spacing,
  };
}

type EdgeLabel = Readonly<{ x: number; y: number; width: number }>;

const labelsOverlap = (a: EdgeLabel, b: EdgeLabel): boolean =>
  [Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 8, Math.abs(a.y - b.y) < 24].every(Boolean);

function edgeLabels(layout: StateFlowLayout): ReadonlyArray<EdgeLabel> {
  const placed: EdgeLabel[] = [];
  for (const [index, edge] of layout.edges.entries()) {
    const preferred = edgeLabelPosition(edge, layout.edges);
    const width = edgeCaption(edge, index).length * 7;
    // Search nearest positions first; pair lanes remain the preferred placement.
    const candidates = Array.from({ length: 21 }, (_, row) =>
      Array.from({ length: 21 }, (_, column) => ({
        x: preferred.x + (column - 10) * 24,
        y: preferred.y + (row - 10) * 24,
        width,
      })),
    )
      .flat()
      .sort(
        (a, b) =>
          Math.hypot(a.x - preferred.x, a.y - preferred.y) -
          Math.hypot(b.x - preferred.x, b.y - preferred.y),
      );
    const position = candidates.find((candidate) =>
      [
        candidate.x - width / 2 >= 8,
        candidate.x + width / 2 <= 892,
        candidate.y >= 24,
        candidate.y <= 608,
        placed.every((label) => !labelsOverlap(candidate, label)),
        layout.nodes.every(
          (node) =>
            ![
              Math.abs(candidate.x - node.x) < width / 2 + 58,
              Math.abs(candidate.y - node.y) < 72,
            ].every(Boolean),
        ),
      ].every(Boolean),
    );
    placed.push(Option.getOrThrow(Option.fromNullishOr(position)));
  }
  return placed;
}

function graphView(model: Model, graph: StateFlowGraph, h: HtmlBuilder<Message>): Html {
  const layout = layoutStateFlow(graph, {
    width: 900,
    height: 620,
    linkDistance: 220,
    collideRadius: 85,
    strength: -800,
  });
  const latest = model.trace.at(-1);
  const labels = edgeLabels(layout);
  function edgeView(edge: StateFlowLayoutEdge, index: number): Html {
    const record = Option.fromNullishOr(model.trace.findLast((item) => matchesEdge(item, edge)));
    const message = Option.match(record, {
      onSome: (item) => Message.SelectedTrace({ sequence: item.sequence }),
      onNone: () => Message.SelectedNode({ node: edge.source }),
    });
    const latestMatch = Option.fromNullishOr(latest).pipe(
      Option.filter((item) => matchesEdge(item, edge)),
    );
    const pulseSequence = latestMatch.pipe(
      Option.map((item) => item.sequence),
      Option.getOrElse(() => 0),
    );
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;
    const distance = Math.hypot(dx, dy) || 1;
    const ux = dx / distance;
    const uy = dy / distance;
    const labelPosition = Option.getOrThrow(Option.fromNullishOr(labels[index]));
    const cx = 2 * labelPosition.x - (edge.x1 + edge.x2) / 2;
    const cy = 2 * labelPosition.y - (edge.y1 + edge.y2) / 2;
    const endX = edge.x2 - ux * 58;
    const endY = edge.y2 - uy * 58;
    const label = `${index + 1}. ${edge.source} → ${edge.target}: ${edge.event} (${guardLabel(edge)})`;
    return h.g(
      [
        h.Key(`${edge.id}:${pulseSequence}`),
        h.Class(
          [
            styles.edge,
            textWhen(edge.transitionCount > 0, styles.visitedEdge),
            textWhen(Option.isSome(latestMatch), styles.pulse),
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
          [
            h.X(String(labelPosition.x)),
            h.Y(String(labelPosition.y - 5)),
            h.TextLength(String(edgeCaption(edge, index).length * 7)),
            h.LengthAdjust('spacingAndGlyphs'),
            h.Class(styles.edgeLabel),
          ],
          [edgeCaption(edge, index)],
        ),
      ],
    );
  }
  function nodeView(node: StateFlowLayoutNode): Html {
    const active = node.id === model.explorer._tag;
    const error = Match.value(node.id).pipe(
      Match.when('Failed', () => true),
      Match.orElse(() => false),
    );
    const status = Match.value({ active, error, visited: node.visitCount > 0 }).pipe(
      Match.when({ active: true }, () => 'active'),
      Match.when({ error: true }, () => 'error state'),
      Match.when({ visited: true }, () => 'visited'),
      Match.orElse(() => node.role),
    );
    const message = Message.SelectedNode({ node: node.id });
    return h.g(
      [
        h.Key(node.id),
        h.Transform(`translate(${node.x},${node.y})`),
        h.Class(
          [
            styles.node,
            textWhen(node.visitCount > 0, styles.visitedNode),
            textWhen(error, styles.errorNode),
            textWhen(active, styles.activeNode),
            textWhen(model.selectedNode === node.id, styles.selectedNode),
          ].join(' '),
        ),
        h.Role('button'),
        h.Tabindex(0),
        h.AriaLabel(`Select state ${node.label}`),
        h.AriaPressed(textWhen(model.selectedNode === node.id, 'true', 'false')),
        h.OnClick(message),
        h.OnKeyDownPreventDefault(activation(message)),
      ],
      [
        h.circle(
          [
            h.R('54'),
            h.Fill('#171e28'),
            h.Stroke('currentColor'),
            h.StrokeWidth(textWhen(active, '3', '1.5')),
          ],
          [],
        ),
        h.text([h.Y('-3'), h.Class(styles.nodeLabel)], [node.label]),
        h.text([h.Y('17'), h.Class(styles.nodeStatus)], [status]),
      ],
    );
  }

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
        [...layout.edges.map(edgeView), ...layout.nodes.map(nodeView)],
      ),
    ],
  );
}

function inspectorView(model: Model, graph: StateFlowGraph, h: HtmlBuilder<Message>): Html {
  const selected = Option.fromNullishOr(
    model.trace.find((record) => record.sequence === model.selectedSequence),
  );
  function eventDetails(record: TransitionFact): ReadonlyArray<Html> {
    const edges = graph.edges.filter((edge) => matchesEdge(record, edge));
    const guards = Option.fromNullishOr(edges.map(guardLabel).join(', ') || undefined);
    return [
      h.p([h.Class(styles.eventName)], [`#${record.sequence} ${record.messageTag}`]),
      h.p([], [`${record.from} → ${record.target ?? '—'}`]),
      h.p([], [`Outcome: ${record.outcome}`]),
      h.p([], [`Guard: ${Option.getOrElse(guards, () => 'not recorded')}`]),
      h.p([], [`Reason: ${record.reason ?? '—'}`]),
      h.h3([h.Class(styles.sectionHeading)], ['Command names']),
      h.p([], [record.commandNames.join(', ') || 'None']),
      h.h3([h.Class(styles.sectionHeading)], ['Structured event data']),
      h.p(
        [h.Class(styles.muted)],
        ['Redacted transition facts; original payload is not retained.'],
      ),
      h.pre([h.Class(styles.eventData)], [encodeEvent(record)]),
    ];
  }
  return h.section(
    [h.Class(styles.inspector), h.AriaLabel('Selected trace inspector'), h.Tabindex(0)],
    [
      h.h2([h.Class(styles.sectionHeading)], ['Event inspector']),
      ...Option.match(selected, {
        onSome: eventDetails,
        onNone: () => [
          h.p([h.Class(styles.muted)], ['Select an event to inspect its recorded facts.']),
        ],
      }),
    ],
  );
}

function eventRow(model: Model, record: TransitionFact, h: HtmlBuilder<Message>): Html {
  const related = [record.from, record.target].includes(model.selectedNode ?? '');
  return h.tr(
    [
      h.Key(String(record.sequence)),
      h.Attribute('data-related', String(related)),
      h.Class(textWhen(related, styles.relatedRow)),
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
              h.AriaPressed(textWhen(record.sequence === model.selectedSequence, 'true', 'false')),
              h.OnClick(Message.SelectedTrace({ sequence: record.sequence })),
            ],
            [record.messageTag],
          ),
        ],
      ),
      ...[record.from, record.outcome, record.target ?? '—', record.reason ?? '—'].map((value) =>
        h.td([], [value]),
      ),
    ],
  );
}

const timelineView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class(styles.timeline), h.AriaLabel('Recent events')],
    [
      h.h2([h.Class(styles.sectionHeading)], ['Recent events']),
      h.p(
        [h.Class(styles.muted)],
        [
          Option.match(Option.fromNullishOr(model.selectedNode), {
            onSome: (node) => `Related events highlighted: ${node}`,
            onNone: () => 'Select a state to highlight related events.',
          }),
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
                model.trace.slice(-30).map((record) => eventRow(model, record, h)),
              ),
            ],
          ),
        ],
      ),
      ...Match.value(model.trace.length).pipe(
        Match.when(0, () => [
          h.p([h.Class(styles.muted)], ['No events yet. Step or play the replay session.']),
        ]),
        Match.orElse(() => []),
      ),
    ],
  );

export function view(model: Model, h: HtmlBuilder<Message>): Document {
  const graph = graphFor(model);
  const transitions = model.trace.filter(isTransitioned).length;
  const playing = Match.value(model.playback).pipe(
    Match.when('playing', () => true),
    Match.orElse(() => false),
  );
  const telemetryLabel = Option.match(Option.fromNullishOr(model.lastTelemetrySequence), {
    onNone: () => 'Outbound Port: no emission recorded',
    onSome: (sequence) => `Outbound Port: emitted #${sequence}`,
  });
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
                      playing || model.replayIndex >= fixture.length,
                    ),
                    control('Pause', Message.ClickedPause(), !playing),
                    control(
                      'Step',
                      Message.ClickedStep(),
                      playing || model.replayIndex >= fixture.length,
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
                h.p([], [telemetryLabel]),
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
}
