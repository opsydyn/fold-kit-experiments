import type { Command } from '@effect/ui';
import { settleHighlighting, sourceMatches } from '@opsydyn/dataset-explorer/highlighting-core';
import type { SourceLine } from '@opsydyn/dataset-explorer/source-line-core';
import { Struct } from 'effect';

import { validChartWidth } from '#example/frame';

import { changeDomain, changeValue, settingsSource } from './chart';
import { CopySource, ExportProject, FocusPanel, FocusSourceLine, HighlightSource } from './command';
import { Message } from './message';
import { ActionStatus, Editor, EditorStatus, sourceFor, SourceName } from './model';
import type { Model } from './model';
import { initialSettings } from './settings';

interface Transition {
  readonly model: Model;
  readonly commands?: ReadonlyArray<Command.Issued<Message, never, never, 'Effect'>>;
}

export const currentSource = (model: Model): string =>
  model.activeFile === 'settings.ts'
    ? settingsSource(model.settings)
    : sourceFor(model, model.activeFile);

const clearFeedback = (status: Model['actionStatus']): Model['actionStatus'] =>
  ActionStatus.match(status, {
    Pending: () => status,
    Ready: () => ActionStatus.Ready(),
    Succeeded: () => ActionStatus.Ready(),
    Failed: () => ActionStatus.Ready(),
  });

const whenReady = (model: Model, start: () => Transition): Transition =>
  ActionStatus.match(model.actionStatus, {
    Pending: () => ({ model }),
    Ready: start,
    Succeeded: start,
    Failed: start,
  });

const startEditor = (model: Model, revision: number): Model => ({
  ...model,
  panel: 'edit',
  editor: Editor.Session({
    revision,
    initialSettings: model.settings,
    status: EditorStatus.Loading(),
  }),
});

const finishEditor = (
  model: Model,
  revision: number,
  status: typeof EditorStatus.Type,
): Transition =>
  Editor.match(model.editor, {
    Idle: () => ({ model }),
    Session: (session) =>
      session.revision === revision
        ? { model: { ...model, editor: Editor.Session({ ...session, status }) } }
        : { model },
  });

const navigate = (model: Model, location: SourceLine): Transition => {
  const name = SourceName.literals.find((candidate) => candidate === location.name);
  if (
    name === undefined ||
    (name !== 'settings.ts' && !model.sources.some((source) => source.name === name))
  )
    return { model };
  const next = Struct.assign(model, { activeFile: name, panel: 'controls' as const });
  if (
    !Number.isSafeInteger(location.line) ||
    location.line < 1 ||
    location.line > currentSource(next).split('\n').length
  )
    return { model };
  return { model: next, commands: [FocusSourceLine.make(location)] };
};

const withHighlighting = (transition: Transition): Transition => {
  const { model } = transition;
  const source = currentSource(model);
  const language = model.activeFile;
  if (
    sourceMatches(model.highlightedSource, source, language) ||
    sourceMatches(model.requestedSource, source, language)
  )
    return transition;
  const requestedSource = { source, language };
  return {
    model: Struct.assign(model, { requestedSource }),
    commands: [...(transition.commands ?? []), HighlightSource.make(requestedSource)],
  };
};

const selectPanel = (model: Model, panel: Model['panel']): Model =>
  (model.templateUrl === null || !model.embeddedEditor) && panel === 'edit'
    ? model
    : panel === 'edit' && model.editor._tag === 'Idle'
      ? startEditor(model, 1)
      : { ...model, panel };

export const update = (model: Model, message: Message): Transition => {
  const result: Transition = Message.match(message, {
    MountedLine: () => ({ model }),
    NavigatedSourceLine: (location) => navigate(model, location),
    CompletedSourceLineFocus: () => ({ model }),
    CompletedPanelFocus: () => ({ model }),
    NavigatedPanel: ({ panel }) => ({
      model: selectPanel(model, panel),
      commands: [FocusPanel.make({ panel })],
    }),
    SettledHighlightedSource: ({ highlightedSource }) => ({
      model: settleHighlighting(model, highlightedSource, currentSource(model), model.activeFile),
    }),
    SelectedPanel: ({ panel }) => ({ model: selectPanel(model, panel) }),
    ClickedRestartEditor: () =>
      Editor.match(model.editor, {
        Idle: () => ({ model }),
        Session: (session) =>
          session.status._tag === 'Loading' || model.templateUrl === null
            ? { model }
            : { model: startEditor(model, session.revision + 1) },
      }),
    SucceededEditor: ({ revision }) => finishEditor(model, revision, EditorStatus.Ready()),
    FailedEditor: ({ revision, error }) =>
      finishEditor(model, revision, EditorStatus.Failed({ error })),
    SelectedCurve: ({ curve }) => ({ model: { ...model, settings: { ...model.settings, curve } } }),
    ChangedPoint: ({ index, value }) => ({
      model: { ...model, settings: changeValue(model.settings, index, value) },
    }),
    ChangedDomain: ({ value }) => ({
      model: { ...model, settings: changeDomain(model.settings, value) },
    }),
    RecordedChartWidth: ({ width }) =>
      validChartWidth(width) ? { model: { ...model, chartWidth: width } } : { model },
    SelectedFile: ({ name }) => ({
      model: { ...model, activeFile: name, actionStatus: clearFeedback(model.actionStatus) },
    }),
    ClickedReset: () => ({
      model: {
        ...model,
        settings: initialSettings,
        actionStatus: clearFeedback(model.actionStatus),
      },
    }),
    ClickedCopy: () =>
      whenReady(model, () => ({
        model: { ...model, actionStatus: ActionStatus.Pending({ action: 'copy' }) },
        commands: [CopySource.make({ source: currentSource(model) })],
      })),
    ClickedDownload: () =>
      whenReady(model, () =>
        model.templateUrl === null
          ? { model }
          : {
              model: { ...model, actionStatus: ActionStatus.Pending({ action: 'download' }) },
              commands: [
                ExportProject.make({
                  action: 'download',
                  settings: model.settings,
                  templateUrl: model.templateUrl,
                }),
              ],
            },
      ),
    ClickedPlayground: () =>
      whenReady(model, () =>
        model.templateUrl === null
          ? { model }
          : {
              model: { ...model, actionStatus: ActionStatus.Pending({ action: 'playground' }) },
              commands: [
                ExportProject.make({
                  action: 'playground',
                  settings: model.settings,
                  templateUrl: model.templateUrl,
                }),
              ],
            },
      ),
    SucceededAction: ({ action }) => ({
      model: { ...model, actionStatus: ActionStatus.Succeeded({ action }) },
    }),
    FailedAction: ({ error }) => ({
      model: { ...model, actionStatus: ActionStatus.Failed({ error }) },
    }),
  });

  const sourceChanged =
    result.model.activeFile !== model.activeFile ||
    (result.model.activeFile === 'settings.ts' && result.model.settings !== model.settings);
  return message._tag === 'MountedLine' || sourceChanged ? withHighlighting(result) : result;
};
