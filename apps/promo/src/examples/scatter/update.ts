import type { Command } from '@effect/ui';
import { settleHighlighting, sourceMatches } from '@opsydyn/dataset-explorer/highlighting-core';
import type { SourceLine } from '@opsydyn/dataset-explorer/source-line-core';
import { Struct } from 'effect';

import { validChartWidth } from '#example/frame';

import { changeDomain, changeGroup, navigatePoint, selectPoint, settingsSource } from './chart';
import { FocusSourceLine } from './command';
import { HighlightSource } from './command';
import { CopySource, ExportProject } from './command';
import { Message } from './message';
import { ActionStatus, sourceFor, SourceName } from './model';
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

const navigate = (model: Model, location: SourceLine): Transition => {
  const name = SourceName.literals.find((candidate) => candidate === location.name);
  if (
    name === undefined ||
    (name !== 'settings.ts' && !model.sources.some((source) => source.name === name))
  )
    return { model };
  const next = Struct.assign(model, { activeFile: name });
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

export const update = (model: Model, message: Message): Transition => {
  const result: Transition = Message.match(message, {
    MountedScatter: () => ({ model }),
    NavigatedSourceLine: (location) => navigate(model, location),
    CompletedSourceLineFocus: () => ({ model }),
    SettledHighlightedSource: ({ highlightedSource }) => ({
      model: settleHighlighting(model, highlightedSource, currentSource(model), model.activeFile),
    }),
    SelectedGroup: ({ group }) => ({
      model: { ...model, settings: changeGroup(model.settings, group) },
    }),
    ChangedDomain: ({ axis, value }) => ({
      model: { ...model, settings: changeDomain(model.settings, axis, value) },
    }),
    PressedChartKey: ({ key }) => ({
      model: { ...model, settings: navigatePoint(model.settings, key) },
    }),
    SelectedPoint: ({ id }) => ({ model: { ...model, settings: selectPoint(model.settings, id) } }),
    RecordedChartWidth: ({ width }) =>
      validChartWidth(width) && width !== model.chartWidth
        ? { model: { ...model, chartWidth: width } }
        : { model },
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

  return withHighlighting(result);
};
