/** The live examples, shared by the landing page and the examples index. */
export const examples = [
  {
    id: 'playground',
    category: 'Reconciliation',
    title: 'Watch every update',
    description:
      'Add, move, reorder, repaint and remove keyed cubes, and watch them glide into place on a fading grid. A live panel shows exactly which operations each update takes and which GPU resources stay alive.',
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
      'Five geometries in five material kinds, under a sky light, a point light and a spot that casts soft shadows. Drag pieces across the floor, orbit and frame them, and change their finish.',
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
    id: 'toybox',
    category: 'Physics',
    title: 'Throw the toys around',
    description:
      'Crates and balls tumble into a tray under Rapier, a chain swings on joints, and marbles pour in with a body each. Click to kick; in VR, glide and turn with the thumbsticks. Bodies are data; the simulation owns where they are.',
    alt: 'Toybox: coloured crates and balls scattered in a pale tray, casting soft contact shadows.',
  },
  {
    id: 'marbles',
    category: 'Physics',
    title: 'Sort them by colour',
    description:
      'Gold and teal marbles ride a motor-driven wheel onto a grate only teal marbles can touch. Collision groups sort them, named sensors count each bin, and contact forces measure every knock.',
    alt: 'Marble machine: gold and teal marbles behind glass, on a coral paddle wheel above two labelled bins.',
  },
  {
    id: 'gallery',
    category: 'Labels',
    title: 'Every word is data',
    description:
      'A curved title, a code plaque coloured by colour ranges, and spotlit type with a lit material. Panels are sized from each label’s measured layout: write on the wall and watch yours grow.',
    alt: 'Type gallery: a dark curved wall with a gold-and-white title and spotlit plaques of text, one showing coloured code.',
  },
  {
    id: 'bowling',
    category: 'Physics and labels',
    title: 'Ten frames, all data',
    description:
      'Aim, set the line and roll. Named sensors at each pin’s head say which pins went down, a pit sensor says the ball went through, and a troika scoreboard keeps ten-pin score.',
    alt: 'Bowling: a blue ball rolling down a polished wooden lane towards ten white pins, under a dark scoreboard.',
  },
  {
    id: 'arrange',
    category: 'Editing',
    title: 'Move, turn, scale, undo',
    description:
      'A transform gizmo on whatever you select: arrows, planes and rings after three’s TransformControls, as a Foldkit submodel. Snap, work in local axes, and undo every move, because each one is a Message.',
    alt: 'Arrange: a rounded crate with a red, green and blue transform gizmo on a table with a ball, a cone and a ring.',
  },
  {
    id: 'curves',
    category: 'Lines and points',
    title: 'Draw with data',
    description:
      'Drag the handles of a closed curve with a colour gradient while a comet rides it, trailing a fading ribbon and sparkles under a field of stars. Lines, curves, edges, trails, sparkles and stars, all as data.',
    alt: 'Curves: a glowing gradient curve through five outlined handles, a gold comet trailing a ribbon, and stars behind.',
  },
  {
    id: 'room',
    category: 'WebXR',
    title: 'Step into the room',
    description:
      'Furnish a room with ferns, cacti and tulips on the page or let an agent do it through Foldkit DevTools, glide through it in VR, or plant in your own room in AR, where each plant is an anchor and detected planes and meshes are drawn from Messages.',
    alt: 'XR room: a sofa, table and lamp in a warm room, with potted plants on the rug.',
  },
  {
    id: 'workshop',
    category: 'Assets',
    title: 'Load it, play it, let it go',
    description:
      'A glTF robot, a tiled floor texture and two fonts load through Foldkit Commands. Play its clips at any speed under a crisp troika caption, click its parts, and unload it all from the GPU.',
    alt: 'Workshop: a small blue robot with a coral arm raised, standing on a pale tiled floor.',
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
