import type { HighlightingService } from '@opsydyn/dataset-explorer/highlighting';
import { requestHighlighting, settleHighlighting } from '@opsydyn/dataset-explorer/highlighting';
import type { Return } from 'foldkit/update';

import { validChartWidth } from '#example/frame';

import { navigatePoint, changeDomain, changeGroup, selectPoint, settingsSource } from './chart';
import { HighlightSource } from './command';
import { CopySource, ExportProject } from './command';
import { Message } from './message';
import { ActionStatus, sourceFor } from './model';
import type { Model } from './model';
import { initialSettings } from './settings';

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
        commands: [CopySource({ source: currentSource(model) })],
      })),
    ClickedDownload: () =>
      whenReady(model, () =>
        model.templateUrl === null
          ? { model }
          : {
              model: { ...model, actionStatus: ActionStatus.Pending({ action: 'download' }) },
              commands: [
                ExportProject({
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
                ExportProject({
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

  return requestHighlighting(
    result,
    currentSource(result.model),
    result.model.activeFile,
    HighlightSource,
  );
};
