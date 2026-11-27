import { UiSchema } from '@effect/ui';
import {
  createEditor,
  updateEditor,
  type EditorState,
  type ZlozGraph,
} from '@opsydyn/foldkit-zloz';
import { BrowserInput } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

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

// The runtime transfers the editor snapshot produced by this island's init.
export const Model = Schema.Struct({ editor: Schema.fromJsonString(Schema.Unknown) });
export type Model = Readonly<{ editor: EditorState }>;

const ComposeEvent = Schema.Union([
  BrowserInput,
  Schema.Struct({ type: Schema.Literals(['FitViewClicked', 'ConnectionListToggled']) }),
]);
export type ComposeEvent = typeof ComposeEvent.Type;

export const Message = UiSchema.TaggedEnum({ ObservedZlozInput: { event: ComposeEvent } });
export type Message = typeof Message.Type;

export const decodeBrowserInput = Schema.decodeUnknownSync(BrowserInput);

export const observe = (event: ComposeEvent): Message => Message.ObservedZlozInput({ event });

export const init = (): Model => ({
  editor: createEditor(initialGraph, {
    fitViewPadding: 24,
    zoomLimits: { minZoom: 0.2, maxZoom: 1.25 },
  }),
});

export const update = (model: Model, { event }: Message): Model => {
  const next = updateEditor(model.editor, event);
  const editor =
    event.type === 'SurfaceMeasured' && model.editor.surface === null
      ? updateEditor(next, { type: 'FitViewClicked' })
      : next;
  return editor === model.editor ? model : { editor };
};
