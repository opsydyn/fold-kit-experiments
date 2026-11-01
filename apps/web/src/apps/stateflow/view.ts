import '@opsydyn/dataset-explorer/highlighting.css';
import { highlightedCode } from '@opsydyn/dataset-explorer/highlighting';
import type {
  StateFlowEdge,
  StateFlowGraph,
  StateFlowLayoutNode,
} from '@opsydyn/foldkit-viz/stateflow';
import { Match, Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { svgRoot } from '../../ui/shared';
import { graphFor, tookEdge } from './graph';
import { nodeHalf, place } from './layered';
import type { Placed, Route } from './layered';
import { Message } from './message';
import type { Model, TransitionFact } from './model';
import { currentRecord, framesOf, specimenFor, stateTagOf, traceOf } from './replay';
import { encodeEvent } from './source';
import type { Frame, Specimen } from './specimen';
import { specimens } from './specimens';

import * as styles from './stateflow.css';

const guardLabel = (edge: Readonly<{ guard: string; guardPosition?: number }>): string =>
  Match.value(edge.guard).pipe(
    Match.when('unguarded', () => 'unguarded'),
    Match.orElse((guard) => `${guard} #${edge.guardPosition ?? 0}`),
  );

const edgeOf = (edge: StateFlowEdge) => ({
  from: edge.source,
  messageTag: edge.event,
  target: edge.target,
});

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

/** How long ago, in events, an edge last fired: its glow fades with it. */
const recencyClass = (model: Model, edge: StateFlowEdge): string => {
  const age = Option.getOrElse(
    Option.map(Option.fromNullishOr(edge.lastSeenAt), (seen) => model.cursor - seen),
    () => Number.POSITIVE_INFINITY,
  );
  return Match.value(age).pipe(
    Match.when(Number.POSITIVE_INFINITY, () => styles.untriedEdge),
    Match.when(0, () => styles.freshEdge),
    Match.when(
      (value) => value <= 3,
      () => styles.recentEdge,
    ),
    Match.orElse(() => styles.staleEdge),
  );
};

const placedFor = (model: Model, graph: StateFlowGraph): Placed =>
  place(graph, specimenFor(model).initialTag, model.layout, model.narrow ? 'down' : 'across');

function graphView(model: Model, placed: Placed, h: HtmlBuilder<Message>): Html {
  const specimen = specimenFor(model);
  const trace = traceOf(model);
  const latest = currentRecord(model);
  const active = stateTagOf(model);
  const inspected = Option.fromNullishOr(
    trace.find((item) => item.sequence === model.selectedSequence),
  );
  function edgeView(route: Route): Html {
    const { edge } = route;
    const record = Option.fromNullishOr(trace.findLast((item) => tookEdge(item, edgeOf(edge))));
    const message = Option.match(record, {
      onSome: (item) => Message.SelectedTrace({ sequence: item.sequence }),
      onNone: () => Message.SelectedEdge({ edge: edge.id }),
    });
    const latestMatch = latest.pipe(Option.filter((item) => tookEdge(item, edgeOf(edge))));
    const pulseSequence = Option.getOrElse(
      Option.map(latestMatch, (item) => item.sequence),
      () => 0,
    );
    const selected =
      model.selectedEdge === edge.id ||
      Option.exists(inspected, (item) => tookEdge(item, edgeOf(edge)));
    const label = `${edge.source} → ${edge.target} on ${edge.event} (${guardLabel(edge)}), taken ${edge.transitionCount} times`;
    return h.g(
      [
        h.Key(`${edge.id}:${pulseSequence}`),
        h.Class(
          [
            styles.edge,
            recencyClass(model, edge),
            textWhen(edge.guard !== 'unguarded', styles.guardedEdge),
            textWhen(edge.transitionCount > 0, styles.visitedEdge),
            textWhen(Option.isSome(latestMatch), styles.latestEdge),
            textWhen(selected, styles.selectedEdge),
            textWhen(!model.reducedMotion && Option.isSome(latestMatch), styles.pulse),
          ].join(' '),
        ),
        h.Role('button'),
        h.Tabindex(0),
        h.AriaLabel(label),
        h.AriaPressed(String(selected)),
        h.OnClick(message),
        h.OnKeyDownPreventDefault(activation(message)),
      ],
      [
        h.title([], [label]),
        h.path(
          [
            h.D(route.path),
            h.Fill('none'),
            h.Stroke('transparent'),
            h.StrokeWidth('16'),
            h.Style({ 'pointer-events': 'stroke' }),
            h.AriaHidden(true),
          ],
          [],
        ),
        h.path(
          [h.D(route.path), h.Fill('none'), h.Stroke('currentColor'), h.Class(styles.route)],
          [],
        ),
        h.path([h.D(route.arrow), h.Fill('currentColor')], []),
        h.rect(
          [
            h.X(String(route.label.x - route.labelWidth / 2)),
            h.Y(String(route.label.y - 9)),
            h.Width(String(route.labelWidth)),
            h.Height('18'),
            h.Class(styles.labelPlate),
          ],
          [],
        ),
        h.text(
          [h.X(String(route.label.x)), h.Y(String(route.label.y + 4)), h.Class(styles.edgeLabel)],
          [edge.event],
        ),
      ],
    );
  }
  function nodeView(node: StateFlowLayoutNode): Html {
    const isActive = node.id === active;
    const error = specimen.errorStates.includes(node.id);
    const unreachable = specimen.unreachable.includes(node.id);
    const ignored = trace.filter((item) => item.outcome === 'ignored' && item.from === node.id);
    const shrugging = latest.pipe(
      Option.filter((item) => item.outcome === 'ignored' && item.from === node.id),
    );
    const status = Match.value({ isActive, error, unreachable, visited: node.visitCount > 0 }).pipe(
      Match.when({ isActive: true }, () => 'active'),
      Match.when({ unreachable: true }, () => 'unreachable'),
      Match.when({ error: true }, () => 'error state'),
      Match.when({ visited: true }, () => 'visited'),
      Match.orElse(() => node.role),
    );
    const message = Message.SelectedNode({ node: node.id });
    const ignoredText = textWhen(ignored.length > 0, `, ignored ${ignored.length} messages`);
    return h.g(
      [
        h.Key(node.id),
        h.Transform(`translate(${node.x},${node.y})`),
        h.Class(
          [
            styles.node,
            textWhen(node.visitCount > 0, styles.visitedNode),
            textWhen(error, styles.errorNode),
            textWhen(unreachable, styles.unreachableNode),
            textWhen(isActive, styles.activeNode),
            textWhen(model.selectedNode === node.id, styles.selectedNode),
          ].join(' '),
        ),
        h.Role('button'),
        h.Tabindex(0),
        h.AriaLabel(`Select state ${node.label}${ignoredText}`),
        h.AriaPressed(textWhen(model.selectedNode === node.id, 'true', 'false')),
        h.OnClick(message),
        h.OnKeyDownPreventDefault(activation(message)),
      ],
      [
        h.g(
          [
            // Keyed by the ignored event, so each new shrug restarts the animation.
            h.Key(
              `shrug:${Option.getOrElse(
                Option.map(shrugging, (item) => item.sequence),
                () => 0,
              )}`,
            ),
            h.Class(textWhen(Option.isSome(shrugging) && !model.reducedMotion, styles.bounce)),
          ],
          [
            h.rect(
              [
                h.X(String(-nodeHalf.width)),
                h.Y(String(-nodeHalf.height)),
                h.Width(String(nodeHalf.width * 2)),
                h.Height(String(nodeHalf.height * 2)),
                h.Class(styles.terminal),
              ],
              [],
            ),
            h.rect(
              [
                h.X(String(-nodeHalf.width)),
                h.Y(String(-nodeHalf.height)),
                h.Width(String(nodeHalf.width * 2)),
                h.Height('3'),
                h.Fill('currentColor'),
                h.AriaHidden(true),
              ],
              [],
            ),
            h.path(
              [
                h.D('M-63,-23 V-39 H-47 M47,-39 H63 V-23 M63,23 V39 H47 M-47,39 H-63 V23'),
                h.Class(styles.selectionBracket),
                h.AriaHidden(true),
              ],
              [],
            ),
            h.text([h.Y('-3'), h.Class(styles.nodeLabel)], [node.label]),
            h.text([h.Y('17'), h.Class(styles.nodeStatus)], [status]),
            ...[
              h.text(
                [h.X('52'), h.Y('-12'), h.Class(styles.ignoredBadge), h.AriaHidden(true)],
                [`↩${ignored.length}`],
              ),
            ].filter(() => ignored.length > 0),
          ],
        ),
      ],
    );
  }

  return h.div(
    [h.Class(styles.graphScroll)],
    [
      svgRoot(
        h,
        {
          width: placed.width,
          height: placed.height,
          interactive: true,
          ariaLabel: `${specimen.label} state graph`,
          ariaDescription:
            'Select a state to highlight related events. Tab reaches states and transitions; Enter or Space selects. Each transition is labelled with the message that fires it.',
          style: model.narrow ? {} : { 'min-width': `${Math.round(placed.width * 0.8)}px` },
        },
        null,
        [...placed.routes.map(edgeView), ...placed.nodes.map(nodeView)],
      ),
    ],
  );
}

function inspectorView(model: Model, graph: StateFlowGraph, h: HtmlBuilder<Message>): Html {
  const selected = Option.fromNullishOr(
    traceOf(model).find((record) => record.sequence === model.selectedSequence),
  );
  const selectedEdge = Option.fromNullishOr(
    graph.edges.find((edge) => edge.id === model.selectedEdge),
  );
  const edgeDetails = (edge: StateFlowEdge): ReadonlyArray<Html> => [
    h.p([h.Class(styles.eventName)], [edge.event]),
    h.p([], [`${edge.source} → ${edge.target}`]),
    h.p([], [`Guard: ${guardLabel(edge)}`]),
    h.p([h.Class(styles.muted)], ['No recorded event for this transition.']),
  ];
  function eventDetails(record: TransitionFact): ReadonlyArray<Html> {
    const edges = graph.edges.filter((edge) => tookEdge(record, edgeOf(edge)));
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
      h.pre(
        [h.Class(styles.eventData + ' syntax-highlight')],
        [h.code([], highlightedCode(h, encodeEvent(record), 'json', model.highlightedSource))],
      ),
    ];
  }
  const content = Option.map(selected, eventDetails).pipe(
    Option.orElse(() => Option.map(selectedEdge, edgeDetails)),
    Option.getOrElse(() => [
      h.p([h.Class(styles.muted)], ['Select an event to inspect its recorded facts.']),
    ]),
  );
  return h.section(
    [h.Class(styles.inspector), h.AriaLabel('Selected trace inspector'), h.Tabindex(0)],
    [h.h2([h.Class(styles.sectionHeading)], ['Event inspector']), ...content],
  );
}

