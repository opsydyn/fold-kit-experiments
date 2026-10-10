import type { HighlightingService } from '@opsydyn/dataset-explorer/highlighting';
import { requestHighlighting, settleHighlighting } from '@opsydyn/dataset-explorer/highlighting';
import { Match, Option } from 'effect';
import { foldChild } from 'foldkit/update';
import type { Return } from 'foldkit/update';

import * as Comparison from '../../../../web/src/apps/comparison/main';
import { HighlightSource } from './command';
import { CopySource, ExportProject } from './command';
import { Message } from './message';
import { ActionStatus } from './model';
import type { Model } from './model';
import { captureSettings, settingsPath, settingsSource } from './project';

export const currentSource = (model: Model): string =>
  Match.value(model.activeFile).pipe(
    Match.when(settingsPath, () => settingsSource(captureSettings(model.workbench))),
    Match.orElse(() => model.sources.find(({ name }) => name === model.activeFile)?.content ?? ''),
  );

const foldWorkbench = foldChild({
  update: (model: Comparison.Model, message: Comparison.Message) =>
    Comparison.update(model, message),
  read: (model: Model) => Option.some(model.workbench),
  write: (model: Model, workbench: Comparison.Model): Model => ({ ...model, workbench }),
  toParentMessage: (message: Comparison.Message) => Message.GotWorkbenchMessage({ message }),
});

const whenReady = (
  model: Model,
  start: () => Return<Model, Message, HighlightingService>,
): Return<Model, Message, HighlightingService> =>
  ActionStatus.match(model.actionStatus, {
    Pending: () => ({ model }),
    Ready: start,
    Succeeded: start,
    Failed: start,
  });
const clearFeedback = (status: Model['actionStatus']): Model['actionStatus'] =>
  ActionStatus.match(status, {
    Pending: () => status,
    Ready: () => ActionStatus.Ready(),
    Succeeded: () => ActionStatus.Ready(),
    Failed: () => ActionStatus.Ready(),
  });
const exportProject = (
  model: Model,
  action: 'download' | 'playground',
): Return<Model, Message, HighlightingService> =>
  whenReady(model, () =>
    Option.match(Option.fromNullishOr(model.templateUrl), {
      onNone: () => ({ model }),
      onSome: (templateUrl) => ({
        model: { ...model, actionStatus: ActionStatus.Pending({ action }) },
        commands: [
          ExportProject({ action, settings: captureSettings(model.workbench), templateUrl }),
        ],
      }),
    }),
  );

const selectFile = (model: Model, name: string): Return<Model, Message, HighlightingService> =>
  Option.match(Option.fromNullishOr(model.sources.find((source) => source.name === name)), {
    onNone: () => ({ model }),
    onSome: () => ({
      model: { ...model, activeFile: name, actionStatus: clearFeedback(model.actionStatus) },
    }),
  });

export const update = (
  model: Model,
  message: Message,
): Return<Model, Message, HighlightingService> => {
  const result: Return<Model, Message, HighlightingService> = Message.match(message, {
    AcquiredHighlighter: () => ({
      model: {
        ...model,
        highlighting: 'ready' as const,
        requestedSource: undefined,
        highlightedSource: undefined,
      },
    }),
    FailedHighlighter: () => ({
      model: { ...model, highlighting: 'failed' as const, requestedSource: undefined },
    }),
    ReleasedHighlighter: () => ({
      model: { ...model, highlighting: undefined, requestedSource: undefined },
    }),
    SettledHighlightedSource: ({ highlightedSource }) => ({
      model: settleHighlighting(model, highlightedSource, currentSource(model), model.activeFile),
    }),
    // SAFETY: GotWorkbenchMessage carries Comparison.Message through the typed child fold/view boundary.
    GotWorkbenchMessage: ({ message: raw }) => foldWorkbench(model, raw as Comparison.Message),
    SelectedFile: ({ name }) => selectFile(model, name),
    ClickedCopy: () =>
      whenReady(model, () => ({
        model: { ...model, actionStatus: ActionStatus.Pending({ action: 'copy' }) },
        commands: [CopySource({ source: currentSource(model) })],
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

  return requestHighlighting(
    result,
    currentSource(result.model),
    result.model.activeFile,
    HighlightSource,
  );
};
