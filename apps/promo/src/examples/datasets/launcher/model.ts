import { Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';

export const Status = defineTaggedUnion({
  Ready: {},
  Pending: {},
  Opened: {},
  Failed: { error: Schema.String },
});
export const Props = Schema.Struct({ templateUrl: Schema.String });
export type Props = typeof Props.Type;
export const EditorStatus = defineTaggedUnion({
  Loading: {},
  Ready: {},
  Failed: { error: Schema.String },
});
export const Editor = defineTaggedUnion({
  Idle: {},
  Session: { revision: Schema.Number, status: EditorStatus },
});
export const Model = Schema.Struct({
  templateUrl: Schema.String,
  status: Status,
  editor: Editor,
  editorVisible: Schema.Boolean,
});
export type Model = typeof Model.Type;
export interface InitReturn {
  readonly model: Model;
}
export const init = (props: Props): InitReturn => ({
  model: {
    ...Schema.decodeUnknownSync(Props)(props),
    status: Status.Ready(),
    editor: Editor.Idle(),
    editorVisible: false,
  },
});
