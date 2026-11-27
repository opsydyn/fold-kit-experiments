import type { Html } from '@effect/ui/html';
import {
  eventStormingParticipantRole,
  resolveEventStormingRelationship,
  type ZlozGraph,
  type ZlozNode,
} from '@opsydyn/foldkit-zloz';

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

export const journeyTriggerId = (edgeId?: string) =>
  edgeId === undefined ? 'journey-back' : 'journey-follow-' + edgeId;

export function journeyView<M>(
  h: Html.H<M>,
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
    h.button
      .attr('id', current ? 'journey-current-note' : undefined)
      .attr('type', 'button')
      .attr('aria-label', 'Reveal ' + label)
      .on('click', actions.reveal(type, id))
      .children(label);
  return h.section.class('workshop-journey').children(
    h.h2.class('rail-heading').children('Workshop journey'),
    h.label.children(
      'Starting note',
      h.select
        .value(path.start?.id ?? '')
        .on('change', ({ value }) => actions.start(value))
        .children(
          h.option.attr('value', '').children('Choose a note'),
          ...path.notes.map((node) =>
            h.option.key(node.id).attr('value', node.id).children(node.label),
          ),
        ),
    ),
    ...(path.changed
      ? [h.p.attr('role', 'status').children('The board changed. Review the remaining path.')]
      : []),
    ...(path.start
      ? [
          journeyOverview(h, path.start, path.steps, path.outgoing),
          h.div
            .class('journey-trail')
            .attr('role', 'region')
            .attr('aria-label', 'Journey trail')
            .children(
              h.ol.children(
                h.li.children(reveal('node', path.start.id, path.start.label, !last)),
                ...path.steps.map((step, index) =>
                  h.li
                    .key(`${index}:${step.id}`)
                    .children(
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
                    ),
                ),
              ),
              ...(path.choices.length
                ? path.choices.map((step) =>
                    h.button
                      .key(step.id)
                      .id(journeyTriggerId(step.id))
                      .attr('type', 'button')
                      .on('click', actions.follow(step.id))
                      .children('Follow ' + step.label + ' → ' + step.target.label),
                  )
                : [
                    h.p
                      .attr('role', 'status')
                      .children(
                        'End of this path · No outgoing Produces, Activates or Triggers link.',
                      ),
                  ]),
            ),
          ...(last
            ? [
                h.button
                  .id(journeyTriggerId())
                  .attr('type', 'button')
                  .on('click', actions.back(last.id, path.steps.length))
                  .children('Back one step'),
              ]
            : []),
        ]
      : path.notes.length
        ? []
        : [h.p.children('This board has no command, domain event or policy to follow.')]),
  );
}
