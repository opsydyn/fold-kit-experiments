import type { Return } from 'foldkit/update';

import { changeDomain, changeValue, settingsSource } from './chart';
import { CopySource, ExportProject } from './command';
import { Message } from './message';
import { ActionStatus, Editor, EditorStatus, sourceFor } from './model';
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
): Return<Model, Message> =>
  Editor.match(model.editor, {
    Idle: () => ({ model }),
    Session: (session) =>
      session.revision === revision
        ? { model: { ...model, editor: Editor.Session({ ...session, status }) } }
        : { model },
  });

export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    SelectedPanel: ({ panel }) =>
      model.templateUrl === null && panel === 'edit'
        ? { model }
        : {
            model:
              panel === 'edit' && model.editor._tag === 'Idle'
                ? startEditor(model, 1)
                : { ...model, panel },
          },
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
