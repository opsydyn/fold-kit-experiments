import { Command, Component } from '@effect/ui';
import { settleHighlighting, sourceMatches } from '@opsydyn/dataset-explorer/highlighting-core';
import type { SourceLine } from '@opsydyn/dataset-explorer/source-line-core';

import { workbenchCommands } from '../../../../web/src/apps/comparison/workbench-focus';
import * as Workbench from '../../../../web/src/apps/comparison/workbench-state';
import { CopySource, ExportProject, FocusSourceLine, HighlightSource } from './command';
import { Message } from './message';
import { ActionStatus, type Model } from './model';
import { captureSettings, settingsPath, settingsSource } from './project';

interface Transition {
  readonly model: Model;
  readonly commands?: ReadonlyArray<Command.Command<Message | Component.Noop>>;
}

export const currentSource = (model: Model): string =>
  model.activeFile === settingsPath
    ? settingsSource(captureSettings(model.workbench))
    : (model.sources.find(({ name }) => name === model.activeFile)?.content ?? '');

const whenReady = (model: Model, start: () => Transition): Transition =>
  model.actionStatus._tag === 'Pending' ? { model } : start();

const exportProject = (model: Model, action: 'download' | 'playground'): Transition =>
  whenReady(model, () =>
    model.templateUrl === null
      ? { model }
      : {
          model: { ...model, actionStatus: ActionStatus.Pending({ action }) },
          commands: [
            ExportProject.make({
              action,
              settings: captureSettings(model.workbench),
              templateUrl: model.templateUrl,
            }),
          ],
        },
  );

const selectFile = (model: Model, name: string): Transition =>
  model.sources.some((source) => source.name === name)
    ? {
        model: {
          ...model,
          activeFile: name,
          actionStatus:
            model.actionStatus._tag === 'Pending' ? model.actionStatus : ActionStatus.Ready(),
        },
      }
    : { model };

function navigate(model: Model, location: SourceLine): Transition {
  if (location.name !== settingsPath && !model.sources.some(({ name }) => name === location.name))
    return { model };
  const next = { ...model, activeFile: location.name };
  if (
    !Number.isSafeInteger(location.line) ||
    location.line < 1 ||
    location.line > currentSource(next).split('\n').length
  )
    return { model };
  return { model: next, commands: [FocusSourceLine.make(location)] };
}

function withHighlighting(transition: Transition): Transition {
  const { model } = transition;
  if (model.activeFile === '') return transition;
  const source = currentSource(model);
  const language = model.activeFile;
  if (
    sourceMatches(model.highlightedSource, source, language) ||
    sourceMatches(model.requestedSource, source, language)
  )
    return transition;
  const requestedSource = { source, language };
  return {
    model: { ...model, requestedSource },
    commands: [...(transition.commands ?? []), HighlightSource.make(requestedSource)],
  };
}

export const update = (model: Model, message: Message): Transition => {
  const result: Transition = Message.match(message, {
    MountedSourceViewer: () => ({ model }),
    NavigatedSourceLine: (location) => navigate(model, location),
    CompletedSourceLineFocus: () => ({ model }),
    SettledHighlightedSource: ({ highlightedSource }) => ({
      model: settleHighlighting(model, highlightedSource, currentSource(model), model.activeFile),
    }),
    ReceivedWorkbenchMessage: ({ message }) => {
      const next = Workbench.update(model.workbench, message);
      const commands = workbenchCommands(next).map((command) =>
        Command.map(command, (event) =>
          Component.isNoop(event) ? event : Message.ReceivedWorkbenchMessage({ message: event }),
        ),
      );
      const state = next.model === model.workbench ? model : { ...model, workbench: next.model };
      return commands.length === 0 ? { model: state } : { model: state, commands };
    },
    SelectedFile: ({ name }) => selectFile(model, name),
    ClickedCopy: () =>
      whenReady(model, () => ({
        model: { ...model, actionStatus: ActionStatus.Pending({ action: 'copy' }) },
        commands: [CopySource.make({ source: currentSource(model) })],
      })),
    ClickedDownload: () => exportProject(model, 'download'),
    ClickedPlayground: () => exportProject(model, 'playground'),
    SucceededAction: ({ action }) => ({
      model: { ...model, actionStatus: ActionStatus.Succeeded({ action }) },
    }),
    FailedAction: ({ error }) => ({
      model: { ...model, actionStatus: ActionStatus.Failed({ error }) },
    }),
  });

  const sourceChanged =
    result.model.activeFile !== model.activeFile ||
    (result.model.workbench !== model.workbench &&
      result.model.activeFile === settingsPath &&
      currentSource(result.model) !== currentSource(model));
  return message._tag === 'MountedSourceViewer' || sourceChanged
    ? withHighlighting(result)
    : result;
};
