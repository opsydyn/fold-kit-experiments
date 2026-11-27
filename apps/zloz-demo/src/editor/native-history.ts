import type { Html } from '@effect/ui/html';
import {
  captureEdition,
  compareEditions,
  resolveEditionRestore,
  resolveHistoryComparisonControls,
} from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';

import { editionRestorePolicy, historyAllowsMessage } from './history';
import { historyChangeNavigatorContext, workbenchHistoryComparison } from './history-navigation';
import { Message } from './message';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { dddAuditPanel, historyAudit } from './native-history-audit';
import { historyChanges, historyComparison } from './native-history-comparison';
import { historyPlayback } from './native-history-playback';
import { architectureNativePanel } from './native-panel';
import { renderReviewPacket } from './native-review-packet';

function renderHistory<M>(h: Html.H<M>, model: Model, send: (message: Message) => M) {
  const workingEditor = model.editor;
  const restoreDecision = model.editionRestore
    ? resolveEditionRestore(workingEditor, model.editionRestore.edition, {
        expectedRevision: model.editionRestore.expectedRevision,
        policy: editionRestorePolicy(model),
      })
    : null;
  const restoreComparison = model.editionRestore
    ? compareEditions(
        captureEdition({
          id: 'working-preview',
          name: 'Working graph',
          snapshot: { graph: workingEditor.graph },
        }),
        model.editionRestore.edition,
      )
    : null;
  const selectedEdition = model.editions.find(
    (edition) => edition.id === model.historyReview?.editionId,
  );
  const comparisonControls = resolveHistoryComparisonControls(
    model.editions,
    model.historyReview?.editionId ?? null,
    {
      baselineId: model.historyBaselineId,
      ghosts: model.historyGhosts,
    },
    { minimalMode: model.minimalMode },
  );
  const comparison = workbenchHistoryComparison(model);
  const changeNavigator = historyChangeNavigatorContext(model, comparison);
  const busyModelSession = modelSessionBusy(model);

  const button = (label: string, message: Message, disabled = false) =>
    h.button
      .attr('type', 'button')
      .disabled(disabled || (model.historyReview !== null && !historyAllowsMessage(message)))
      .on('click', send(message))
      .style({ padding: '10px 16px', cursor: 'pointer' })
      .children(label);

  return h.div.children(
    historyPlayback(h, model, send),
    h.p.attr('aria-label', 'Active model').children(`Model: ${model.modelIdentity.name}`),
    ...(model.modelIdentity.origin
      ? [
          h.p
            .attr('aria-label', 'Model lineage')
            .children(
              `Forked from ${model.modelIdentity.origin.modelName} · ${model.modelIdentity.origin.edition.name}`,
            ),
        ]
      : []),
    h.label.class('workbench-field').children(
      'Working model',
      h.select
        .attr('aria-label', 'Working model')
        .value(model.modelIdentity.id)
        .disabled(busyModelSession)
        .on('change', ({ value: id }) => send(Message.SelectedWorkingModel({ id })))
        .children(
          h.option.attr('value', model.modelIdentity.id).children(model.modelIdentity.name),
          ...model.savedModels.map((item) =>
            h.option.attr('value', item.identity.id).children(item.identity.name),
          ),
        ),
    ),
    h.label.class('workbench-field').children(
      'New model name',
      h.input
        .attr('aria-label', 'New model name')
        .value(model.forkName)
        .on('input', ({ value: name }) => send(Message.ChangedForkName({ name }))),
    ),
    h.label
      .class('workbench-field')
      .children(
        h.input
          .attr('type', 'checkbox')
          .checked(model.protectEditionFork)
          .on('click', send(Message.ClickedEditionForkProtection())),
        'Protect edition forking',
      ),
    ...(model.protectEditionFork
      ? [h.p.attr('role', 'status').children('Edition forking is protected in this workspace.')]
      : []),
    button(
      'Fork edition',
      Message.ClickedForkEdition(),
      !selectedEdition || !model.forkName.trim() || busyModelSession || model.protectEditionFork,
    ),
    h.p.children(
      'Creates a separate editable model with its own Undo. The source stays available in Working model.',
    ),
    button('Export model with lineage', Message.ClickedExportModel()),
    h.label
      .class('workbench-field')
      .children(
        h.input
          .attr('type', 'checkbox')
          .checked(model.protectModelImport)
          .on('click', send(Message.ClickedModelImportProtection())),
        'Protect model import',
      ),
    h.label.class('workbench-field').children(
      'Open model JSON (up to 5 MiB)',
      h.input
        .key(`model-import-${model.modelImport?.id ?? 'ready'}`)
        .attr('type', 'file')
        .attr('accept', 'application/json,.json')
        .attr('aria-label', 'Open model JSON')
        .disabled(busyModelSession || model.protectModelImport)
        .value('')
        .on('change', ({ files }) => send(Message.ChoseModelDocumentFiles({ files }))),
    ),
    ...(model.modelImport
      ? [
          h.p.attr('role', 'status').children('Reading model document…'),
          button('Cancel model import', Message.ClickedCancelModelImport()),
        ]
      : []),
    h.p.children(
      'Models are kept in this tab. Export and reopen model JSON to preserve identity, editions and origin. Diagram-only files omit this metadata.',
    ),
    h.p
      .attr('role', 'status')
      .attr('aria-label', 'History mode')
      .children(
        model.historyReview
          ? `Read-only edition: ${selectedEdition?.name ?? ''}. Working model preserved.`
          : 'Present · editable working model',
      ),
    h.label.class('workbench-field').children(
      'Edition name',
      h.input
        .attr('aria-label', 'Edition name')
        .value(model.editionName)
        .disabled(model.historyReview !== null)
        .on('input', ({ value: name }) => send(Message.ChangedEditionName({ name }))),
    ),
    button(
      'Capture edition',
      Message.ClickedCaptureEdition(),
      !model.editionName.trim() ||
        workingEditor.gesture.type !== 'idle' ||
        model.active !== null ||
        model.importing !== null,
    ),
    button('Load Order history example', Message.ClickedOrderHistory()),
    button('Load scrubber history example', Message.ClickedScrubberHistory()),
    button('Load causal audit example', Message.ClickedAuditExample()),
    h.h3.children('Portable review'),
    renderReviewPacket(h, model, send),
    dddAuditPanel(h, model, send),
    h.h3.children('Causal findings'),
    h.p.children(
      'Compare semantic findings independently of the visible edition. Resolved findings open the baseline; introduced and persisting findings open the target.',
    ),
    historyAudit(h, model, send),
    h.label.class('workbench-field').children(
      'Rewind to edition',
      h.select
        .attr('aria-label', 'Rewind to edition')
        .disabled(
          model.active !== null ||
            model.importing !== null ||
            workingEditor.gesture.type !== 'idle',
        )
        .value(model.historyReview?.editionId ?? '')
        .on('change', ({ value: id }) =>
          send(id ? Message.SelectedHistoryEdition({ id }) : Message.ClickedHistoryPresent()),
        )
        .children(
          h.option.attr('value', '').children('Present'),
          ...model.editions.map((edition) =>
            h.option.attr('value', edition.id).children(edition.name),
          ),
        ),
    ),
    button('Return to present', Message.ClickedHistoryPresent(), model.historyReview === null),
    historyComparison(h, comparisonControls, send),
    h.p.children(
      'Dashed marks show earlier geometry; dotted marks show removals. Labels identify Added, Removed and Previous states, and arrows show movement. Ghosts are read-only and never enter the model. Minimal mode hides this layer while retaining your choices.',
    ),
    historyChanges(h, model, changeNavigator, send),
    h.label.class('workbench-field').children(
      'Import edition archive (up to 5 MiB)',
      h.input
        .key(`edition-import-${model.editionImport?.id ?? 'ready'}`)
        .attr('type', 'file')
        .attr('accept', '.json,application/json')
        .attr('aria-label', 'Import edition archive')
        .value('')
        .on('change', ({ files }) => send(Message.ChoseEditionArchiveFiles({ files }))),
    ),
    ...(model.editionImport
      ? [
          h.p.attr('role', 'status').children('Reading edition archive…'),
          button('Cancel archive import', Message.ClickedCancelEditionImport()),
        ]
      : []),
    h.label
      .class('workbench-field')
      .children(
        h.input
          .attr('type', 'checkbox')
          .checked(model.protectEditionRestore)
          .on('click', send(Message.ClickedEditionRestoreProtection())),
        'Protect edition restore',
      ),
    button(
      'Preview edition restore',
      Message.ClickedPreviewEditionRestore(),
      !selectedEdition || model.editionImport !== null,
    ),
    ...(model.editionRestore && restoreDecision
      ? [
          h.section
            .attr('aria-label', 'Edition restore preview')
            .children(
              h.h3.children(`Restore ${model.editionRestore.edition.name}`),
              h.p.children(
                'The canvas shows this edition. Restoring replaces the working graph as one undoable change. Your camera stays unchanged.',
              ),
              ...(restoreComparison
                ? [
                    h.ul
                      .attr('aria-label', 'Restore changes')
                      .children(
                        ...restoreComparison.nodes.map((change) =>
                          h.li.children(`${change.kind}: ${(change.after ?? change.before).label}`),
                        ),
                        ...restoreComparison.edges.map((change) =>
                          h.li.children(
                            `${change.kind} connection: ${(change.after ?? change.before).label ?? change.id}`,
                          ),
                        ),
                      ),
                  ]
                : []),
              ...(restoreDecision.type === 'blocked'
                ? [
                    h.p
                      .attr('role', 'status')
                      .attr('aria-label', 'Restore protection reason')
                      .children(restoreDecision.reason),
                  ]
                : []),
              button(
                'Restore as new change',
                Message.ClickedConfirmEditionRestore(),
                restoreDecision.type !== 'ready' || model.editionImport !== null,
              ),
              button('Cancel restore', Message.ClickedCancelEditionRestore()),
            ),
        ]
      : []),
    button('Export editions', Message.ClickedExportEditions(), model.editions.length === 0),
    h.p.children(
      'Import adds editions without replacing your working graph. Identical editions are skipped; conflicting identities reject the whole import. Editions remain session-owned until exported. Restore requires an explicit preview and confirmation; forks preserve the original model. Playback uses read-only editions.',
    ),
  );
}

