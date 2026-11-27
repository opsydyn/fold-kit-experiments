import {
  createEditor,
  updateEditor,
  type EditorState,
  type Size,
  type ZlozGraph,
} from '@opsydyn/foldkit-zloz';

import type { Scene } from './contracts';

export const sceneWidth = 1536;
export const sceneHeight = 864;

export function graphFor(scene: Scene): ZlozGraph {
  return {
    nodes: scene.tokens.map((token) => ({
      id: token.id,
      label: token.label,
      position: { x: token.x, y: token.y },
      size: { width: 94, height: 117 },
      ports: [],
    })),
    edges: [],
  };
}

export const boardEditor = (scene: Scene, readOnly = false) =>
  createEditor(graphFor(scene), {
    readOnly,
    snapToGrid: false,
    zoomLimits: { minZoom: 0.1, maxZoom: 3 },
    viewport: { x: 0, y: 0, zoom: 0.5 },
  });

export function fit(editor: EditorState, surface: Size | null): EditorState {
  if (!surface || surface.width <= 0 || surface.height <= 0) return editor;
  const zoom = Math.max(0.1, Math.min(surface.width / sceneWidth, surface.height / sceneHeight));
  return updateEditor(editor, {
    type: 'ViewportChanged',
    viewport: {
      x: (surface.width - sceneWidth * zoom) / 2,
      y: (surface.height - sceneHeight * zoom) / 2,
      zoom,
    },
  });
}
