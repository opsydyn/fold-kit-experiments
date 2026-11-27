import { dddRelationshipControls } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { workbenchDddControls } from './ddd-relationship-controls';
import { Message } from './message';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { architectureNativePanel } from './native-panel';
import { settingCheckbox } from './native-settings';

const acceptsInput = Schema.is(
  Schema.Union([
    Message.cases.ObservedModelInput,
    Message.cases.ObservedDddRelationshipInput,
    Message.cases.ClickedDddRelationshipProtection,
  ]),
);

export const nativeDddInspector = architectureNativePanel<Model>(
  'ArchitectureDddInspector',
  acceptsInput,
  (h, model, request) => {
    const context = workbenchDddControls(model);
    const owner = { modelId: model.modelIdentity.id, epoch: model.modelEpoch };
    return h.div.children(
      h.h2.children('DDD relationship'),
      h.label.class('workbench-field').children(
        'Inspect DDD relationship',
        h.select
          .attr('aria-label', 'Inspect DDD relationship')
          .on('change', ({ value }) =>
            request(
              Message.ObservedModelInput({
                ...owner,
                message: value
                  ? { type: 'EdgeSelected', id: value, additive: false }
                  : { type: 'SelectionCleared' },
              }),
            ),
          )
          .children(
            h.option
              .attr('value', '')
              .selected(context.edge === null)
              .children('Choose a connection'),
            ...model.editor.graph.edges.map((edge) =>
              h.option
                .key(edge.id)
                .attr('value', edge.id)
                .selected(edge.id === context.edge?.id)
                .children(edge.label || edge.id),
            ),
          ),
      ),
      h.label
        .class('workbench-field')
        .children(
          settingCheckbox(
            h,
            model.protectDddRelationships,
            request(Message.ClickedDddRelationshipProtection()),
            model.historyReview !== null || modelSessionBusy(model),
          ),
          'Protect Orders–Billing meaning edits',
        ),
      dddRelationshipControls(
        h,
        context,
        (input) => request(Message.ObservedDddRelationshipInput({ ...owner, request: input })),
        {
          fieldClass: 'workbench-field',
          patternHeading: 'Pattern contract',
          downstreamHeading: 'Downstream contract',
          showStatus: !model.minimalMode && model.diagnosticsEnabled,
          undoHint: 'Each change can be undone.',
        },
      ).style({
        display: 'grid',
        gap: '10px',
        padding: '12px',
        border: '1px solid var(--rule)',
        borderRadius: '8px',
      }),
    );
  },
);
