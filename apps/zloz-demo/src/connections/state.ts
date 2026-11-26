import { UiSchema } from '@effect/ui';
import {
  captureConnectionDocument,
  createEditorFromConnectionDocument,
  updateEditor,
  type EditorState,
  type EditorPolicy,
  type ZlozGraph,
} from '@opsydyn/foldkit-zloz';
import { BrowserInput } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

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
  strict: Schema.fromJsonString(Schema.Unknown),
  loose: Schema.fromJsonString(Schema.Unknown),
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
const Edge = { id: Schema.String };
export const PathStyle = Schema.Literals(['straight', 'stepped', 'smooth']);
const Event = Schema.Union([
  BrowserInput,
  Schema.Struct({ type: Schema.Literal('FitViewClicked') }),
  Schema.Struct({
    type: Schema.Literal('EdgeReconnected'),
    ...Edge,
    end: Schema.Literals(['source', 'target']),
    endpoint: Schema.Struct({ node: Schema.String, port: Schema.String }),
  }),
  Schema.Struct({
    type: Schema.Literal('EdgePathStyleChanged'),
    ...Edge,
    pathStyle: Schema.NullOr(PathStyle),
  }),
  Schema.Struct({
    type: Schema.Literal('EdgeLabelDraftChanged'),
    ...Edge,
    text: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literals([
      'EdgeLabelEditingStarted',
      'EdgeLabelSaved',
      'EdgeLabelCancelled',
      'EdgeDeleted',
    ]),
    ...Edge,
  }),
]);
export type WorkbenchEvent = typeof Event.Type;
export const decodeBrowserInput = Schema.decodeUnknownSync(BrowserInput);

export const Message = UiSchema.TaggedEnum({
  ObservedInput: { session: Session, event: Event },
  SelectedSession: { session: Session },
  SelectedDesign: { design: PortDesign },
  SelectedScheme: { scheme: ColorScheme },
  ClickedProtection: {},
  ClickedReadOnly: {},
});
export type Message = typeof Message.Type;
export const init = (): Model => ({
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
});
export const editorFor = (model: Model) => model[model.session];
export const connectionPolicy = (model: Model): EditorPolicy => ({
  canConnectPort: ({ node, port }) =>
    model.protectedPort && node === 'audit' && port === 'in'
      ? 'Audit input requires approval.'
      : null,
});
export function update(model: Model, message: Message): Model {
  return Message.match(message, {
    ObservedInput: ({ session, event }) => {
      if (session !== model.session) return model;
      const before = editorFor(model);
      const next = updateEditor(before, event, connectionPolicy(model));
      const editor =
        event.type === 'SurfaceMeasured' && before.surface === null
          ? updateEditor(next, { type: 'FitViewClicked' })
          : next;
      return editor === before ? model : { ...model, [session]: editor };
    },
    SelectedSession: ({ session }) =>
      editorFor(model).gesture.type !== 'idle' ? model : { ...model, session },
    SelectedDesign: ({ design }) =>
      editorFor(model).gesture.type !== 'idle' ? model : { ...model, design },
    SelectedScheme: ({ scheme }) => ({ ...model, scheme }),
    ClickedProtection: () => ({ ...model, protectedPort: !model.protectedPort }),
    ClickedReadOnly: () => {
      const readOnly = !model.readOnly;
      return {
        ...model,
        readOnly,
        strict: { ...model.strict, readOnly },
        loose: { ...model.loose, readOnly },
      };
    },
  });
}
