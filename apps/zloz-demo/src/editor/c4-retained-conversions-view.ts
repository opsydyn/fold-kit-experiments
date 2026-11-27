import type { Html } from '@effect/ui/html';
import type { ZlozEventStormingC4Placement, ZlozGraph } from '@opsydyn/foldkit-zloz';

import { Message } from './message';
import type { Model } from './model';

function placementLabel(placement: ZlozEventStormingC4Placement, graph: ZlozGraph): string {
  if (placement.type === 'root') return 'Diagram root';
  if (placement.type === 'organization') return 'Organization only';
  const parentId = placement.parentId;
  return `C4 containment in ${graph.nodes.find((node) => node.id === parentId)?.label ?? parentId}`;
}
/** In-memory records remain inspectable after Undo and source/session changes. */
export function c4RetainedConversions<M>(
  model: Model,
  h: Html.H<M>,
  send: (message: Message) => M,
) {
  return h.section.attr('aria-label', 'Retained C4 conversions').children(
    h.h3.children('Retained C4 conversions'),
    h.p.children(
      'Records stay in this tab through Undo and model changes. Download a validated receipt to keep it after reload; reopen it below for read-only comparison.',
    ),
    ...(model.c4Conversions.length === 0
      ? [h.p.children('No C4 conversions have been applied.')]
      : model.c4Conversions.map((record, index) => {
          const before = record.source.document,
            after = record.document;
          return h.details.key(`c4-conversion:${index}`).children(
            h.summary.children(`${before.name} · C4 conversion ${index + 1}`),
            h.button
              .attr('type', 'button')
              .on(
                'click',
                send(
                  Message.ClickedC4ReceiptDownload({
                    modelId: model.modelIdentity.id,
                    epoch: model.modelEpoch,
                    index,
                  }),
                ),
              )
              .children(`Download C4 receipt ${index + 1}`),
            h.p.children(
              `Source: ${before.name}. Target: ${after.name}. Exact plan losses acknowledged before Apply.`,
            ),
            h.p.children(
              'Original graph, camera, editions, fork ancestry and reviewed choices are retained. This record is independent of graph Undo.',
            ),
            h.ul.attr('aria-label', 'C4 conversion changes').children(
              ...(record.options.mappings?.nodes ?? []).flatMap((choice) => {
                if (choice.architecture === null) return [];
                const original = before.snapshot.graph.nodes.find((n) => n.id === choice.nodeId),
                  target = after.snapshot.graph.nodes.find((n) => n.id === choice.nodeId);
                return [
                  h.li
                    .key(`node:${choice.nodeId}`)
                    .children(
                      h.strong.children(original?.label ?? choice.nodeId),
                      h.p.children(
                        `Source meaning: ${original?.architecture?.family ?? 'plain'} · ${original?.architecture?.role ?? 'node'}. Target meaning: C4 · ${choice.architecture.role}. Name: ${target?.label ?? choice.nodeId}.`,
                      ),
                    ),
                ];
              }),
              ...(record.options.mappings?.edges ?? []).flatMap((choice) =>
                choice.relationship === null
                  ? []
                  : [
                      h.li
                        .key(`edge:${choice.edgeId}`)
                        .children(
                          `${choice.edgeId}: plain communication · ${choice.relationship.label}`,
                        ),
                    ],
              ),
              ...(record.options.memberships ?? []).map((choice) =>
                h.li
                  .key(`membership:${choice.nodeId}`)
                  .children(
                    `${before.snapshot.graph.nodes.find((n) => n.id === choice.nodeId)?.label ?? choice.nodeId}: ${placementLabel(choice.placement, after.snapshot.graph)}`,
                  ),
              ),
            ),
          );
        })),
  );
}
