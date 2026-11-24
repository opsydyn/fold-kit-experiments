import {
  eventStormingParticipantRole,
  resolveEventStormingRelationship,
  type ZlozGraph,
  type ZlozNode,
} from '@opsydyn/foldkit-zloz';
import type { HtmlBuilder } from 'foldkit/html';

import { journeyOverview } from './journey-overview';

type Cursor = Readonly<{ start: string; via: readonly string[] }>;
type Step = Readonly<{ id: string; label: string; target: ZlozNode }>;

export function journey(graph: ZlozGraph, cursor: Cursor) {
  const notes = graph.nodes.filter((node) => {
    const role = eventStormingParticipantRole(node);
    return role === 'command' || role === 'domain-event' || role === 'policy';
  });
  const start = notes.find((node) => node.id === cursor.start);
  const outgoing = (source: ZlozNode) =>
    graph.edges.flatMap((edge) => {
      const meaning = edge.architecture;
      if (
        edge.source.node !== source.id ||
        meaning?.family !== 'event-storming' ||
        (meaning.role !== 'produces' && meaning.role !== 'activates' && meaning.role !== 'triggers')
      )
        return [];
      const decision = resolveEventStormingRelationship(graph, edge);
      const target = notes.find((node) => node.id === edge.target.node);
      return decision.type === 'allowed' && target
        ? [{ id: edge.id, label: decision.rule.label, target }]
        : [];
    });
  const firstVisit = new Map<string, number>();
  if (start) firstVisit.set(start.id, 1);
  const steps: (Step & { firstSeenAt: number | undefined })[] = [];
  let choices = start ? outgoing(start) : [];
  for (const id of cursor.via) {
    const step = choices.find((edge) => edge.id === id);
    if (!step) break;
    const firstSeenAt = firstVisit.get(step.target.id);
    steps.push({ ...step, firstSeenAt });
    if (firstSeenAt === undefined) firstVisit.set(step.target.id, steps.length + 1);
    choices = outgoing(step.target);
  }
  return {
    notes,
    start,
    steps,
    choices,
    outgoing,
    changed: Boolean(cursor.start) && (!start || steps.length !== cursor.via.length),
  };
}

export function journeyView<M>(
  h: HtmlBuilder<M>,
  path: ReturnType<typeof journey>,
  actions: {
    start: (id: string) => M;
    follow: (id: string) => M;
    back: (edgeId: string, depth: number) => M;
    reveal: (type: 'node' | 'edge', id: string) => M;
  },
) {
  const last = path.steps.at(-1);

  const reveal = (type: 'node' | 'edge', id: string, label: string, current = false) =>
    h.button(
      [
        ...(current ? [h.Id('journey-current-note')] : []),
        h.Type('button'),
        h.AriaLabel('Reveal ' + label),
        h.OnClick(actions.reveal(type, id)),
      ],
      [label],
    );
  return h.section(
    [h.Class('workshop-journey')],
    [
      h.h2([h.Class('rail-heading')], ['Workshop journey']),
      h.label(
        [],
        [
          'Starting note',
          h.select(
            [h.Value(path.start?.id ?? ''), h.OnChange(actions.start)],
            [
              h.option([h.Value('')], ['Choose a note']),
              ...path.notes.map((node) =>
                h.option([h.Key(node.id), h.Value(node.id)], [node.label]),
              ),
            ],
          ),
        ],
      ),
      ...(path.changed
        ? [h.p([h.Role('status')], ['The board changed. Review the remaining path.'])]
        : []),
      ...(path.start
        ? [
            journeyOverview(h, path.start, path.steps, path.outgoing),
            h.div(
              [h.Class('journey-trail'), h.Role('region'), h.AriaLabel('Journey trail')],
              [
                h.ol(
                  [],
                  [
                    h.li([], [reveal('node', path.start.id, path.start.label, !last)]),
                    ...path.steps.map((step, index) =>
                      h.li(
                        [h.Key(`${index}:${step.id}`)],
                        [
                          reveal('edge', step.id, step.label),
                          ' → ',
                          reveal(
                            'node',
                            step.target.id,
                            step.firstSeenAt === undefined
                              ? step.target.label
                              : `${step.target.label} · Revisited · first seen at step ${step.firstSeenAt}`,
                            step === last,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                ...(path.choices.length
                  ? path.choices.map((step) =>
                      h.button(
                        [h.Key(step.id), h.Type('button'), h.OnClick(actions.follow(step.id))],
                        ['Follow ' + step.label + ' → ' + step.target.label],
                      ),
                    )
                  : [
                      h.p(
                        [h.Role('status')],
                        ['End of this path · No outgoing Produces, Activates or Triggers link.'],
                      ),
                    ]),
              ],
            ),
            ...(last
              ? [
                  h.button(
                    [h.Type('button'), h.OnClick(actions.back(last.id, path.steps.length))],
                    ['Back one step'],
                  ),
                ]
              : []),
          ]
        : path.notes.length
          ? []
          : [h.p([], ['This board has no command, domain event or policy to follow.'])]),
    ],
  );
}
