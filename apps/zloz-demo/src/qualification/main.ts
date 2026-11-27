import { UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import {
  createGroupWorkbenchV3,
  updateGroupWorkbenchV3,
  type ZlozGroupWorkbenchV3,
  type ZlozGroupWorkbenchEventV3,
} from '@opsydyn/foldkit-zloz';
import { groupSurfaceV3, zlozDarkTheme, zlozLightTheme } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { nativeQualificationFixture } from './fixture';
import { Flags } from './flags';

export const Model = UiSchema.TaggedEnum({
  Ready: {
    workbench: Schema.Unknown,
    dark: Schema.Boolean,
    minimal: Schema.Boolean,
    protected: Schema.Boolean,
  },
});
export type Model = typeof Model.Type;
export const Message = UiSchema.TaggedEnum({
  ObservedInput: { event: Schema.Unknown },
  ClickedTheme: {},
  ClickedMinimal: {},
  ClickedProtection: {},
});
export type Message = typeof Message.Type;
export const init = (props: Readonly<{ count: 100 | 1000; nested: boolean }>) => ({
  model: Model.Ready({
    workbench: createGroupWorkbenchV3(nativeQualificationFixture(props.count, props.nested), {
      sessionId: `synthetic:${props.count}:${props.nested}`,
    }),
    dark: false,
    minimal: false,
    protected: false,
  }),
});
const policy = (protectedModel: boolean) =>
  protectedModel
    ? {
        canMoveNode: () => 'Qualification policy protects movement.',
        canResizeNode: () => 'Qualification policy protects size.',
        canEditPort: () => 'Qualification policy protects anchors.',
        canReconnect: () => 'Qualification policy protects reconnection.',
      }
    : {};
export function update(model: Model, message: Message) {
  // SAFETY: Only the typed initializer/package controller constructs this in-memory model.
  const workbench = model.workbench as ZlozGroupWorkbenchV3;
  return Message.match(message, {
    ObservedInput: ({ event }) => {
      // SAFETY: Only native package view/input emits this typed event universe.
      const input = event as ZlozGroupWorkbenchEventV3;
      return {
        model: Model.Ready({
          ...model,
          workbench: updateGroupWorkbenchV3(workbench, input, policy(model.protected)),
        }),
      };
    },
    ClickedTheme: () => ({ model: Model.Ready({ ...model, dark: !model.dark }) }),
    ClickedMinimal: () => ({ model: Model.Ready({ ...model, minimal: !model.minimal }) }),
    ClickedProtection: () => ({ model: Model.Ready({ ...model, protected: !model.protected }) }),
  });
}
export default Html.component({
  name: 'ZlozQualification',
  props: Flags,
  model: Model,
  message: Message,
}).make({
  init: ($) => $.set(init($.props).model),
  update: ($, message) => $.set(update($.model, message).model),
  view: (h, model) => {
    // SAFETY: the qualification model serializes only the typed fixture created during init.
    const workbench = model.workbench as ZlozGroupWorkbenchV3;
    return h.section
      .attr('data-qualification-revision', String(workbench.editor.revision))
      .attr('data-qualification-selected', workbench.selectedNodeIds.join(','))
      .attr('data-qualification-history', String(workbench.editor.history.past.length))
      .style({ height: '85vh' })
      .children(
        h.p.children(
          'Synthetic SSR/hydration and performance fixture. This is not a persisted editor session or a product performance guarantee.',
        ),
        h.button.on('click', Message.ClickedTheme()).children('Toggle theme'),
        h.button.on('click', Message.ClickedMinimal()).children('Toggle minimal mode'),
        h.button.on('click', Message.ClickedProtection()).children('Toggle protection'),
        groupSurfaceV3(h, workbench, {
          id: 'qualification-canvas',
          label: 'Native qualification canvas',
          onEvent: (event) => Message.ObservedInput({ event }),
          minimalMode: model.minimal,
          theme: model.dark ? zlozDarkTheme : zlozLightTheme,
          policy: policy(model.protected),
        }),
      );
  },
});
