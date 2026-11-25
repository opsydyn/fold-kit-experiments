import { BoardTitle, Role } from '@opsydyn/zloz-server/src/team-contract';
import { Effect, Schema } from 'effect';
import { Command, Dom, Render, Subscription } from 'foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { Return } from 'foldkit/update';

import { pathFor } from '../editor/protocol';
import { publishTitle, titleChanges } from './channel';

const Props = Schema.Struct({
  teamId: Schema.String,
  diagramId: Schema.String,
  back: Schema.String,
  role: Role,
  confirmed: BoardTitle,
});
export type Props = typeof Props.Type;
const Draft = Schema.Struct({
  text: Schema.String,
  base: Schema.Number,
  status: Schema.Literals(['editing', 'saving', 'conflict']),
});
export const Model = Schema.Struct({
  ...Props.fields,
  active: Schema.Boolean,
  draft: Schema.NullOr(Draft),
  notice: Schema.String,
});
type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  StartedBoardSettings: {},
  ChangedName: { text: Schema.String },
  SubmittedName: {},
  ObservedTitle: { title: BoardTitle },
  ReceivedRename: { title: BoardTitle, conflict: Schema.Boolean },
  FailedRename: { status: Schema.Number },
  CompletedFocus: {},
  DiscardedDraft: {},
});
type Message = typeof Message.Type;
const StartBoardSettings = Command.define('StartBoardSettings', {
  messages: [Message.StartedBoardSettings],
  execute: Effect.sync(Message.StartedBoardSettings),
});
export const init = (props: Props): Return<Model, Message> => ({
  model: { ...props, active: false, draft: null, notice: '' },
  commands: [StartBoardSettings()],
});
const FocusBoardName = Command.define('FocusBoardName', {
  messages: [Message.CompletedFocus],
  execute: Render.afterCommit.pipe(
    Effect.andThen(Dom.focus('#board-name')),
    Effect.catchTag('ElementNotFound', () => Effect.void),
    Effect.map(Message.CompletedFocus),
  ),
});
const RenameSharedBoard = Command.define('RenameSharedBoard', {
  args: { path: Schema.String, name: Schema.String, expectedRevision: Schema.Number },
  messages: [Message.ReceivedRename, Message.FailedRename],
  execute: ({ path, name, expectedRevision }) =>
    Effect.tryPromise(async (signal) => {
      const response = await fetch(path + '/name', {
        method: 'POST',
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, expectedRevision }),
      });
      if (!response.ok && response.status !== 409)
        return Message.FailedRename({ status: response.status });
      const title = Schema.decodeUnknownSync(BoardTitle)(await response.json());
      publishTitle(title);
      return Message.ReceivedRename({ title, conflict: response.status === 409 });
    }).pipe(Effect.orElseSucceed(() => Message.FailedRename({ status: 0 }))),
});
const latest = (model: Model, title: BoardTitle) =>
  title.nameRevision > model.confirmed.nameRevision ? title : model.confirmed;
export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    StartedBoardSettings: () => ({ model: { ...model, active: true } }),
    ChangedName: ({ text }) =>
      model.draft?.status === 'saving'
        ? { model }
        : {
            model: {
              ...model,
              notice: '',
              draft: {
                text,
                base: model.draft?.base ?? model.confirmed.nameRevision,
                status: model.draft?.status ?? 'editing',
              },
            },
          },
    SubmittedName: () => {
      const draft = model.draft;
      if (model.role === 'viewer' || !draft || draft.status === 'saving') return { model };
      const name = draft.text.trim();
      if (!name)
        return { model: { ...model, notice: 'Enter a board name.' }, commands: [FocusBoardName()] };
      return {
        model: {
          ...model,
          notice: 'Saving board name…',
          draft: { ...draft, status: 'saving' as const },
        },
        commands: [RenameSharedBoard({ path: pathFor(model), name, expectedRevision: draft.base })],
      };
    },
    ObservedTitle: ({ title }) => ({
      model:
        title.nameRevision <= model.confirmed.nameRevision
          ? model
          : { ...model, confirmed: title, notice: '' },
    }),
    ReceivedRename: ({ title, conflict }) => ({
      model: {
        ...model,
        confirmed: latest(model, title),
        draft:
          conflict && model.draft
            ? { ...model.draft, base: title.nameRevision, status: 'conflict' as const }
            : null,
        notice: conflict ? '' : 'Board name saved.',
      },
    }),
    FailedRename: ({ status }) => ({
      model: {
        ...model,
        draft: model.draft && { ...model.draft, status: 'editing' as const },
        notice:
          status === 403
            ? 'Your access does not allow renaming this board.'
            : 'Could not confirm the rename. Your draft is available to retry.',
      },
    }),
    CompletedFocus: () => ({ model }),
    DiscardedDraft: () => ({ model: { ...model, draft: null, notice: '' } }),
  });
export const subscriptions = Subscription.make<Model, Message>()(() => ({
  title: Subscription.persistentEntry(titleChanges((title) => Message.ObservedTitle({ title }))),
}));
export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const { name } = model.confirmed;
  const conflict = model.draft?.status === 'conflict';
  return {
    title: name + ' | ZLOZ',
    body: h.div(
      [],
      [
        h.nav(
          [h.AriaLabel('Diagram')],
          [
            h.a([h.Href(model.back)], ['Back to team']),
            h.button(
              [h.Type('button'), h.Popovertarget('board-settings'), h.Disabled(!model.active)],
              ['Board settings'],
            ),
          ],
        ),
        h.section(
          [
            h.Id('board-settings'),
            h.Popover('auto'),
            h.Class('workspace-settings'),
            h.AriaLabelledBy('board-settings-title'),
          ],
          [
            h.h2([h.Id('board-settings-title')], [name]),
            h.p([], ['Your board access: ' + model.role + '.']),
            ...(model.role === 'viewer'
              ? []
              : [
                  h.form(
                    [h.OnSubmit(Message.SubmittedName())],
                    [
                      h.label([h.For('board-name')], ['Board name']),
                      h.input([
                        h.Id('board-name'),
                        h.Maxlength(120),
                        h.Value(model.draft?.text ?? name),
                        h.Disabled(model.draft?.status === 'saving'),
                        h.OnInput((text) => Message.ChangedName({ text })),
                      ]),
                      h.p(
                        [h.Role('status')],
                        [
                          model.notice ||
                            (conflict
                              ? 'Someone renamed this board to “' +
                                name +
                                '”. Review it before applying your name.'
                              : ''),
                        ],
                      ),
                      h.button(
                        [
                          h.Type('submit'),
                          h.Disabled(!model.draft || model.draft.status === 'saving'),
                        ],
                        [conflict ? 'Apply my name' : 'Save board name'],
                      ),
                      ...(model.draft && model.draft.status !== 'saving'
                        ? [
                            h.button(
                              [h.Type('button'), h.OnClick(Message.DiscardedDraft())],
                              ['Discard draft'],
                            ),
                          ]
                        : []),
                    ],
                  ),
                ]),
            ...(model.role === 'owner'
              ? [
                  h.p([], ['Restoring a backup changes this board for everyone.']),
                  h.a(
                    [h.Href('/app/' + model.teamId + '/diagrams/' + model.diagramId + '/recovery')],
                    ['Backup and recovery'],
                  ),
                  h.span([], [' · ']),
                  h.a([h.Href('/app/' + model.teamId + '?view=settings')], ['Team settings']),
                ]
              : [h.p([], ['Team owners manage access and recovery.'])]),
          ],
        ),
        h.h1([h.Title(name)], [name]),
      ],
    ),
  };
};
