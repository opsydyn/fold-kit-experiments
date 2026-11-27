import { Component, Mount } from '@effect/ui';
import type { EditorEvent, ZlozNode } from '@opsydyn/foldkit-zloz';
import { visuallyHidden } from '@opsydyn/foldkit-zloz/effect-ui';
import { Effect, Schema, Stream } from 'effect';

import { historyAllowsMessage } from './history';
import { Message } from './message';
import { BackgroundStyle, type Model } from './model';
import { architectureNativePanel } from './native-panel';
import { settingCheckbox } from './native-settings';

type GraphActions = Readonly<{
  model: Pick<
    Model,
    | 'editor'
    | 'modelIdentity'
    | 'modelEpoch'
    | 'minimalMode'
    | 'historyReview'
    | 'background'
    | 'protectDeletions'
    | 'protectPortEdits'
    | 'includeCamera'
    | 'importing'
  >;
  selectedNode: ZlozNode | undefined;
  showMeasurements: boolean;
  showInstructions: boolean;
  fitGroupDisabled: boolean;
  forceDisabled: boolean;
}>;

const acceptsInput = Schema.is(
  Schema.Union([
    Message.cases.ObservedModelInput,
    Message.cases.ClickedAdd,
    Message.cases.SelectedBackground,
    Message.cases.ClickedArrange,
    Message.cases.ClickedDeletionProtection,
    Message.cases.ClickedPortEditProtection,
    Message.cases.ClickedIncludeCamera,
    Message.cases.ClickedSave,
    Message.cases.ClickedLoad,
    Message.cases.ClickedExport,
    Message.cases.ChoseImportFiles,
  ]),
);

const backgroundOptions = [
  ['dots', 'Dots'],
  ['squares', 'Squares'],
  ['custom', 'Custom graph paper'],
  ['none', 'None'],
] as const;
const isBackground = Schema.is(BackgroundStyle);

// A number input keeps the browser's edit until change commits it to the workbench.
const syncGridSpacing = Mount.make(
  'ArchitectureGridSpacingValue',
  { args: { value: Schema.String } },
  (input: HTMLInputElement, _, changes) =>
    Stream.runForEach(changes, ({ value }) =>
      Effect.sync(() => {
        input.value = value;
      }),
    ).pipe(Effect.map(() => Component.noop)),
);

