import {
  createEditor,
  updateEditor,
  type EditorEvent,
  type EditorState,
  type ZlozGraph,
} from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
import type { Return } from 'foldkit/update';

const input = { id: 'in', label: 'Input', kind: 'input', side: 'top', offset: 0.5 } as const;
const output = { id: 'out', label: 'Output', kind: 'output', side: 'bottom', offset: 0.5 } as const;

/** Vertical workflow keeps node text legible at both desktop and narrow widths. */
const initialGraph: ZlozGraph = {
  nodes: [
    {
      id: 'draft',
      label: 'Draft',
      position: { x: 80, y: 30 },
      size: { width: 220, height: 80 },
      ports: [output],
    },
    {
      id: 'review',
      label: 'Review',
      position: { x: 80, y: 180 },
      size: { width: 220, height: 80 },
      ports: [input, output],
    },
    {
      id: 'publish',
      label: 'Publish',
      position: { x: 80, y: 330 },
      size: { width: 220, height: 80 },
      ports: [input],
    },
  ],
  edges: [
    {
      id: 'draft-review',
      source: { node: 'draft', port: 'out' },
      target: { node: 'review', port: 'in' },
      pathStyle: 'smooth',
    },
  ],
};

// Opaque package state is constructed only by createEditor/updateEditor, never decoded from props.
export const Model = Schema.Struct({ editor: Schema.Unknown });
export type Model = Readonly<{ editor: EditorState }>;
export const Message = defineMessageUnion({ ObservedZlozInput: { event: Schema.Unknown } });
export type Message = typeof Message.Type;

export const observe = (event: EditorEvent): Message => Message.ObservedZlozInput({ event });

export const init = (): Return<Model, Message> => ({
  model: {
    editor: createEditor(initialGraph, {
      fitViewPadding: 24,
      zoomLimits: { minZoom: 0.2, maxZoom: 1.25 },
    }),
  },
});

export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    ObservedZlozInput: ({ event: raw }) => {
      // SAFETY: zlozView and the controls below emit the public, typed EditorEvent contract.
      const event = raw as EditorEvent;
      const next = updateEditor(model.editor, event);
      const editor =
        event.type === 'SurfaceMeasured' && model.editor.surface === null
          ? updateEditor(next, { type: 'FitViewClicked' })
          : next;
      return { model: { ...model, editor } };
    },
  });
