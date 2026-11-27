import { Message } from './message';
import type { Model } from './model';
import { architectureNativePanel } from './native-panel';
import { settingCheckbox } from './native-settings';

type Policies = Pick<
  Model,
  | 'editor'
  | 'historyReview'
  | 'semanticRelationships'
  | 'customStormingRelationships'
  | 'lockKeyNodes'
  | 'lockNodeSizes'
  | 'excludeSelection'
>;

const visibilityControls = [
  ['hiddenNodeIds', 'review', 'Hide Review node'],
  ['hiddenEdgeIds', 'draft-review', 'Hide Draft → Review edge'],
] as const;

export const nativePolicies = architectureNativePanel<Policies>((h, model, request) => {
  const reviewing = model.historyReview !== null;
  const policy = (label: string, checked: boolean, message: Message) =>
    h.label
      .style({ display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0 8px' })
      .children(settingCheckbox(h, checked, request(message)), label);
  return h.div.children(
    h.label
      .class('workbench-field')
      .children(
        settingCheckbox(
          h,
          model.semanticRelationships,
          request(Message.ClickedSemanticRelationships()),
          reviewing,
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
          reviewing,
        ),
        'Enable custom Delegates convention',
      ),
    h.p.children(
      'Causal conventions are opt-in and independent of node artwork. Disable validation here to keep unresolved workshop drafts.',
    ),
    policy('Lock Review and Domain model', model.lockKeyNodes, Message.ClickedLockKeyNodes()),
    policy(
      'Lock Review and Application core dimensions',
      model.lockNodeSizes,
      Message.ClickedLockNodeSizes(),
    ),
    policy(
      'Exclude Review and its incoming connection from selection',
      model.excludeSelection,
      Message.ClickedExcludeSelection(),
    ),
    h.fieldset
      .style({ margin: '12px 0', padding: '8px 12px', border: '1px solid currentColor' })
      .children(
        h.legend.children('Item visibility'),
        ...visibilityControls.map(([field, id, label]) =>
          h.label
            .key(field)
            .style({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginRight: '16px',
            })
            .children(
              settingCheckbox(
                h,
                model.editor.visibility?.[field]?.includes(id) ?? false,
                request(Message.ClickedVisibilityToggle({ field, id })),
              ),
              label,
            ),
        ),
      ),
  );
});
