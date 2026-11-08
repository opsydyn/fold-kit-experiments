import {
  createEditor,
  type EditorState,
  type ZlozGraph,
  type LayoutRequest,
} from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';

export const initialGraph: ZlozGraph = {
  nodes: [
    {
      id: 'source',
      label: 'Source',
      position: { x: 40, y: 70 },
      size: { width: 180, height: 90 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
    {
      id: 'review',
      label: 'Review',
      position: { x: 360, y: 150 },
      size: { width: 180, height: 90 },
      ports: [
        { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
        { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
      ],
    },
  ],
  edges: [],
};
export const Model = Schema.Struct({
  editor: Schema.Unknown,
  active: Schema.NullOr(Schema.Unknown),
  sequence: Schema.Number,
  notice: Schema.String,
});
export type Model = Readonly<{
  editor: EditorState;
  active: LayoutRequest | null;
  sequence: number;
  notice: string;
}>;
export const init = () => ({
  model: {
    editor: createEditor(initialGraph),
    active: null,
    sequence: 0,
    notice: 'A graph editor built with Foldkit Zloz.',
  } satisfies Model,
});
