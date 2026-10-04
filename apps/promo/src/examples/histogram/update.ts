import type { Return } from 'foldkit/update';

import { validChartWidth } from '#example/frame';

import { changeBinCount, settingsSource } from './chart';
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

const whenReady = (model: Model, start: () => Return<Model, Message>): Return<Model, Message> =>
  ActionStatus.match(model.actionStatus, {
    Pending: () => ({ model }),
    Ready: start,
    Succeeded: start,
    Failed: start,
  });

export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    SelectedDataset: ({ dataset }) => ({
      model: { ...model, settings: { ...model.settings, dataset } },
    }),
    ChangedBinCount: ({ value }) => ({
      model: { ...model, settings: changeBinCount(model.settings, value) },
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
