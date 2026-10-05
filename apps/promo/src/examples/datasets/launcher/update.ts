import type { Return } from 'foldkit/update';

import { OpenPlayground } from './command';
import { Message } from './message';
import { Editor, EditorStatus, Status } from './model';
import type { Model } from './model';

export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    ClickedEditor: () =>
      model.embeddedEditor
        ? {
            model: {
              ...model,
              editorVisible: true,
              editor: Editor.match(model.editor, {
                Idle: () => Editor.Session({ revision: 1, status: EditorStatus.Loading() }),
                Session: () => model.editor,
              }),
            },
          }
        : { model },
    ClickedCloseEditor: () => ({ model: { ...model, editorVisible: false } }),
    ClickedRestartEditor: () =>
      Editor.match(model.editor, {
        Idle: () => ({ model }),
        Session: (session) =>
          EditorStatus.match(session.status, {
            Loading: () => ({ model }),
            Ready: () => restart(model, session.revision + 1),
            Failed: () => restart(model, session.revision + 1),
          }),
      }),
    SucceededEditor: ({ revision }) => finishEditor(model, revision, EditorStatus.Ready()),
    FailedEditor: ({ revision, error }) =>
      finishEditor(model, revision, EditorStatus.Failed({ error })),
    ClickedPlayground: () =>
      Status.match(model.status, {
        Pending: () => ({ model }),
        Ready: () => open(model),
        Opened: () => open(model),
        Failed: () => open(model),
      }),
    SucceededPlayground: () => ({ model: { ...model, status: Status.Opened() } }),
    FailedPlayground: ({ error }) => ({ model: { ...model, status: Status.Failed({ error }) } }),
  });

const restart = (model: Model, revision: number): Return<Model, Message> => ({
  model: {
    ...model,
    editorVisible: true,
    editor: Editor.Session({ revision, status: EditorStatus.Loading() }),
  },
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

const open = (model: Model): Return<Model, Message> => ({
  model: { ...model, status: Status.Pending() },
  commands: [OpenPlayground({ templateUrl: model.templateUrl })],
});
