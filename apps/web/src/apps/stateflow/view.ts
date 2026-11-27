import '@opsydyn/dataset-explorer/highlighting.css';
import type { View } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { highlightedCode } from '@opsydyn/dataset-explorer/source-ui';
import type {
  StateFlowEdge,
  StateFlowGraph,
  StateFlowLayoutNode,
} from '@opsydyn/foldkit-viz/stateflow';
import { Match, Option, Schema } from 'effect';

import { graphFor, tookEdge } from './graph';
import { nodeHalf, place } from './layered';
import type { Placed, Route } from './layered';
import { Message } from './message';
import type { Model, TransitionFact } from './model';
import { ReplayEvent, replayEventName } from './ports';
import { currentRecord, framesOf, specimenFor, stateTagOf, traceOf } from './replay';
import { encodeEvent } from './source';
import type { Frame, Specimen } from './specimen';
import { specimens } from './specimens';

import * as styles from './stateflow.css';
const guardLabel = (
  edge: Readonly<{
    guard: string;
    guardPosition?: number;
  }>,
): string =>
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
const decodeKey = Schema.decodeUnknownOption(Schema.Struct({ key: Schema.String }));
// The generic SVG builder supplies an untyped event; this is its decode boundary.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
const keyboardActivation = (message: Message) => (payload: unknown) =>
  Option.getOrUndefined(
    decodeKey(payload).pipe(
      Option.filter(({ key }) => key === 'Enter' || key === ' '),
      Option.map(() => message),
    ),
  );

