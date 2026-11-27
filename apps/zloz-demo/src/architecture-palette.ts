import { createArchitectureNode, type ZlozPaletteEntry } from '@opsydyn/foldkit-zloz';

export const workbenchPalette: readonly ZlozPaletteEntry[] = [
  {
    id: 'c4-person',
    label: 'C4 person',
    intent: {
      source: { type: 'palette', id: 'c4-person' },
      anchor: { x: 0, y: 0 },
      snapping: { anchorDistance: 12 },
      fragment: {
        nodes: [
          createArchitectureNode({
            id: 'person',
            label: 'New person',
            position: { x: 0, y: 0 },
            size: { width: 180, height: 140 },
            ports: [],
            architecture: { family: 'c4', role: 'person' },
          }),
        ],
        edges: [],
      },
    },
  },
  {
    id: 'ddd-context',
    label: 'DDD bounded context',
    intent: {
      source: { type: 'palette', id: 'ddd-context' },
      anchor: { x: 0, y: 0 },
      snapping: { anchorDistance: 12 },
      fragment: {
        nodes: [
          createArchitectureNode({
            id: 'context',
            label: 'New context',
            position: { x: 0, y: 0 },
            size: { width: 240, height: 160 },
            ports: [],
            architecture: { family: 'ddd', role: 'bounded-context' },
          }),
        ],
        edges: [],
      },
    },
  },
];
