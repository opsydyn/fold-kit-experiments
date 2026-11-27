import {
  architectureNodePresets,
  eventStormingRelationshipRules,
  resolveEventStormingRelationship,
  type EditorEvent,
  type ZlozEventStormingRelationshipRequest,
} from '@opsydyn/foldkit-zloz';
import { eventStormingRelationshipControls } from '@opsydyn/foldkit-zloz/effect-ui';

import {
  delegatedRelationship,
  workbenchRelationshipOptions,
} from './event-storming-relationships';
import { historyAllowsMessage } from './history';
import { Message } from './message';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { architectureNativePanel } from './native-panel';
import { settingCheckbox } from './native-settings';
import { relationshipControlsContext } from './relationship-controls';

export const nativeCausalRelationships = architectureNativePanel<Model>((h, model, request) => {
  const { editor, historyReview } = model;
  const owner = { modelId: model.modelIdentity.id, epoch: model.modelEpoch };
  const observe = (message: EditorEvent) => Message.ObservedModelInput({ ...owner, message });
  const context = relationshipControlsContext(model);
  const edge = context.edge;
  const conventions = workbenchRelationshipOptions(model);
  const rules = conventions.rules ?? eventStormingRelationshipRules;
  const incompatible =
    edge &&
    rules.find(
      (rule) =>
        resolveEventStormingRelationship(
          editor.graph,
          { ...edge, architecture: rule.architecture },
          conventions,
        ).type === 'blocked',
    )?.architecture;
  const editingBlocked =
    modelSessionBusy(model) ||
    editor.readOnly ||
    historyReview !== null ||
    editor.gesture.type !== 'idle';
  const onRequest = (input: ZlozEventStormingRelationshipRequest) =>
    request(
      input.type === 'RelationshipSelected'
        ? Message.SelectedCausalRelationship({ ...owner, edgeId: input.edgeId, key: input.key })
        : Message.ClickedRelationshipInference({ ...owner, edgeId: input.edgeId }),
    );
  const button = (label: string, message: Message, disabled = false) =>
    h.button
      .attr('type', 'button')
      .disabled(disabled || (historyReview !== null && !historyAllowsMessage(message)))
      .style({ padding: '10px 16px', cursor: 'pointer' })
      .on('click', request(message))
      .children(label);
  return h.div
    .attr('role', 'group')
    .attr('aria-label', 'Event-storming relationships')
    .children(
      h.h2.children('Causal relationships'),
      h.label.class('workbench-field').children(
        'Inspect relationship',
        h.select
          .attr('aria-label', 'Inspect relationship')
          .on('change', ({ value }) =>
            request(
              observe(
                value
                  ? { type: 'EdgeSelected', id: value, additive: false }
                  : { type: 'SelectionCleared' },
              ),
            ),
          )
          .children(
            h.option
              .attr('value', '')
              .selected(edge === null)
              .children('Choose a connection'),
            ...editor.graph.edges.map((candidate) =>
              h.option
                .key(candidate.id)
                .attr('value', candidate.id)
                .selected(candidate.id === edge?.id)
                .children(candidate.label || candidate.id),
            ),
          ),
      ),
      h.p
        .attr('role', 'status')
        .attr('aria-label', 'Relationship edit feedback')
        .children(editor.notice),
      h.p
        .attr('aria-label', 'Event-storming role legend')
        .children(
          'Actor · Command · Aggregate · Domain Event · Policy. These are editable modelling conventions, not executable business rules.',
        ),
      h.label
        .class('workbench-field')
        .children(
          settingCheckbox(
            h,
            model.semanticRelationships,
            request(Message.ClickedSemanticRelationships()),
            historyReview !== null,
          ),
          'Validate DDD and causal relationships',
        ),
      h.label
        .class('workbench-field')
        .children(
          settingCheckbox(
            h,
            model.customStormingRelationships,
            request(Message.ClickedCustomStormingRelationships()),
            historyReview !== null,
          ),
          'Enable custom Delegates convention',
        ),
      h.p.children(
        'The custom convention permits command → command links. Changing conventions never rewrites existing models.',
      ),
      button(
        'Add delegated command connection',
        Message.ClickedDelegatedRelationship(owner),
        !delegatedRelationship(model),
      ),
      h.ul.attr('aria-label', 'Causal relationship report').children(
        ...editor.graph.edges.map((candidate) => {
          const decision = resolveEventStormingRelationship(editor.graph, candidate, conventions);
          return h.li
            .key(candidate.id)
            .children(
              h.strong.children(candidate.label || candidate.id),
              ' · ',
              decision.type === 'allowed'
                ? `${decision.rule.label} (${decision.inferred ? 'inferred' : 'typed'})`
                : decision.type === 'blocked'
                  ? decision.reason
                  : 'Unrelated connection',
            );
        }),
      ),
      eventStormingRelationshipControls(h, context, onRequest, {
        fieldClass: 'workbench-field',
        statusPrefix: 'Semantic contract · ',
      }).style({
        padding: '12px',
        border: '1px solid var(--rule)',
        borderRadius: '8px',
        display: 'grid',
        gap: '8px',
      }),
      button('Open connection tools', Message.SelectedWorkbenchSection({ section: 'ports' })),
      edge && incompatible
        ? button(
            'Try incompatible relationship',
            observe({ type: 'EdgeArchitectureChanged', id: edge.id, architecture: incompatible }),
            editingBlocked,
          )
        : null,
    );
});

type DiagramCaption = Readonly<{
  design: 'ddd' | 'c4';
  graph: Model['editor']['graph'];
  contextMapPresentation: boolean;
}>;

const dddPresets = architectureNodePresets.filter((preset) => preset.architecture.family === 'ddd');

export const nativeDiagramCaption = architectureNativePanel<DiagramCaption>(
  (h, { design, graph, contextMapPresentation }) => {
    if (design === 'c4')
      return h.div
        .class('c4-diagram-caption')
        .children(
          h.h2.children(
            graph.nodes.some((node) => node.id === 'platform-boundary')
              ? 'Order platform · container view'
              : 'Order platform · system context',
          ),
          h.p.children(
            'C4 package presets. People and systems are named explicitly; dashed nodes are external. Arrows describe directed relationships. Use the theme picker to compare light and dark.',
          ),
        );

    const contextMap = graph.edges.some(
      (edge) => edge.architecture?.family === 'ddd' && edge.architecture.scope === 'strategic',
    );
    const description = contextMap
      ? contextMapPresentation
        ? 'Connectable context cards show authored influence and cooperation. Arrows describe upstream/downstream influence, not message flow. Symmetric partnerships and shared kernels have no arrow.'
        : 'Context-map presentation is disabled. Strategic meaning remains in the model.'
      : 'Package-owned DDD presets. The aggregate is a portless boundary; connections belong to its nodes. Labels describe this example, not enforced business rules.';
    return h.div
      .class('ddd-diagram-caption')
      .children(
        h.h2.children(
          contextMap ? 'Context map · strategic relationships' : 'Ordering · domain model',
        ),
        h.p.children(description),
        h.ul
          .attr('aria-label', 'DDD role legend')
          .children(...dddPresets.map((preset) => h.li.key(preset.label).children(preset.label))),
      );
  },
);