/** The swimlane's measures: a column of names, a lane per state, a column of Commands. */
const lanes = { names: 240, lane: 92, commands: 240, top: 40, row: 26 } as const;

/**
 * The session as a sequence diagram: a lane per state, in the graph's order, and an arrow
 * per event from the state it left to the one it reached, the Commands it started beside
 * it. An ignored message is a ring on its lane. Events past the scrubber are drawn faint;
 * picking one moves the scrubber there.
 */
function swimlaneView(model: Model, order: ReadonlyArray<string>, h: HtmlBuilder<Message>): Html {
  const frames = framesOf(model);
  const laneX = (state: string): number =>
    lanes.names + Math.max(0, order.indexOf(state)) * lanes.lane + lanes.lane / 2;
  const width = lanes.names + order.length * lanes.lane + lanes.commands;
  const height = lanes.top + Math.max(1, frames.length) * lanes.row + 8;
  const rowView = ({ record }: Frame, index: number): Html => {
    const sequence = index + 1;
    const y = lanes.top + index * lanes.row + lanes.row / 2;
    const from = laneX(record.from);
    const to = laneX(record.target ?? record.from);
    const transitioned = record.outcome === 'transitioned';
    const message = Message.ScrubbedTo({ cursor: sequence });
    const description = transitioned
      ? `${record.from} → ${record.target ?? ''}`
      : `ignored in ${record.from} (${record.reason ?? ''})`;
    const commands = record.commandNames.map((name) => `⇒ ${name}`).join('  ');
    const mark = Match.value({ transitioned, loop: from === to }).pipe(
      Match.when({ transitioned: false }, () => [
        h.circle(
          [
            h.Cx(String(from)),
            h.Cy(String(y)),
            h.R('5'),
            h.Fill('none'),
            h.Stroke('var(--sf-focus)'),
            h.StrokeWidth('1.5'),
          ],
          [],
        ),
      ]),
      Match.when({ loop: true }, () => [
        h.path(
          [
            h.D(
              `M${from - 6},${y - 3} C${from - 22},${y - 16} ${from + 22},${y - 16} ${from + 6},${y - 3}`,
            ),
            h.Fill('none'),
            h.Stroke('currentColor'),
            h.StrokeWidth('1.5'),
          ],
          [],
        ),
      ]),
      Match.orElse(() => {
        const direction = Math.sign(to - from);
        return [
          h.circle([h.Cx(String(from)), h.Cy(String(y)), h.R('3'), h.Fill('currentColor')], []),
          h.path(
            [
              h.D(`M${from},${y} L${to - direction * 6},${y}`),
              h.Stroke('currentColor'),
              h.StrokeWidth('1.5'),
            ],
            [],
          ),
          h.path(
            [
              h.D(`M${to - direction * 8},${y - 4} L${to},${y} L${to - direction * 8},${y + 4} Z`),
              h.Fill('currentColor'),
            ],
            [],
          ),
        ];
      }),
    );
    return h.g(
      [
        h.Key(String(sequence)),
        h.Class(
          [
            styles.laneRow,
            textWhen(sequence > model.cursor, styles.laneFuture),
            textWhen(sequence === model.cursor, styles.laneCurrent),
          ].join(' '),
        ),
        h.Role('button'),
        h.Tabindex(0),
        h.AriaLabel(
          `Replay to event ${sequence}: ${record.messageTag}, ${description}${commands === '' ? '' : `, ${commands}`}`,
        ),
        h.AriaCurrent(textWhen(sequence === model.cursor, 'step', 'false')),
        h.OnClick(message),
        h.OnKeyDownPreventDefault(activation(message)),
      ],
      [
        ...[
          h.rect(
            [
              h.X('0'),
              h.Y(String(y - lanes.row / 2)),
              h.Width(String(width)),
              h.Height(String(lanes.row)),
              h.Class(styles.laneBand),
            ],
            [],
          ),
        ].filter(() => sequence === model.cursor),
        h.text(
          [h.X('8'), h.Y(String(y + 4)), h.Class(styles.laneText)],
          [`${String(sequence).padStart(2, '0')} ${record.messageTag}`.slice(0, 34)],
        ),
        ...mark,
        h.text(
          [
            h.X(String(lanes.names + order.length * lanes.lane + 8)),
            h.Y(String(y + 4)),
            h.Class(styles.laneCommand),
          ],
          [commands],
        ),
      ],
    );
  };
  return h.section(
    [h.Class(styles.swimlane), h.AriaLabel('Swimlane')],
    [
      h.h2([h.Class(styles.sectionHeading)], ['Swimlane']),
      h.p(
        [h.Class(styles.muted)],
        [
          'Each event as an arrow between state lanes, the Commands it started on the right. Pick one to replay to it.',
        ],
      ),
      h.div(
        [h.Class(styles.laneScroll)],
        [
          h.svg(
            [
              h.ViewBox(`0 0 ${width} ${height}`),
              h.Width(String(width)),
              h.Height(String(height)),
              h.Role('group'),
              h.AriaLabel('Events by state'),
            ],
            [
              ...order.flatMap((state) => [
                h.line(
                  [
                    h.X1(String(laneX(state))),
                    h.X2(String(laneX(state))),
                    h.Y1('28'),
                    h.Y2(String(height)),
                    h.Class(styles.lane),
                  ],
                  [],
                ),
                h.text(
                  [h.X(String(laneX(state))), h.Y('18'), h.Class(styles.laneHeading)],
                  [state],
                ),
              ]),
              ...frames.map(rowView),
            ],
          ),
        ],
      ),
    ],
  );
}

