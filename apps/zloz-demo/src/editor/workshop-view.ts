import {
  zlozEventStormingWorkshopControls,
  zlozWorkshopSelect,
  zlozWorkshopStatusButton,
} from '@opsydyn/foldkit-zloz/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import type { Model } from './model';
import { workbenchWorkshopContext, workshopNodeId } from './workshop';
export function workshopPanel(model: Model, h: HtmlBuilder<Message>) {
  const editor = model.historyReview?.editor ?? model.editor;
  const nodes = editor.graph.nodes.filter((n) => n.architecture?.family === 'event-storming');
  if (!nodes.length) return null;
  const context = workbenchWorkshopContext(model);
  return h.div(
    [h.Class('workshop-inspector'), h.Style({ display: 'grid', gap: '10px' })],
    [
      h.h2([], ['Workshop meaning']),
      h.label(
        [h.Class('workbench-field')],
        [
          'Inspect workshop node',
          h.select(
            [
              h.AriaLabel('Inspect workshop node'),
              h.Value(workshopNodeId(model) ?? ''),
              h.OnChange((id) =>
                Message.ObservedModelInput({
                  modelId: model.modelIdentity.id,
                  epoch: model.modelEpoch,
                  message: id
                    ? { type: 'NodeSelected', id, additive: false }
                    : { type: 'SelectionCleared' },
                }),
              ),
            ],
            [
              h.option([h.Value('')], ['Choose a note or lane']),
              ...nodes.map((n) =>
                h.option(
                  [h.Key(n.id), h.Value(n.id), h.Selected(workshopNodeId(model) === n.id)],
                  [n.label],
                ),
              ),
            ],
          ),
        ],
      ),
      h.label(
        [],
        [
          h.input([
            h.Type('checkbox'),
            h.AriaLabel('Use workshop relationship convention'),
            h.Checked(model.workshopConventions),
            h.OnClick(Message.ClickedWorkshopConvention()),
          ]),
          'Use workshop relationship convention',
        ],
      ),
      h.label(
        [],
        [
          h.input([
            h.Type('checkbox'),
            h.AriaLabel('Protect facilitator note'),
            h.Checked(model.protectWorkshopMeaning),
            h.OnClick(Message.ClickedWorkshopProtection()),
          ]),
          'Protect facilitator note',
        ],
      ),
      zlozEventStormingWorkshopControls(
        h,
        context,
        (request) =>
          Message.ObservedWorkshopInput({
            request,
            modelId: model.modelIdentity.id,
            epoch: model.modelEpoch,
          }),
        {
          attributes: [
            h.Style({
              display: 'grid',
              gap: '10px',
              padding: '12px',
              border: '1px solid var(--rule)',
              borderRadius: '8px',
            }),
          ],
          renderRole: (c, b, r) =>
            b.label(
              [b.Class('workbench-field')],
              [c.role.label, zlozWorkshopSelect(b, c, 'role', r)!],
            ),
          renderStatus: (c, b, r) =>
            c.status
              ? b.div(
                  [
                    b.Role('group'),
                    b.AriaLabel('Hotspot status'),
                    b.Style({ display: 'grid', gap: '6px' }),
                  ],
                  [
                    b.span([], [c.status.label]),
                    b.div(
                      [b.Style({ display: 'flex', gap: '8px' })],
                      (['open', 'resolved'] as const).flatMap((value) => {
                        const button = zlozWorkshopStatusButton(b, c, value, r);
                        return button ? [button] : [];
                      }),
                    ),
                  ],
                )
              : null,
        },
      ),
    ],
  );
}
