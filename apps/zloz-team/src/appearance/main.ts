import { Data, Effect, Schema } from 'effect';
import { Command } from 'foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { Return } from 'foldkit/update';

import { ThemePreference, themeCookie } from './preferences';

export const Props = Schema.Struct({
  preference: ThemePreference,
  noMeta: Schema.optional(Schema.Boolean),
});
export type Props = typeof Props.Type;
export const Model = Schema.Struct({ preference: ThemePreference, notice: Schema.String });
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  SelectedThemePreference: { preference: ThemePreference },
  CompletedThemeSave: { preference: ThemePreference },
  FailedThemeSave: { preference: ThemePreference },
});
export type Message = typeof Message.Type;
class ThemePreferenceSaveFailed extends Data.TaggedError('ThemePreferenceSaveFailed') {}
const SaveThemePreference = Command.define('SaveThemePreference', {
  args: { preference: ThemePreference },
  messages: [Message.CompletedThemeSave, Message.FailedThemeSave],
  execute: ({ preference }) =>
    Effect.try(() => {
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${themeCookie}=${preference}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
      if (
        !document.cookie.split(';').some((part) => part.trim() === `${themeCookie}=${preference}`)
      )
        throw new ThemePreferenceSaveFailed();
    }).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedThemeSave({ preference }),
        onFailure: () => Message.FailedThemeSave({ preference }),
      }),
    ),
});
export const init = (props: Props) => ({ model: { preference: props.preference, notice: '' } });
export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    SelectedThemePreference: ({ preference }) => ({
      model: { preference, notice: '' },
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
  title: 'Zloz appearance',
  body: h.div(
    [h.Class('theme-controller'), h.DataAttribute('team-theme-preference', model.preference)],
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
      ...(model.notice
        ? [h.span([h.Class('theme-notice'), h.Role('status')], [model.notice])]
        : []),
    ],
  ),
});