/** Every edge: taken in this trace or not, a test that would take it, or why none can. */
function coverageView(model: Model, graph: StateFlowGraph, h: HtmlBuilder<Message>): Html {
  const specimen = specimenFor(model);
  const seen = graph.edges.filter((edge) => edge.transitionCount > 0).length;
  const itemFor = (edge: Specimen['edges'][number]): Html => {
    const taken = graph.edges.find((other) => other.id === edge.id)?.transitionCount ?? 0;
    const dead = Option.fromNullishOr(specimen.dead.find((item) => item.edgeId === edge.id));
    const path = Option.fromNullishOr(specimen.coverage.find((item) => item.edgeId === edge.id));
    const name = `${edge.from} → ${edge.target} on ${edge.messageTag}`;
    const action = Match.value({
      dead: Option.getOrNull(Option.map(dead, ({ reason }) => reason)),
      reachable: Option.isSome(path),
    }).pipe(
      Match.when({ dead: Match.string }, ({ dead: reason }) =>
        h.span([h.Class(styles.coverageDead)], [`dead: ${reason}`]),
      ),
      Match.when({ reachable: true }, () =>
        h.button(
          [
            h.Class(styles.smallButton),
            h.Type('button'),
            h.AriaLabel(`Copy a test for ${name}`),
            h.OnClick(Message.ClickedCopyTest({ edge: edge.id })),
          ],
          ['Copy test'],
        ),
      ),
      Match.orElse(() => h.span([h.Class(styles.muted)], ['no example reaches it'])),
    );
    return h.li(
      [h.Key(edge.id), h.Class(styles.coverageItem)],
      [
        h.span(
          [
            h.Class(taken > 0 ? styles.coverageSeen : styles.muted),
            h.AriaLabel(taken > 0 ? 'taken' : 'not taken'),
          ],
          [taken > 0 ? '✓' : '○'],
        ),
        h.span(
          [h.Class(styles.coverageEdge)],
          [`${name}${edge.guard === 'unguarded' ? '' : ` (${guardLabel(edge)})`}`],
        ),
        action,
      ],
    );
  };
  return h.section(
    [h.Class(styles.coverage), h.AriaLabel('Coverage')],
    [
      h.h2([h.Class(styles.sectionHeading)], ['Coverage']),
      h.p(
        [],
        [
          `${seen} of ${specimen.edges.length} transitions taken in this trace · ${specimen.coverage.length} reachable from the examples · ${specimen.dead.length} dead`,
        ],
      ),
      ...[
        h.p([h.Class(styles.coverageDead)], [`Unreachable: ${specimen.unreachable.join(', ')}`]),
      ].filter(() => specimen.unreachable.length > 0),
      h.p(
        [h.Class(styles.muted)],
        [
          'Copy test writes a Vitest case: the shortest run of the machine’s named examples that takes the edge, from its initial state.',
        ],
      ),
      h.ul([h.Class(styles.coverageList)], specimen.edges.map(itemFor)),
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
      ...[
        record.from,
        record.outcome,
        record.target ?? '—',
        record.reason ?? '—',
        record.commandNames.join(', ') || '—',
      ].map((value) => h.td([], [value])),
    ],
  );
}