export const nativeGraphActions = architectureNativePanel<GraphActions>(
  'ArchitectureGraphActions',
  acceptsInput,
  (h, context, request) => {
    const {
      model,
      selectedNode,
      showMeasurements,
      showInstructions,
      fitGroupDisabled,
      forceDisabled,
    } = context;
    const { editor } = model;
    const busy = editor.readOnly || editor.gesture.type !== 'idle';
    const observed = (message: EditorEvent) =>
      Message.ObservedModelInput({
        modelId: model.modelIdentity.id,
        epoch: model.modelEpoch,
        message,
      });
    const button = (label: string, message: Message, disabled = false) =>
      h.button
        .attr('type', 'button')
        .disabled(disabled || (model.historyReview !== null && !historyAllowsMessage(message)))
        .on('click', request(message))
        .style({ padding: '10px 16px', cursor: 'pointer' })
        .children(label);
    const toggle = (label: string, pressed: boolean, message: Message, disabled = false) =>
      h.button
        .attr('type', 'button')
        .attr('aria-pressed', String(pressed))
        .disabled(disabled)
        .on('click', request(message))
        .children(label);

    const undo = button('Undo', observed({ type: 'UndoPressed' }), editor.past.length === 0);
    const redo = button('Redo', observed({ type: 'RedoPressed' }), editor.future.length === 0);
    const importHelp = h.p
      .attr('id', 'flow-import-help')
      .style(showInstructions ? {} : visuallyHidden)
      .children('Importing JSON replaces the current diagram.');
    const group = h.div.attr('role', 'group').attr('aria-label', 'Graph actions');
    if (model.minimalMode) return h.div.children(group.children(undo, redo), importHelp);
    return h.div.children(
      group.style({ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }).children(
        button('Add node', Message.ClickedAdd()),
        toggle('Snap to grid', editor.snapToGrid, observed({ type: 'GridSnapToggled' }), busy),
        toggle(
          'Snap to nodes',
          editor.snapToAlignment,
          observed({ type: 'AlignmentSnapToggled' }),
          busy,
        ),
        h.label.children(
          'Background ',
          h.select
            .attr('aria-label', 'Background style')
            .on('change', ({ value }) =>
              isBackground(value)
                ? request(Message.SelectedBackground({ background: value }))
                : undefined,
            )
            .children(
              ...backgroundOptions.map(([value, label]) =>
                h.option
                  .key(value)
                  .attr('value', value)
                  .selected(model.background === value)
                  .children(label),
              ),
            ),
        ),
        showMeasurements
          ? h.label.style({ display: 'inline-flex', alignItems: 'center', gap: '6px' }).children(
              'Grid spacing ',
              h.input
                .attr('type', 'number')
                .attr('aria-label', 'Grid spacing')
                .attr('min', '0')
                .attr('step', 'any')
                .attr('value', String(editor.gridSpacing))
                .onMount(syncGridSpacing({ value: String(editor.gridSpacing) }))
                .disabled(busy)
                .style({ width: '72px', minHeight: '32px' })
                .on('change', ({ value }) =>
                  request(observed({ type: 'GridSpacingChanged', spacing: Number(value) })),
                ),
            )
          : null,
        button('Arrange with ELK', Message.ClickedArrange({ engine: 'elk' })),
        button('Force layout', Message.ClickedArrange({ engine: 'force' }), forceDisabled),
        button('Group selection', observed({ type: 'SelectionGrouped' })),
        button('Ungroup', observed({ type: 'SelectionUngrouped' })),
        ...(selectedNode?.kind === 'group'
          ? [
              button(
                'Fit group to contents',
                observed({ type: 'GroupFitClicked', id: selectedNode.id }),
                busy || fitGroupDisabled,
              ),
              toggle(
                'Lock proportions',
                selectedNode.keepAspectRatio ?? false,
                observed({ type: 'GroupAspectRatioToggled', id: selectedNode.id }),
                busy,
              ),
            ]
          : []),
        ...(selectedNode?.parentId
          ? [
              toggle(
                'Keep inside parent',
                selectedNode.extent === 'parent',
                observed({ type: 'NodeContainmentToggled', id: selectedNode.id }),
                busy,
              ),
              toggle(
                'Grow parent',
                selectedNode.expandParent ?? false,
                observed({ type: 'NodeExpansionToggled', id: selectedNode.id }),
                busy,
              ),
            ]
          : []),
        button('Copy', observed({ type: 'CopyPressed' })),
        button('Paste', observed({ type: 'PastePressed' })),
        button('Duplicate', observed({ type: 'DuplicatePressed' })),
        undo,
        redo,
        toggle(
          'Protect required items',
          model.protectDeletions,
          Message.ClickedDeletionProtection(),
        ),
        toggle('Protect Review input', model.protectPortEdits, Message.ClickedPortEditProtection()),
        button('Delete selected', observed({ type: 'DeletePressed' })),
        h.label.children(
          settingCheckbox(h, model.includeCamera, request(Message.ClickedIncludeCamera())),
          'Include camera',
        ),
        button('Save', Message.ClickedSave()),
        button('Load saved', Message.ClickedLoad()),
        button('Export JSON', Message.ClickedExport()),
        h.label.children(
          'Import JSON',
          h.input
            .key(`import-${model.importing?.id ?? 'ready'}`)
            .attr('type', 'file')
            .attr('accept', '.json,application/json')
            .attr('aria-describedby', 'flow-import-help')
            .on('change', ({ files }) => request(Message.ChoseImportFiles({ files }))),
        ),
      ),
      importHelp,
    );
  },
);