const StateflowRoot = Html.customElement({
  tag: 'stateflow-observatory',
  events: { [replayEventName]: Schema.Unknown },
});
const decodeReplay = Schema.decodeUnknownOption(ReplayEvent);

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
function graphView(model: Model, placed: Placed, h: Html.H<Message>): View.Content<Message> {
  const specimen = specimenFor(model);
  const trace = traceOf(model);
  const latest = currentRecord(model);
  const active = stateTagOf(model);
  const inspected = Option.fromNullishOr(
    trace.find((item) => item.sequence === model.selectedSequence),
  );
  function edgeView(route: Route): View.Content<Message> {
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
    return h
      .el('g')
      .key(`${edge.id}:${pulseSequence}`)
      .attr(
        'class',
        [
          styles.edge,
          recencyClass(model, edge),
          textWhen(edge.guard !== 'unguarded', styles.guardedEdge),
          textWhen(edge.transitionCount > 0, styles.visitedEdge),
          textWhen(Option.isSome(latestMatch), styles.latestEdge),
          textWhen(selected, styles.selectedEdge),
          textWhen(!model.reducedMotion && Option.isSome(latestMatch), styles.pulse),
        ].join(' '),
      )
      .attr('role', 'button')
      .attr('tabindex', String(0))
      .attr('aria-label', label)
      .attr('aria-pressed', String(selected))
      .on('click', message)
      .on('keydown', keyboardActivation(message), { preventDefault: true })
      .children(
        h.el('title').children(label),
        h
          .el('path')
          .attr('d', route.path)
          .attr('fill', 'none')
          .attr('stroke', 'transparent')
          .attr('stroke-width', '16')
          .attr('pointer-events', 'stroke')
          .attr('aria-hidden', String(true)),
        h
          .el('path')
          .attr('d', route.path)
          .attr('fill', 'none')
          .attr('stroke', 'currentColor')
          .attr('class', styles.route),
        h.el('path').attr('d', route.arrow).attr('fill', 'currentColor'),
        h
          .el('rect')
          .attr('x', String(route.label.x - route.labelWidth / 2))
          .attr('y', String(route.label.y - 9))
          .attr('width', String(route.labelWidth))
          .attr('height', '18')
          .attr('class', styles.labelPlate),
        h
          .el('text')
          .attr('x', String(route.label.x))
          .attr('y', String(route.label.y + 4))
          .attr('class', styles.edgeLabel)
          .children(edge.event),
      );
  }
  function nodeView(node: StateFlowLayoutNode): View.Content<Message> {
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
    return h
      .el('g')
      .key(node.id)
      .attr('transform', `translate(${node.x},${node.y})`)
      .attr(
        'class',
        [
          styles.node,
          textWhen(node.visitCount > 0, styles.visitedNode),
          textWhen(error, styles.errorNode),
          textWhen(unreachable, styles.unreachableNode),
          textWhen(isActive, styles.activeNode),
          textWhen(model.selectedNode === node.id, styles.selectedNode),
        ].join(' '),
      )
      .attr('role', 'button')
      .attr('tabindex', String(0))
      .attr('aria-label', `Select state ${node.label}${ignoredText}`)
      .attr('aria-pressed', textWhen(model.selectedNode === node.id, 'true', 'false'))
      .on('click', message)
      .on('keydown', keyboardActivation(message), { preventDefault: true })
      .children(
        h
          .el('g')
          .key(
            `shrug:${Option.getOrElse(
              Option.map(shrugging, (item) => item.sequence),
              () => 0,
            )}`,
          )
          .attr('class', textWhen(Option.isSome(shrugging) && !model.reducedMotion, styles.bounce))
          .children(
            h
              .el('rect')
              .attr('x', String(-nodeHalf.width))
              .attr('y', String(-nodeHalf.height))
              .attr('width', String(nodeHalf.width * 2))
              .attr('height', String(nodeHalf.height * 2))
              .attr('class', styles.terminal),
            h
              .el('rect')
              .attr('x', String(-nodeHalf.width))
              .attr('y', String(-nodeHalf.height))
              .attr('width', String(nodeHalf.width * 2))
              .attr('height', '3')
              .attr('fill', 'currentColor')
              .attr('aria-hidden', String(true)),
            h
              .el('path')
              .attr('d', 'M-63,-23 V-39 H-47 M47,-39 H63 V-23 M63,23 V39 H47 M-47,39 H-63 V23')
              .attr('class', styles.selectionBracket)
              .attr('aria-hidden', String(true)),
            h.el('text').attr('y', '-3').attr('class', styles.nodeLabel).children(node.label),
            h.el('text').attr('y', '17').attr('class', styles.nodeStatus).children(status),
            ...[
              h
                .el('text')
                .attr('x', '52')
                .attr('y', '-12')
                .attr('class', styles.ignoredBadge)
                .attr('aria-hidden', String(true))
                .children(`↩${ignored.length}`),
            ].filter(() => ignored.length > 0),
          ),
      );
  }
  return h.div.attr('class', styles.graphScroll).children(
    h
      .el('svg')
      .attr('viewBox', `0 0 ${placed.width} ${placed.height}`)
      .attr('width', '100%')
      .attr('role', 'application')
      .attr('aria-label', `${specimen.label} state graph`)
      .attr('aria-roledescription', 'interactive chart')
      .attr(
        'style',
        'display:block;font-family:inherit;color:var(--chart-label, #888)' +
          (model.narrow ? '' : `;min-width:${Math.round(placed.width * 0.8)}px`),
      )
      .children(
        h.el('title').children(`${specimen.label} state graph`),
        h
          .el('desc')
          .children(
            'Select a state to highlight related events. Tab reaches states and transitions; Enter or Space selects. Each transition is labelled with the message that fires it.',
          ),
        [...placed.routes.map(edgeView), ...placed.nodes.map(nodeView)],
      ),
  );
}
function inspectorView(
  model: Model,
  graph: StateFlowGraph,
  h: Html.H<Message>,
): View.Content<Message> {
  const selected = Option.fromNullishOr(
    traceOf(model).find((record) => record.sequence === model.selectedSequence),
  );
  const selectedEdge = Option.fromNullishOr(
    graph.edges.find((edge) => edge.id === model.selectedEdge),
  );
  const edgeDetails = (edge: StateFlowEdge): ReadonlyArray<View.Content<Message>> => [
    h.p.attr('class', styles.eventName).children(edge.event),
    h.p.children(`${edge.source} → ${edge.target}`),
    h.p.children(`Guard: ${guardLabel(edge)}`),
    h.p.attr('class', styles.muted).children('No recorded event for this transition.'),
  ];
  function eventDetails(record: TransitionFact): ReadonlyArray<View.Content<Message>> {
    const edges = graph.edges.filter((edge) => tookEdge(record, edgeOf(edge)));
    const guards = Option.fromNullishOr(edges.map(guardLabel).join(', ') || undefined);
    return [
      h.p.attr('class', styles.eventName).children(`#${record.sequence} ${record.messageTag}`),
      h.p.children(`${record.from} → ${record.target ?? '—'}`),
      h.p.children(`Outcome: ${record.outcome}`),
      h.p.children(`Guard: ${Option.getOrElse(guards, () => 'not recorded')}`),
      h.p.children(`Reason: ${record.reason ?? '—'}`),
      h.h3.attr('class', styles.sectionHeading).children('Command names'),
      h.p.children(record.commandNames.join(', ') || 'None'),
      h.h3.attr('class', styles.sectionHeading).children('Structured event data'),
      h.p
        .attr('class', styles.muted)
        .children('Redacted transition facts; original payload is not retained.'),
      h.pre
        .attr('class', styles.eventData + ' syntax-highlight')
        .children(
          h.code.children(
            ...highlightedCode(h, encodeEvent(record), 'json', model.highlightedSource),
          ),
        ),
    ];
  }
  const content = Option.map(selected, eventDetails).pipe(
    Option.orElse(() => Option.map(selectedEdge, edgeDetails)),
    Option.getOrElse(() => [
      h.p.attr('class', styles.muted).children('Select an event to inspect its recorded facts.'),
    ]),
  );
  return h.section
    .attr('class', styles.inspector)
    .attr('aria-label', 'Selected trace inspector')
    .attr('tabindex', String(0))
    .children(h.h2.attr('class', styles.sectionHeading).children('Event inspector'), ...content);
}
/** The swimlane's measures: a column of names, a lane per state, a column of Commands. */
const lanes = { names: 240, lane: 92, commands: 240, top: 40, row: 26 } as const;
/**
 * The session as a sequence diagram: a lane per state, in the graph's order, and an arrow
 * per event from the state it left to the one it reached, the Commands it started beside
 * it. An ignored message is a ring on its lane. Events past the scrubber are drawn faint;
 * picking one moves the scrubber there.
 */
