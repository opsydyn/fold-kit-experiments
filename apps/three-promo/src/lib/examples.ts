/** The live examples, shared by the landing page and the examples index. */
export const examples = [
  {
    id: 'playground',
    category: 'Reconciliation',
    title: 'Watch every update',
    description:
      'Add, move, reorder, repaint and remove keyed cubes. A live panel shows exactly which operations each update takes and which GPU resources stay alive.',
    alt: 'Reconciliation playground: two shelves of coloured cubes above a panel counting created, updated and moved objects.',
  },
  {
    id: 'sculpture',
    category: 'State',
    title: 'Build, then rewind',
    description:
      'Stack blocks by clicking in 3D. Drag the history slider and the sculpture replays exactly, because the scene is a pure function of the Model.',
    alt: 'Sculpture: coloured blocks stacked on a grey plate, with a palette and a history slider.',
  },
  {
    id: 'shared',
    category: 'Resources',
    title: 'Share what the GPU holds',
    description:
      'Two cubes, one geometry, one material. Repaint or resize them together, remove one, or unmount the scene and release its WebGL context.',
    alt: 'Shared resources: two spinning cubes painted with the same material.',
  },
] as const;
