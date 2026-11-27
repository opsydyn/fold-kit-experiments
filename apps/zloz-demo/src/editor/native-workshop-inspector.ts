import { workshopControls } from '@opsydyn/foldkit-zloz/effect-ui';

import { Message } from './message';
import type { Model } from './model';
import { architectureNativePanel } from './native-panel';
import { settingCheckbox } from './native-settings';
import { workbenchWorkshopContext } from './workshop';

export const nativeWorkshopInspector = architectureNativePanel<Model>((h, model, request) => {
  const context = workbenchWorkshopContext(model);
  const selected = context.scope?.nodeId ?? '';
  const owner = { modelId: model.modelIdentity.id, epoch: model.modelEpoch };
  const reviewing = model.historyReview !== null;
  const controls = workshopControls(
    h,
    context,
    (input) => request(Message.ObservedWorkshopInput({ ...owner, request: input })),
    { fieldClass: 'workbench-field' },
  ).style({
    display: 'grid',
    gap: '10px',
    padding: '12px',
    border: '1px solid var(--rule)',
    borderRadius: '8px',
  });

  return h.div
    .class('workshop-inspector')
    .style({ display: 'grid', gap: '10px' })
    .children(
      h.h2.children('Workshop meaning'),
      h.label.class('workbench-field').children(
        'Inspect workshop node',
        h.select
          .attr('aria-label', 'Inspect workshop node')
          .on('change', ({ value }) =>
            request(
              Message.ObservedModelInput({
                ...owner,
                message: value
                  ? { type: 'NodeSelected', id: value, additive: false }
                  : { type: 'SelectionCleared' },
              }),
            ),
          )
          .children(
            h.option
              .attr('value', '')
              .selected(selected === '')
              .children('Choose a note or lane'),
            ...model.editor.graph.nodes
              .filter((node) => node.architecture?.family === 'event-storming')
              .map((node) =>
                h.option
                  .key(node.id)
                  .attr('value', node.id)
                  .selected(node.id === selected)
                  .children(node.label),
              ),
          ),
      ),
      h.label.children(
        settingCheckbox(
          h,
          model.workshopConventions,
          request(Message.ClickedWorkshopConvention()),
          reviewing,
        ),
        'Use workshop relationship convention',
      ),
      h.label.children(
        settingCheckbox(
          h,
          model.protectWorkshopMeaning,
          request(Message.ClickedWorkshopProtection()),
          reviewing,
        ),
        'Protect facilitator note',
      ),
      controls,
    );
});
