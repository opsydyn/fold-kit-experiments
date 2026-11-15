import {
  captureConnectionDocument,
  createEditorFromConnectionDocument,
  updateEditor,
  type EditorEvent,
  type EditorState,
  type EditorPolicy,
  type ZlozGraph,
} from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
import type { Return } from 'foldkit/update';

export const Session = Schema.Literals(['strict', 'loose']);
export const PortDesign = Schema.Literals(['native', 'custom']);
export const ColorScheme = Schema.Literals(['light', 'dark']);

const graph: ZlozGraph = {
  nodes: ['Orders', 'Billing', 'Audit'].map((label, index) => ({
    id: label.toLowerCase(),
    label,
    position: { x: index === 2 ? 200 : index * 360, y: index === 2 ? 290 : 70 },
    size: { width: 220, height: 130 },
    ports: [
      { id: 'in', label: 'Input', kind: 'input', side: 'left', offset: 0.5 },
      { id: 'out', label: 'Output', kind: 'output', side: 'right', offset: 0.5 },
    ],
  })),
  edges: [],
};

export const Model = Schema.Struct({
  strict: Schema.Unknown,
  loose: Schema.Unknown,
  session: Session,
  design: PortDesign,
  scheme: ColorScheme,
  protectedPort: Schema.Boolean,
  readOnly: Schema.Boolean,
});
export type Model = Readonly<{
  strict: EditorState;
  loose: EditorState;
  session: typeof Session.Type;
  design: typeof PortDesign.Type;
  scheme: typeof ColorScheme.Type;
  protectedPort: boolean;
  readOnly: boolean;
}>;
export const Message = defineMessageUnion({
  ObservedInput: { session: Session, event: Schema.Unknown },
  SelectedSession: { session: Session },
  SelectedDesign: { design: PortDesign },
  SelectedScheme: { scheme: ColorScheme },
  ClickedProtection: {},
  ClickedReadOnly: {},
});
export type Message = typeof Message.Type;
export const init = (): Return<Model, Message> => ({
  model: {
    // oxlint-disable-next-line linteffect/no-resource-without-acquire-release -- Pure validation and immutable editor data; no native resource is acquired.
    strict: createEditorFromConnectionDocument(
      captureConnectionDocument({ graph, connectionMode: 'strict' }),
      { zoomLimits: { minZoom: 0.2, maxZoom: 1.5 } },
    ),
    // oxlint-disable-next-line linteffect/no-resource-without-acquire-release -- Pure validation and immutable editor data; no native resource is acquired.
    loose: createEditorFromConnectionDocument(
      captureConnectionDocument({ graph, connectionMode: 'loose' }),
      { zoomLimits: { minZoom: 0.2, maxZoom: 1.5 } },
    ),
    session: 'strict',
    design: 'native',
    scheme: 'light',
    protectedPort: true,
    readOnly: false,
  },
});
export const editorFor = (model: Model) => model[model.session];
export const connectionPolicy = (model: Model): EditorPolicy => ({
  canConnectPort: ({ node, port }) =>
    model.protectedPort && node === 'audit' && port === 'in'
      ? 'Audit input requires approval.'
      : null,
});
export function update(model: Model, message: Message): Return<Model, Message> {
  return Message.match(message, {
    ObservedInput: ({ session, event: raw }) => {
      // SAFETY: zlozView and the package's native controls emit EditorEvent; the captured session scopes delayed input.
      const event = raw as EditorEvent;
      if (session !== model.session) return { model };
      const before = editorFor(model);
      const next = updateEditor(before, event, connectionPolicy(model));
      const editor =
        event.type === 'SurfaceMeasured' && before.surface === null
          ? updateEditor(next, { type: 'FitViewClicked' })
          : next;
      return { model: { ...model, [session]: editor } };
    },
    SelectedSession: ({ session }) =>
      editorFor(model).gesture.type !== 'idle' ? { model } : { model: { ...model, session } },
    SelectedDesign: ({ design }) =>
      editorFor(model).gesture.type !== 'idle' ? { model } : { model: { ...model, design } },
    SelectedScheme: ({ scheme }) => ({ model: { ...model, scheme } }),
    ClickedProtection: () => ({ model: { ...model, protectedPort: !model.protectedPort } }),
    ClickedReadOnly: () => {
      const readOnly = !model.readOnly;
      return {
        model: {
          ...model,
          readOnly,
          strict: { ...model.strict, readOnly },
          loose: { ...model.loose, readOnly },
        },
      };
    },
  });
}
