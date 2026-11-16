import {
  createGroupWorkbenchV3,
  updateGroupWorkbenchV3,
  type ZlozGroupWorkbenchV3,
  type ZlozGroupWorkbenchEventV3,
} from '@opsydyn/foldkit-zloz';
import { zlozGroupWorkbenchV3, zlozDarkTheme, zlozLightTheme } from '@opsydyn/foldkit-zloz/foldkit';
import { Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { defineTaggedUnion } from 'foldkit/schema';

import { nativeQualificationFixture } from './fixture';
export const Model = defineTaggedUnion({
  Ready: {
    workbench: Schema.Unknown,
    dark: Schema.Boolean,
    minimal: Schema.Boolean,
    protected: Schema.Boolean,
  },
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
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
export function view(model: Model, h: HtmlBuilder<Message>) {
  // SAFETY: The runtime model contains only the native workbench created above.
  const workbench = model.workbench as ZlozGroupWorkbenchV3;
  return {
    title: 'Native v3 qualification',
    body: h.section(
      [
        h.DataAttribute('qualification-revision', String(workbench.editor.revision)),
        h.DataAttribute('qualification-selected', workbench.selectedNodeIds.join(',')),
        h.DataAttribute('qualification-history', String(workbench.editor.history.past.length)),
        h.Style({ height: '85vh' }),
      ],
      [
        h.p(
          [],
          [
            'Synthetic SSR/hydration and performance fixture. This is not a persisted editor session or a product performance guarantee.',
          ],
        ),
        h.button([h.OnClick(Message.ClickedTheme())], ['Toggle theme']),
        h.button([h.OnClick(Message.ClickedMinimal())], ['Toggle minimal mode']),
        h.button([h.OnClick(Message.ClickedProtection())], ['Toggle protection']),
        zlozGroupWorkbenchV3(h, workbench, {
          id: 'qualification-canvas',
          label: 'Native qualification canvas',
          onEvent: (event) => Message.ObservedInput({ event }),
          resize: true,
          portAnchors: true,
          reconnect: true,
          boxSelection: true,
          pinchZoom: true,
          minimalMode: model.minimal,
          theme: model.dark ? zlozDarkTheme : zlozLightTheme,
          policy: policy(model.protected),
        }),
      ],
    ),
  };
}
