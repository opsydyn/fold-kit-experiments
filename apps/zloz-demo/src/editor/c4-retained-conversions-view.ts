import type { ZlozEventStormingC4Placement, ZlozGraph } from '@opsydyn/foldkit-zloz';
import type { HtmlBuilder } from 'foldkit/html';

import type { Message } from './message';
import type { Model } from './model';

function placementLabel(placement: ZlozEventStormingC4Placement, graph: ZlozGraph): string {
  if (placement.type === 'root') return 'Diagram root';
  if (placement.type === 'organization') return 'Organization only';
  const parentId = placement.parentId;
  return `C4 containment in ${graph.nodes.find((node) => node.id === parentId)?.label ?? parentId}`;
}
/** In-memory records remain inspectable after Undo and source/session changes. */
export function c4RetainedConversions(model: Model, h: HtmlBuilder<Message>) {
  return h.section(
    [h.AriaLabel('Retained C4 conversions')],
    [
      h.h3([], ['Retained C4 conversions']),
      h.p(
        [],
        [
          'Records stay in this tab through Undo and model changes. Download and reopening are not available yet.',
        ],
      ),
      ...(model.c4Conversions.length === 0
        ? [h.p([], ['No C4 conversions have been applied.'])]
        : model.c4Conversions.map((record, index) => {
            const before = record.source.document,
              after = record.document;
            return h.details(
              [h.Key(`c4-conversion:${index}`)],
              [
                h.summary([], [`${before.name} · C4 conversion ${index + 1}`]),
                h.p(
                  [],
                  [
                    `Source: ${before.name}. Target: ${after.name}. Exact plan losses acknowledged before Apply.`,
                  ],
                ),
                h.p(
                  [],
                  [
                    'Original graph, camera, editions, fork ancestry and reviewed choices are retained. This record is independent of graph Undo.',
                  ],
                ),
                h.ul(
                  [h.AriaLabel('C4 conversion changes')],
                  [
                    ...(record.options.mappings?.nodes ?? []).flatMap((choice) => {
                      if (choice.architecture === null) return [];
                      const original = before.snapshot.graph.nodes.find(
                          (n) => n.id === choice.nodeId,
                        ),
                        target = after.snapshot.graph.nodes.find((n) => n.id === choice.nodeId);
                      return [
                        h.li(
                          [h.Key(`node:${choice.nodeId}`)],
                          [
                            h.strong([], [original?.label ?? choice.nodeId]),
                            h.p(
                              [],
                              [
                                `Source meaning: ${original?.architecture?.family ?? 'plain'} · ${original?.architecture?.role ?? 'node'}. Target meaning: C4 · ${choice.architecture.role}. Name: ${target?.label ?? choice.nodeId}.`,
                              ],
                            ),
                          ],
                        ),
                      ];
                    }),
                    ...(record.options.mappings?.edges ?? []).flatMap((choice) =>
                      choice.relationship === null
                        ? []
                        : [
                            h.li(
                              [h.Key(`edge:${choice.edgeId}`)],
                              [
                                `${choice.edgeId}: plain communication · ${choice.relationship.label}`,
                              ],
                            ),
                          ],
                    ),
                    ...(record.options.memberships ?? []).map((choice) =>
                      h.li(
                        [h.Key(`membership:${choice.nodeId}`)],
                        [
                          `${before.snapshot.graph.nodes.find((n) => n.id === choice.nodeId)?.label ?? choice.nodeId}: ${placementLabel(choice.placement, after.snapshot.graph)}`,
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            );
          })),
    ],
  );
}