export const nativeHistory = architectureNativePanel<Model>(
  'ArchitectureHistory',
  Schema.is(
    Schema.Union([
      Message.cases.ChangedEditionName,
      Message.cases.ChangedForkName,
      Message.cases.ChoseEditionArchiveFiles,
      Message.cases.ChoseModelDocumentFiles,
      Message.cases.ClickedAuditExample,
      Message.cases.ClickedCancelEditionImport,
      Message.cases.ClickedCancelEditionRestore,
      Message.cases.ClickedCancelModelImport,
      Message.cases.ClickedCaptureEdition,
      Message.cases.ClickedConfirmEditionRestore,
      Message.cases.ClickedDddAuditExample,
      Message.cases.ClickedEditionForkProtection,
      Message.cases.ClickedEditionRestoreProtection,
      Message.cases.ClickedExportEditions,
      Message.cases.ClickedExportModel,
      Message.cases.ClickedForkEdition,
      Message.cases.ClickedHistoryChange,
      Message.cases.ClickedHistoryChangeFilter,
      Message.cases.ClickedHistoryGhost,
      Message.cases.ClickedHistoryPresent,
      Message.cases.ClickedModelImportProtection,
      Message.cases.ClickedOrderHistory,
      Message.cases.ClickedPlaybackEnabled,
      Message.cases.ClickedPlaybackNext,
      Message.cases.ClickedPlaybackPause,
      Message.cases.ClickedPlaybackPlay,
      Message.cases.ClickedPlaybackPrevious,
      Message.cases.ClickedPlaybackRewind,
      Message.cases.ClickedPreviewEditionRestore,
      Message.cases.ClickedScrubberHistory,
      Message.cases.ObservedAuditComparisonInput,
      Message.cases.ObservedDddAuditInput,
      Message.cases.ObservedReviewPacketInput,
      Message.cases.SelectedHistoryBaseline,
      Message.cases.SelectedHistoryEdition,
      Message.cases.SelectedPlaybackEdition,
      Message.cases.SelectedPlaybackInterval,
      Message.cases.SelectedWorkingModel,
    ]),
  ),
  renderHistory,
);