const timelineView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const trace = traceOf(model);
  return h.section(
    [h.Class(styles.timeline), h.AriaLabel('Recorded events')],
    [
      h.h2([h.Class(styles.sectionHeading)], ['Recorded events']),
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
                    ['Sequence', 'Event', 'From', 'Outcome', 'Target', 'Reason', 'Commands'].map(
                      (label) => h.th([h.Attribute('scope', 'col')], [label]),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                trace.map((record) => eventRow(model, record, h)),
              ),
            ],
          ),
        ],
      ),
      ...[
        h.p([h.Class(styles.muted)], ['No events replayed yet. Step, play or scrub the session.']),
      ].filter(() => trace.length === 0),
    ],
  );
};

const sourceLabels = {
  sample: 'the machine’s sample session',
  recording: 'a recording',
  link: 'a shared link',
} as const;

function railView(model: Model, h: HtmlBuilder<Message>): Html {
  const specimen = specimenFor(model);
  const playing = model.playback === 'playing';
  const atStart = model.cursor === 0;
  const atEnd = model.cursor >= model.events.length;
  const control = (
    glyph: string,
    label: string,
    message: Message,
    disabled: boolean,
    primary = false,
  ) =>
    h.button(
      [
        h.Class([styles.control, textWhen(primary, styles.primaryControl)].join(' ')),
        h.Type('button'),
        h.AriaLabel(label),
        h.Title(label),
        h.OnClick(message),
        h.Disabled(disabled),
      ],
      [glyph],
    );
  const telemetryLabel = Option.match(Option.fromNullishOr(model.lastTelemetrySequence), {
    onNone: () => 'Outbound Port: no emission recorded',
    onSome: (sequence) => `Outbound Port: emitted #${sequence}`,
  });
  return h.aside(
    [h.Class(styles.rail), h.AriaLabel('Machine, replay and Ports')],
    [
      h.label(
        [h.Class(styles.field)],
        [
          'Machine',
          h.select(
            [
              h.Class(styles.select),
              h.AriaLabel('Machine'),
              h.OnChange((value) => Message.ChoseSpecimen({ specimen: value })),
            ],
            specimens.map((candidate) =>
              h.option(
                [h.Value(candidate.id), h.Selected(candidate.id === specimen.id)],
                [candidate.label],
              ),
            ),
          ),
        ],
      ),
      h.p([h.Class(styles.muted)], [specimen.summary]),
      h.h2([h.Class(styles.sectionHeading)], ['Replay']),
      h.div(
        [h.Class(styles.controls)],
        [
          control('⏮', 'Reset', Message.ClickedReset(), atStart),
          control('◀', 'Step back', Message.ClickedStepBack(), atStart),
          playing
            ? control('❚❚', 'Pause', Message.ClickedPause(), false, true)
            : control('▶', 'Play', Message.ClickedPlay(), model.events.length === 0, true),
          control('▶|', 'Step', Message.ClickedStep(), atEnd),
          control('⏭', 'To the end', Message.ClickedEnd(), atEnd),
        ],
      ),
      h.label(
        [h.Class(styles.field)],
        [
          `Event ${model.cursor} of ${model.events.length}`,
          h.input([
            h.Class(styles.scrubber),
            h.Type('range'),
            h.Min('0'),
            h.Max(String(model.events.length)),
            h.Step('1'),
            h.Value(String(model.cursor)),
            h.AriaLabel('Replay position'),
            h.OnInput((value) => Message.ScrubbedTo({ cursor: Number(value) })),
          ]),
        ],
      ),
      h.p([h.Class(styles.muted)], [`Playing ${sourceLabels[model.source]}.`]),
      h.label(
        [h.Class(styles.field)],
        [
          'Layout',
          h.select(
            [
              h.Class(styles.select),
              h.AriaLabel('Layout'),
              h.OnChange((value) =>
                Message.ChoseLayout({ layout: value === 'force' ? 'force' : 'layered' }),
              ),
            ],
            [
              h.option([h.Value('layered'), h.Selected(model.layout === 'layered')], ['Layered']),
              h.option([h.Value('force'), h.Selected(model.layout === 'force')], ['Force (D3)']),
            ],
          ),
        ],
      ),
      h.h2([h.Class(styles.sectionHeading)], ['Live']),
      h.button(
        [
          h.Class([styles.control, textWhen(model.live, styles.liveOn)].join(' ')),
          h.Type('button'),
          h.AriaPressed(String(model.live)),
          h.OnClick(Message.ClickedLive()),
        ],
        [model.live ? '● Listening' : 'Listen live'],
      ),
      ...Option.match(specimen.livePath, {
        onNone: () => [
          h.p(
            [h.Class(styles.muted)],
            ['No app reports this machine; live mode follows any that do.'],
          ),
        ],
        onSome: (path) => [
          h.p(
            [h.Class(styles.muted)],
            [
              'Open ',
              h.a([h.Href(path), h.Target('_blank'), h.Rel('noopener')], [`${specimen.label} ↗`]),
              ' in another tab and use it: its machine’s messages arrive here.',
            ],
          ),
        ],
      }),
      ...[
        control('Clear recording', 'Clear recording', Message.ClickedClearRecording(), false),
      ].filter(() => model.source === 'recording' && model.events.length > 0),
      h.h2([h.Class(styles.sectionHeading)], ['Share']),
      h.button(
        [h.Class(styles.control), h.Type('button'), h.OnClick(Message.ClickedCopyLink())],
        ['Copy link'],
      ),
      h.p([h.Class(styles.notice), h.AriaLive('polite')], [model.notice ?? '']),
      h.h3([h.Class(styles.sectionHeading)], ['Typed Ports']),
      h.p([], ['Inbound Port: replay input configured']),
      h.p([], [telemetryLabel]),
      h.p([h.Class(styles.muted)], ['Telemetry records command emission, not consumer delivery.']),
    ],
  );
}

