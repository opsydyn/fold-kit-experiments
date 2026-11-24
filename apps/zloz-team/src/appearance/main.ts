import { Data, Effect, Schema } from 'effect';
import { Command } from 'foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { Return } from 'foldkit/update';

import { ThemePreference, ToolLabels, themeCookie, toolLabelsCookie } from './preferences';

export const Props = Schema.Struct({
  preference: ThemePreference,
  toolLabels: Schema.optional(ToolLabels),
  noMeta: Schema.optional(Schema.Boolean),
});
export type Props = typeof Props.Type;
export const Model = Schema.Struct({
  preference: ThemePreference,
  toolLabels: ToolLabels,
  labelsNotice: Schema.String,
  notice: Schema.String,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  SelectedToolLabels: { value: ToolLabels },
  SettledToolLabels: { value: ToolLabels, saved: Schema.Boolean },
  SelectedThemePreference: { preference: ThemePreference },
  CompletedThemeSave: { preference: ThemePreference },
  FailedThemeSave: { preference: ThemePreference },
});
export type Message = typeof Message.Type;
class BrowserPreferenceSaveFailed extends Data.TaggedError('BrowserPreferenceSaveFailed') {}
function writePreferenceCookie(name: typeof themeCookie | typeof toolLabelsCookie, value: string) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  if (!document.cookie.split(';').some((part) => part.trim() === `${name}=${value}`))
    throw new BrowserPreferenceSaveFailed();
}

const SaveToolLabels = Command.define('SaveToolLabels', {
  args: { value: ToolLabels },
  messages: [Message.SettledToolLabels],
  execute: ({ value }) =>
    Effect.try(() => writePreferenceCookie(toolLabelsCookie, value)).pipe(
      Effect.match({
        onSuccess: () => Message.SettledToolLabels({ value, saved: true }),
        onFailure: () => Message.SettledToolLabels({ value, saved: false }),
      }),
    ),
});
const SaveThemePreference = Command.define('SaveThemePreference', {
  args: { preference: ThemePreference },
  messages: [Message.CompletedThemeSave, Message.FailedThemeSave],
  execute: ({ preference }) =>
    Effect.try(() => writePreferenceCookie(themeCookie, preference)).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedThemeSave({ preference }),
        onFailure: () => Message.FailedThemeSave({ preference }),
      }),
    ),
});
export const init = (props: Props) => ({
  model: {
    preference: props.preference,
    toolLabels: props.toolLabels ?? ('icons' as const),
    labelsNotice: '',
    notice: '',
  },
});
export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    SelectedToolLabels: ({ value }) => ({
      model: { ...model, toolLabels: value, labelsNotice: '' },
      commands: [SaveToolLabels({ value })],
    }),
    SettledToolLabels: ({ value, saved }) => ({
      model:
        value === model.toolLabels
          ? {
              ...model,
              labelsNotice: saved
                ? ''
                : 'Tool labels applied for this visit. Your browser could not save the preference.',
            }
          : model,
    }),
    SelectedThemePreference: ({ preference }) => ({
      model: { ...model, preference, notice: '' },
      commands: [SaveThemePreference({ preference })],
    }),
    CompletedThemeSave: ({ preference }) => ({
      model: preference === model.preference ? { ...model, notice: '' } : model,
    }),
    FailedThemeSave: ({ preference }) => ({
      model:
        preference === model.preference
          ? {
              ...model,
              notice: 'Theme applied for this visit. Your browser could not save the preference.',
            }
          : model,
    }),
  });
export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'ZLOZ preferences',
  body: h.div(
    [
      h.Class('theme-controller'),
      h.DataAttribute('team-theme-preference', model.preference),
      h.DataAttribute('tool-labels', model.toolLabels),
    ],
    [
      h.div(
        [h.Class('theme-controls'), h.Role('group'), h.AriaLabel('Colour theme')],
        (['system', 'light', 'dark'] as const).map((preference) =>
          h.button(
            [
              h.Type('button'),
              h.Title(`Use ${preference} theme`),
              h.AriaLabel(`${preference[0].toUpperCase()}${preference.slice(1)} theme`),
              h.AriaPressed(model.preference === preference ? 'true' : 'false'),
              h.OnClick(Message.SelectedThemePreference({ preference })),
            ],
            [preference[0].toUpperCase() + preference.slice(1)],
          ),
        ),
      ),
      h.label(
        [],
        [
          'Board tool labels',
          h.select(
            [
              h.Value(model.toolLabels),
              h.OnChange((value) =>
                Message.SelectedToolLabels({
                  value: Schema.is(ToolLabels)(value) ? value : model.toolLabels,
                }),
              ),
            ],
            [
              h.option([h.Value('icons')], ['Compact icons']),
              h.option([h.Value('labelled')], ['Icons and labels']),
            ],
          ),
        ],
      ),
      ...(model.labelsNotice ? [h.span([h.Role('status')], [model.labelsNotice])] : []),
      ...(model.notice
        ? [h.span([h.Class('theme-notice'), h.Role('status')], [model.notice])]
        : []),
    ],
  ),
});