function swimlaneView(
  model: Model,
  order: ReadonlyArray<string>,
  h: Html.H<Message>,
): View.Content<Message> {
  const frames = framesOf(model);
  const laneX = (state: string): number =>
    lanes.names + Math.max(0, order.indexOf(state)) * lanes.lane + lanes.lane / 2;
  const width = lanes.names + order.length * lanes.lane + lanes.commands;
  const height = lanes.top + Math.max(1, frames.length) * lanes.row + 8;
  const rowView = ({ record }: Frame, index: number): View.Content<Message> => {
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
        h
          .el('circle')
          .attr('cx', String(from))
          .attr('cy', String(y))
          .attr('r', '5')
          .attr('fill', 'none')
          .attr('stroke', 'var(--sf-focus)')
          .attr('stroke-width', '1.5'),
      ]),
      Match.when({ loop: true }, () => [
        h
          .el('path')
          .attr(
            'd',
            `M${from - 6},${y - 3} C${from - 22},${y - 16} ${from + 22},${y - 16} ${from + 6},${y - 3}`,
          )
          .attr('fill', 'none')
          .attr('stroke', 'currentColor')
          .attr('stroke-width', '1.5'),
      ]),
      Match.orElse(() => {
        const direction = Math.sign(to - from);
        return [
          h
            .el('circle')
            .attr('cx', String(from))
            .attr('cy', String(y))
            .attr('r', '3')
            .attr('fill', 'currentColor'),
          h
            .el('path')
            .attr('d', `M${from},${y} L${to - direction * 6},${y}`)
            .attr('stroke', 'currentColor')
            .attr('stroke-width', '1.5'),
          h
            .el('path')
            .attr(
              'd',
              `M${to - direction * 8},${y - 4} L${to},${y} L${to - direction * 8},${y + 4} Z`,
            )
            .attr('fill', 'currentColor'),
        ];
      }),
    );
    return h
      .el('g')
      .key(String(sequence))
      .attr(
        'class',
        [
          styles.laneRow,
          textWhen(sequence > model.cursor, styles.laneFuture),
          textWhen(sequence === model.cursor, styles.laneCurrent),
        ].join(' '),
      )
      .attr('role', 'button')
      .attr('tabindex', String(0))
      .attr(
        'aria-label',
        `Replay to event ${sequence}: ${record.messageTag}, ${description}${commands === '' ? '' : `, ${commands}`}`,
      )
      .attr('aria-current', textWhen(sequence === model.cursor, 'step', 'false'))
      .on('click', message)
      .on('keydown', keyboardActivation(message), { preventDefault: true })
      .children(
        ...[
          h
            .el('rect')
            .attr('x', '0')
            .attr('y', String(y - lanes.row / 2))
            .attr('width', String(width))
            .attr('height', String(lanes.row))
            .attr('class', styles.laneBand),
        ].filter(() => sequence === model.cursor),
        h
          .el('text')
          .attr('x', '8')
          .attr('y', String(y + 4))
          .attr('class', styles.laneText)
          .children(`${String(sequence).padStart(2, '0')} ${record.messageTag}`.slice(0, 34)),
        ...mark,
        h
          .el('text')
          .attr('x', String(lanes.names + order.length * lanes.lane + 8))
          .attr('y', String(y + 4))
          .attr('class', styles.laneCommand)
          .children(commands),
      );
  };
  return h.section
    .attr('class', styles.swimlane)
    .attr('aria-label', 'Swimlane')
    .children(
      h.h2.attr('class', styles.sectionHeading).children('Swimlane'),
      h.p
        .attr('class', styles.muted)
        .children(
          'Each event as an arrow between state lanes, the Commands it started on the right. Pick one to replay to it.',
        ),
      h.div.attr('class', styles.laneScroll).children(
        h
          .el('svg')
          .attr('viewBox', `0 0 ${width} ${height}`)
          .attr('width', String(width))
          .attr('height', String(height))
          .attr('role', 'group')
          .attr('aria-label', 'Events by state')
          .children(
            ...order.flatMap((state) => [
              h
                .el('line')
                .attr('x1', String(laneX(state)))
                .attr('x2', String(laneX(state)))
                .attr('y1', '28')
                .attr('y2', String(height))
                .attr('class', styles.lane),
              h
                .el('text')
                .attr('x', String(laneX(state)))
                .attr('y', '18')
                .attr('class', styles.laneHeading)
                .children(state),
            ]),
            ...frames.map(rowView),
          ),
      ),
    );
}
/** Every edge: taken in this trace or not, a test that would take it, or why none can. */
function coverageView(
  model: Model,
  graph: StateFlowGraph,
  h: Html.H<Message>,
): View.Content<Message> {
  const specimen = specimenFor(model);
  const seen = graph.edges.filter((edge) => edge.transitionCount > 0).length;
  const itemFor = (edge: Specimen['edges'][number]): View.Content<Message> => {
    const taken = graph.edges.find((other) => other.id === edge.id)?.transitionCount ?? 0;
    const dead = Option.fromNullishOr(specimen.dead.find((item) => item.edgeId === edge.id));
    const path = Option.fromNullishOr(specimen.coverage.find((item) => item.edgeId === edge.id));
    const name = `${edge.from} → ${edge.target} on ${edge.messageTag}`;
    const action = Match.value({
      dead: Option.getOrNull(Option.map(dead, ({ reason }) => reason)),
      reachable: Option.isSome(path),
    }).pipe(
      Match.when({ dead: Match.string }, ({ dead: reason }) =>
        h.span.attr('class', styles.coverageDead).children(`dead: ${reason}`),
      ),
      Match.when({ reachable: true }, () =>
        h.button
          .attr('class', styles.smallButton)
          .attr('type', 'button')
          .attr('aria-label', `Copy a test for ${name}`)
          .on('click', Message.ClickedCopyTest({ edge: edge.id }))
          .children('Copy test'),
      ),
      Match.orElse(() => h.span.attr('class', styles.muted).children('no example reaches it')),
    );
    return h.li
      .key(edge.id)
      .attr('class', styles.coverageItem)
      .children(
        h.span
          .attr('class', taken > 0 ? styles.coverageSeen : styles.muted)
          .attr('aria-label', taken > 0 ? 'taken' : 'not taken')
          .children(taken > 0 ? '✓' : '○'),
        h.span
          .attr('class', styles.coverageEdge)
          .children(`${name}${edge.guard === 'unguarded' ? '' : ` (${guardLabel(edge)})`}`),
        action,
      );
  };
  return h.section
    .attr('class', styles.coverage)
    .attr('aria-label', 'Coverage')
    .children(
      h.h2.attr('class', styles.sectionHeading).children('Coverage'),
      h.p.children(
        `${seen} of ${specimen.edges.length} transitions taken in this trace · ${specimen.coverage.length} reachable from the examples · ${specimen.dead.length} dead`,
      ),
      ...[
        h.p
          .attr('class', styles.coverageDead)
          .children(`Unreachable: ${specimen.unreachable.join(', ')}`),
      ].filter(() => specimen.unreachable.length > 0),
      h.p
        .attr('class', styles.muted)
        .children(
          'Copy test writes a Vitest case: the shortest run of the machine’s named examples that takes the edge, from its initial state.',
        ),
      h.ul.attr('class', styles.coverageList).children(specimen.edges.map(itemFor)),
    );
}
function eventRow(model: Model, record: TransitionFact, h: Html.H<Message>): View.Content<Message> {
  const related = [record.from, record.target].includes(model.selectedNode ?? '');
  return h.tr
    .key(String(record.sequence))
    .attr('data-related', String(related))
    .attr('class', textWhen(related, styles.relatedRow))
    .children(
      h.td.children(String(record.sequence)),
      h.td.children(
        h.button
          .attr('class', styles.eventButton)
          .attr('aria-label', `Inspect event ${record.sequence}: ${record.messageTag}`)
          .attr(
            'aria-pressed',
            textWhen(record.sequence === model.selectedSequence, 'true', 'false'),
          )
          .on('click', Message.SelectedTrace({ sequence: record.sequence }))
          .children(record.messageTag),
      ),
      ...[
        record.from,
        record.outcome,
        record.target ?? '—',
        record.reason ?? '—',
        record.commandNames.join(', ') || '—',
      ].map((value) => h.td.children(value)),
    );
}
const timelineView = (model: Model, h: Html.H<Message>): View.Content<Message> => {
  const trace = traceOf(model);
  return h.section
    .attr('class', styles.timeline)
    .attr('aria-label', 'Recorded events')
    .children(
      h.h2.attr('class', styles.sectionHeading).children('Recorded events'),
      h.p.attr('class', styles.muted).children(
        Option.match(Option.fromNullishOr(model.selectedNode), {
          onSome: (node) => `Related events highlighted: ${node}`,
          onNone: () => 'Select a state to highlight related events.',
        }),
      ),
      h.div
        .attr('class', styles.tableScroll)
        .children(
          h.table
            .attr('class', styles.table)
            .children(
              h.thead.children(
                h.tr.children(
                  ['Sequence', 'Event', 'From', 'Outcome', 'Target', 'Reason', 'Commands'].map(
                    (label) => h.th.attr('scope', 'col').children(label),
                  ),
                ),
              ),
              h.tbody.children(trace.map((record) => eventRow(model, record, h))),
            ),
        ),
      ...[
        h.p
          .attr('class', styles.muted)
          .children('No events replayed yet. Step, play or scrub the session.'),
      ].filter(() => trace.length === 0),
    );
};
const sourceLabels = {
  sample: 'the machine’s sample session',
  recording: 'a recording',
  link: 'a shared link',
} as const;
function railView(model: Model, h: Html.H<Message>): View.Content<Message> {
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
    h.button
      .attr('class', [styles.control, textWhen(primary, styles.primaryControl)].join(' '))
      .attr('type', 'button')
      .attr('aria-label', label)
      .attr('title', label)
      .on('click', message)
      .disabled(disabled)
      .children(glyph);
  const telemetryLabel = Option.match(Option.fromNullishOr(model.lastTelemetrySequence), {
    onNone: () => 'Outbound Port: no emission recorded',
    onSome: (sequence) => `Outbound Port: emitted #${sequence}`,
  });
  return h.aside
    .attr('class', styles.rail)
    .attr('aria-label', 'Machine, replay and Ports')
    .children(
      h.label.attr('class', styles.field).children(
        'Machine',
        h.select
          .attr('class', styles.select)
          .attr('aria-label', 'Machine')
          .on('change', ({ value }) => Message.ChoseSpecimen({ specimen: value }))
          .value(specimen.id)
          .children(
            specimens.map((candidate) =>
              h.option
                .attr('value', candidate.id)
                .attr('selected', candidate.id === specimen.id ? '' : undefined)
                .children(candidate.label),
            ),
          ),
      ),
      h.p.attr('class', styles.muted).children(specimen.summary),
      h.h2.attr('class', styles.sectionHeading).children('Replay'),
      h.div
        .attr('class', styles.controls)
        .children(
          control('⏮', 'Reset', Message.ClickedReset(), atStart),
          control('◀', 'Step back', Message.ClickedStepBack(), atStart),
          playing
            ? control('❚❚', 'Pause', Message.ClickedPause(), false, true)
            : control('▶', 'Play', Message.ClickedPlay(), model.events.length === 0, true),
          control('▶|', 'Step', Message.ClickedStep(), atEnd),
          control('⏭', 'To the end', Message.ClickedEnd(), atEnd),
        ),
      h.label.attr('class', styles.field).children(
        `Event ${model.cursor} of ${model.events.length}`,
        h.input
          .attr('class', styles.scrubber)
          .attr('type', 'range')
          .attr('min', '0')
          .attr('max', String(model.events.length))
          .attr('step', '1')
          .value(String(model.cursor))
          .attr('aria-label', 'Replay position')
          .on('input', ({ value }) => Message.ScrubbedTo({ cursor: Number(value) })),
      ),
      h.p.attr('class', styles.muted).children(`Playing ${sourceLabels[model.source]}.`),
      h.label.attr('class', styles.field).children(
        'Layout',
        h.select
          .attr('class', styles.select)
          .attr('aria-label', 'Layout')
          .on('change', ({ value }) =>
            Message.ChoseLayout({ layout: value === 'force' ? 'force' : 'layered' }),
          )
          .value(model.layout)
          .children(
            h.option
              .attr('value', 'layered')
              .attr('selected', model.layout === 'layered' ? '' : undefined)
              .children('Layered'),
            h.option
              .attr('value', 'force')
              .attr('selected', model.layout === 'force' ? '' : undefined)
              .children('Force (D3)'),
          ),
      ),
      h.h2.attr('class', styles.sectionHeading).children('Live'),
      h.button
        .attr('class', [styles.control, textWhen(model.live, styles.liveOn)].join(' '))
        .attr('type', 'button')
        .attr('aria-pressed', String(model.live))
        .on('click', Message.ClickedLive())
        .children(model.live ? '● Listening' : 'Listen live'),
      ...Option.match(specimen.livePath, {
        onNone: () => [
          h.p
            .attr('class', styles.muted)
            .children('No app reports this machine; live mode follows any that do.'),
        ],
        onSome: (path) => [
          h.p
            .attr('class', styles.muted)
            .children(
              'Open ',
              h.a
                .attr('href', path)
                .attr('target', '_blank')
                .attr('rel', 'noopener')
                .children(`${specimen.label} ↗`),
              ' in another tab and use it: its machine’s messages arrive here.',
            ),
        ],
      }),
      ...[
        control('Clear recording', 'Clear recording', Message.ClickedClearRecording(), false),
      ].filter(() => model.source === 'recording' && model.events.length > 0),
      h.h2.attr('class', styles.sectionHeading).children('Share'),
      h.button
        .attr('class', styles.control)
        .attr('type', 'button')
        .on('click', Message.ClickedCopyLink())
        .children('Copy link'),
      h.p
        .attr('class', styles.notice)
        .attr('aria-live', 'polite')
        .children(model.notice ?? ''),
      h.h3.attr('class', styles.sectionHeading).children('Typed Ports'),
      h.p.children('Inbound Port: replay input configured'),
      h.p.children(telemetryLabel),
      h.p
        .attr('class', styles.muted)
        .children('Telemetry records command emission, not consumer delivery.'),
    );
}
export function view(h: Html.H<Message>, model: Model) {
  const specimen = specimenFor(model);
  const graph = graphFor(model);
  const placed = placedFor(model, graph);
  const trace = traceOf(model);
  const transitions = trace.filter((record) => record.outcome === 'transitioned').length;
  const taken = graph.edges.filter((edge) => edge.transitionCount > 0).length;
  const active = stateTagOf(model);
  return StateflowRoot(h)
    .class(styles.root)
    .style({ display: 'block' })
    .on(replayEventName, (detail) =>
      Option.getOrUndefined(
        Option.map(decodeReplay(detail), (event) => Message.ReceivedReplayEvent({ event })),
      ),
    )
    .children(
      h.header
        .attr('class', styles.header)
        .children(
          h.p.attr('class', styles.current).children(`Current state: ${active}`),
          h.p.children(`Transitions: ${transitions}`),
          h.p.children(`Ignored: ${trace.length - transitions}`),
          h.p.children(`Coverage: ${taken} / ${graph.edges.length}`),
          h.p.children(`Playback: ${model.playback}`),
        ),
      h.div.attr('class', styles.workspace).children(
        railView(model, h),
        h.section
          .attr('class', styles.graph)
          .attr('aria-label', 'Machine graph')
          .children(
            h.h2.attr('class', styles.sectionHeading).children(specimen.label),
            graphView(model, placed, h),
            h.ul
              .attr('class', styles.legend)
              .attr('aria-label', 'Graph signals')
              .children(
                h.li.attr('class', styles.legendActive).children('Active / latest'),
                h.li.attr('class', styles.legendVisited).children('Taken (fades with age)'),
                h.li.attr('class', styles.legendGuard).children('Guarded route'),
                h.li.attr('class', styles.legendError).children('Failure state'),
                h.li.children('↩ ignored messages'),
              ),
          ),
        inspectorView(model, graph, h),
      ),
      swimlaneView(model, placed.order, h),
      coverageView(model, graph, h),
      timelineView(model, h),
    );
}