export function view(model: Model, h: HtmlBuilder<Message>): Document {
  const specimen = specimenFor(model);
  const graph = graphFor(model);
  const placed = placedFor(model, graph);
  const trace = traceOf(model);
  const transitions = trace.filter((record) => record.outcome === 'transitioned').length;
  const taken = graph.edges.filter((edge) => edge.transitionCount > 0).length;
  const active = stateTagOf(model);
  return {
    title: `Stateflow Observatory — ${active}`,
    body: h.div(
      [h.Class(styles.root)],
      [
        h.header(
          [h.Class(styles.header)],
          [
            h.p([h.Class(styles.current)], [`Current state: ${active}`]),
            h.p([], [`Transitions: ${transitions}`]),
            h.p([], [`Ignored: ${trace.length - transitions}`]),
            h.p([], [`Coverage: ${taken} / ${graph.edges.length}`]),
            h.p([], [`Playback: ${model.playback}`]),
          ],
        ),
        h.div(
          [h.Class(styles.workspace)],
          [
            railView(model, h),
            h.section(
              [h.Class(styles.graph), h.AriaLabel('Machine graph')],
              [
                h.h2([h.Class(styles.sectionHeading)], [specimen.label]),
                graphView(model, placed, h),
                h.ul(
                  [h.Class(styles.legend), h.AriaLabel('Graph signals')],
                  [
                    h.li([h.Class(styles.legendActive)], ['Active / latest']),
                    h.li([h.Class(styles.legendVisited)], ['Taken (fades with age)']),
                    h.li([h.Class(styles.legendGuard)], ['Guarded route']),
                    h.li([h.Class(styles.legendError)], ['Failure state']),
                    h.li([], ['↩ ignored messages']),
                  ],
                ),
              ],
            ),
            inspectorView(model, graph, h),
          ],
        ),
        swimlaneView(model, placed.order, h),
        coverageView(model, graph, h),
        timelineView(model, h),
      ],
    ),
  };
}
