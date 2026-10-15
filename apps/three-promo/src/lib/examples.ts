/** The live examples, shared by the landing page and the examples index. */
export const examples = [
  {
    id: 'playground',
    category: 'Reconciliation',
    title: 'Watch every update',
    description:
      'Add, move, reorder, repaint and remove keyed cubes, and watch them glide into place. A live panel shows exactly which operations each update takes and which GPU resources stay alive.',
    alt: 'Reconciliation playground: two shelves of coloured cubes above a panel counting created, updated and moved objects.',
  },
  {
    id: 'sculpture',
    category: 'State',
    title: 'Build, then rewind',
    description:
      'Stack blocks, balls and drums by clicking in 3D. Drag the history slider and the sculpture replays exactly, because the scene is a pure function of the Model.',
    alt: 'Sculpture: coloured blocks, balls and drums stacked on a grey plate, with a palette, piece picker and history slider.',
  },
  {
    id: 'bars',
    category: 'Data',
    title: 'Chart in three dimensions',
    description:
      'Foldkit Viz scales place every bar and effect-three eases them as the data changes. Hover to read, click to pin, double-click to isolate a series.',
    alt: '3D bar chart: three rows of blue, orange and green bars for six months, with gridlines on the back wall.',
  },
  {
    id: 'studio',
    category: 'Light and material',
    title: 'Drag it into the light',
    description:
      'Five geometries in five material kinds, under a sky light, a point light and a spot that casts soft shadows. Drag pieces across the floor and change their finish.',
    alt: 'Studio: a torus, capsule, cone, ball and crate in different finishes on a pale floor, casting soft shadows under a spot light.',
  },
  {
    id: 'city',
    category: 'Performance',
    title: 'A city in one draw call',
    description:
      'Ten thousand buildings in one instanced mesh. Hover and clicks rewrite single instances, frames render only on change, and resolution follows measured performance.',
    alt: 'City: a grid of ten thousand blue buildings, tallest in the centre, on a pale ground.',
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
