import { Command, UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Data, Effect, Schema } from 'effect';

import {
  MotionPreference,
  motionCookie,
  motionChangeEvent,
  ThemePreference,
  ToolLabels,
  themeCookie,
  toolLabelsCookie,
} from './preferences';

export const Props = Schema.Struct({
  preference: ThemePreference,
  toolLabels: Schema.optional(ToolLabels),
  motion: Schema.optional(MotionPreference),
});
export type Props = typeof Props.Type;
export const Model = Schema.Struct({
  preference: ThemePreference,
  toolLabels: ToolLabels,
  motion: MotionPreference,
  motionNotice: Schema.String,
  labelsNotice: Schema.String,
  notice: Schema.String,
});
export type Model = typeof Model.Type;
type Update = Readonly<{ model: Model; commands?: readonly Command.Command<Message>[] }>;
export const Message = UiSchema.TaggedEnum({
  SelectedMotion: { value: MotionPreference },
  SettledMotion: { value: MotionPreference, saved: Schema.Boolean },
  SelectedToolLabels: { value: ToolLabels },
  SettledToolLabels: { value: ToolLabels, saved: Schema.Boolean },
  SelectedThemePreference: { preference: ThemePreference },
  CompletedThemeSave: { preference: ThemePreference },
  FailedThemeSave: { preference: ThemePreference },
});
export type Message = typeof Message.Type;
class BrowserPreferenceSaveFailed extends Data.TaggedError('BrowserPreferenceSaveFailed') {}
function writePreferenceCookie(
  name: typeof themeCookie | typeof toolLabelsCookie | typeof motionCookie,
  value: string,
) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  if (!document.cookie.split(';').some((part) => part.trim() === `${name}=${value}`))
    throw new BrowserPreferenceSaveFailed();
}

const SaveMotion = Command.make('SaveMotion', { args: { value: MotionPreference } }, ({ value }) =>
  Effect.try(() => {
    document.dispatchEvent(new CustomEvent(motionChangeEvent, { detail: value }));
    writePreferenceCookie(motionCookie, value);
  }).pipe(
    Effect.match({
      onSuccess: () => Message.SettledMotion({ value, saved: true }),
      onFailure: () => Message.SettledMotion({ value, saved: false }),
    }),
  ),
);
const SaveToolLabels = Command.make(
  'SaveToolLabels',
  { args: { value: ToolLabels } },
  ({ value }) =>
    Effect.try(() => writePreferenceCookie(toolLabelsCookie, value)).pipe(
      Effect.match({
        onSuccess: () => Message.SettledToolLabels({ value, saved: true }),
        onFailure: () => Message.SettledToolLabels({ value, saved: false }),
      }),
    ),
);
const SaveThemePreference = Command.make(
  'SaveThemePreference',
  { args: { preference: ThemePreference } },
  ({ preference }) =>
    Effect.try(() => writePreferenceCookie(themeCookie, preference)).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedThemeSave({ preference }),
        onFailure: () => Message.FailedThemeSave({ preference }),
      }),
    ),
);
export const init = (props: Props) => ({
  model: {
    preference: props.preference,
    toolLabels: props.toolLabels ?? ('icons' as const),
    motion: props.motion ?? ('system' as const),
    motionNotice: '',
    labelsNotice: '',
    notice: '',
  },
});
export const update = (model: Model, message: Message): Update =>
  Message.match(message, {
    SelectedMotion: ({ value }) => ({
      model: { ...model, motion: value, motionNotice: '' },
      commands: [SaveMotion.make({ value })],
    }),
    SettledMotion: ({ value, saved }) => ({
      model:
        value === model.motion
          ? {
              ...model,
              motionNotice: saved
                ? ''
                : 'Motion applied for this visit. Your browser could not save the preference.',
            }
          : model,
    }),
    SelectedToolLabels: ({ value }) => ({
      model: { ...model, toolLabels: value, labelsNotice: '' },
      commands: [SaveToolLabels.make({ value })],
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
      commands: [SaveThemePreference.make({ preference })],
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
function view(h: Html.H<Message>, model: Model) {
  return h.div
    .class('theme-controller')
    .attrs({
      'data-team-theme-preference': model.preference,
      'data-motion-preference': model.motion,
      'data-tool-labels': model.toolLabels,
    })
    .children(
      h.div
        .class('theme-controls')
        .attrs({ role: 'group', 'aria-label': 'Colour theme' })
        .children(
          ...ThemePreference.literals.map((preference) => {
            const label = preference[0].toUpperCase() + preference.slice(1);
            return h.button
              .key(preference)
              .attrs({
                type: 'button',
                title: `Use ${preference} theme`,
                'aria-label': `${label} theme`,
                'aria-pressed': String(model.preference === preference),
              })
              .on('click', Message.SelectedThemePreference({ preference }))
              .children(label);
          }),
        ),
      h.label(
        'Board tool labels',
        h.select
          .on('change', ({ value }) =>
            Message.SelectedToolLabels({
              value: Schema.is(ToolLabels)(value) ? value : model.toolLabels,
            }),
          )
          .children(
            h.option
              .attr('value', 'icons')
              .selected(model.toolLabels === 'icons')
              .children('Compact icons'),
            h.option
              .attr('value', 'labelled')
              .selected(model.toolLabels === 'labelled')
              .children('Icons and labels'),
          ),
      ),
      h.label(
        'Board motion',
        h.select
          .on('change', ({ value }) =>
            Message.SelectedMotion({
              value: Schema.is(MotionPreference)(value) ? value : model.motion,
            }),
          )
          .children(
            h.option
              .attr('value', 'system')
              .selected(model.motion === 'system')
              .children('Follow system'),
            h.option
              .attr('value', 'reduce')
              .selected(model.motion === 'reduce')
              .children('Reduce motion'),
          ),
      ),
      model.motionNotice ? h.span.attr('role', 'status').children(model.motionNotice) : null,
      model.labelsNotice ? h.span.attr('role', 'status').children(model.labelsNotice) : null,
      model.notice
        ? h.span.class('theme-notice').attr('role', 'status').children(model.notice)
        : null,
    );
}

export const Appearance = Html.component({
  name: 'TeamsAppearance',
  model: Model,
  message: Message,
  props: Props,
}).make({
  init: ({ props }) => init(props).model,
  update: ($, message) => {
    const result = update($.model, message);
    return $.set(result.model).run(...(result.commands ?? []));
  },
  view,
});
