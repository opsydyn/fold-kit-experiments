import { Command, Component, Subscription, UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { BoardTitle, Role } from '@opsydyn/zloz-server/src/team-contract';
import { Effect, Schema } from 'effect';

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
type Update = Readonly<{ model: Model; commands?: readonly Command.Command<Message>[] }>;
export const Message = UiSchema.TaggedEnum({
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
const StartBoardSettings = Command.make('StartBoardSettings', { args: {} }, () =>
  Effect.sync(Message.StartedBoardSettings),
);
export const init = (props: Props): Update => ({
  model: { ...props, active: false, draft: null, notice: '' },
  commands: [StartBoardSettings.make({})],
});
const FocusBoardName = Command.make('FocusBoardName', { args: {} }, () =>
  Effect.sync(() => {
    document.getElementById('board-name')?.focus();
    return Message.CompletedFocus();
  }),
);
const RenameSharedBoard = Command.make(
  'RenameSharedBoard',
  { args: { path: Schema.String, name: Schema.String, expectedRevision: Schema.Number } },
  ({ path, name, expectedRevision }) =>
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
);
const latest = (model: Model, title: BoardTitle) =>
  title.nameRevision > model.confirmed.nameRevision ? title : model.confirmed;
export const update = (model: Model, message: Message): Update =>
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
        return {
          model: { ...model, notice: 'Enter a board name.' },
          commands: [FocusBoardName.make({})],
        };
      return {
        model: {
          ...model,
          notice: 'Saving board name…',
          draft: { ...draft, status: 'saving' as const },
        },
        commands: [
          RenameSharedBoard.make({ path: pathFor(model), name, expectedRevision: draft.base }),
        ],
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
const ReflectBoardTitle = Command.make(
  'ReflectBoardTitle',
  { args: { name: Schema.String } },
  ({ name }) =>
    Effect.sync(() => {
      document.title = name + ' | ZLOZ';
      return Component.noop;
    }),
);

function view(h: Html.H<Message>, model: Model) {
  const { name } = model.confirmed;
  const conflict = model.draft?.status === 'conflict';
  const saving = model.draft?.status === 'saving';
  const notice =
    model.notice ||
    (conflict
      ? 'Someone renamed this board to “' + name + '”. Review it before applying your name.'
      : '');

  return h.div(
    h.nav
      .attr('aria-label', 'Diagram')
      .children(
        h.a.attr('href', model.back).children('Back to team'),
        h.button
          .attrs({ type: 'button', popovertarget: 'board-settings' })
          .disabled(!model.active)
          .children('Board settings'),
      ),
    h.section
      .class('workspace-settings')
      .attrs({ id: 'board-settings', popover: 'auto', 'aria-labelledby': 'board-settings-title' })
      .children(
        h.h2.id('board-settings-title').children(name),
        h.p('Your board access: ' + model.role + '.'),
        model.role === 'viewer'
          ? null
          : h.form.on('submit', Message.SubmittedName(), { preventDefault: true }).children(
              h.label.attr('for', 'board-name').children('Board name'),
              h.input
                .attrs({ id: 'board-name', maxlength: '120' })
                .value(model.draft?.text ?? name)
                .disabled(saving)
                .on('input', ({ value }) => Message.ChangedName({ text: value })),
              h.p.attr('role', 'status').children(notice),
              h.button
                .attr('type', 'submit')
                .disabled(!model.draft || saving)
                .children(conflict ? 'Apply my name' : 'Save board name'),
              model.draft && !saving
                ? h.button
                    .attr('type', 'button')
                    .on('click', Message.DiscardedDraft())
                    .children('Discard draft')
                : null,
            ),
        ...(model.role === 'owner'
          ? [
              h.p('Restoring a backup changes this board for everyone.'),
              h.a
                .attr('href', '/app/' + model.teamId + '/diagrams/' + model.diagramId + '/recovery')
                .children('Backup and recovery'),
              h.span(' · '),
              h.a.attr('href', '/app/' + model.teamId + '?view=settings').children('Team settings'),
            ]
          : [h.p('Team owners manage access and recovery.')]),
      ),
    h.h1.attr('title', name).children(name),
  );
}

export const BoardSettings = Html.component({
  name: 'TeamsBoardSettings',
  model: Model,
  message: Message,
  props: Props,
}).make({
  init: ($) => {
    const initial = init($.props);
    return $.set(initial.model).run(...(initial.commands ?? []));
  },
  update: ($, message) => {
    const result = update($.model, message);
    const step = $.set(result.model).run(...(result.commands ?? []));
    return result.model.confirmed.name === $.model.confirmed.name
      ? step
      : step.run(ReflectBoardTitle.make({ name: result.model.confirmed.name }));
  },
  subscriptions: () => [
    Subscription.make(
      'TeamsBoardTitle',
      titleChanges((title) => Message.ObservedTitle({ title })),
    ),
  ],
  view,
});
