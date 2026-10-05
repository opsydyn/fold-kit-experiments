export const repository = 'https://github.com/opsydyn/fold-kit-experiments';
export const sourceRoot = repository + '/tree/main/packages/foldkit-viz/src';
export const examples = [
  {
    id: 'connections',
    category: 'Network',
    title: 'Connections',
    description:
      'See how six groups connect. A chord layout turns a matrix of relationships into arcs and ribbons.',
    module: 'shape/chord',
  },
  {
    id: 'flow',
    category: 'Flow',
    title: 'Where it flows',
    description:
      'Follow a journey from source to destination. A Sankey layout makes the size of each flow visible.',
    module: 'shape/sankey',
  },
  {
    id: 'relationships',
    category: 'Scatter',
    title: 'See relationships',
    description:
      'Map two dimensions with linear scales. Colour reveals groups; each point retains its own coordinates.',
    module: 'math/scale',
  },
  {
    id: 'places',
    category: 'Geographic',
    title: 'Place matters',
    description:
      'Project geographic features into SVG paths. This regional map of Europe uses illustrative colour bands, not country statistics.',
    module: 'shape/geo',
  },
  {
    id: 'curves',
    category: 'Line',
    title: 'Choose your curve',
    description:
      'The same points, a different character. Compare smooth, straight and stepped interpolation.',
    module: 'shape/line',
  },
  {
    id: 'distribution',
    category: 'Histogram',
    title: 'Find the distribution',
    description:
      'Bin two sets of values into equal intervals. Overlapping distributions reveal patterns that averages can hide.',
    module: 'math/bin',
  },
] as const;
export type ExampleId = (typeof examples)[number]['id'];

export const galleryExamples = [
  ...examples,
  {
    id: 'grouped-bars',
    category: 'Bars',
    title: 'Compare the parts',
    description:
      'Nested band scales compare several series within each category. Try grouped and stacked bars in either orientation.',
    module: 'chart/bars',
    live: '/examples/bars/',
  },
  {
    id: 'stacked-bars',
    category: 'Bars',
    title: 'Build the total',
    description:
      'Stack series to show composition. Each rectangle retains its datum, category and series identity.',
    module: 'chart/bars',
    live: '/examples/bars/',
  },
  {
    id: 'area',
    category: 'Area',
    title: 'Follow the volume',
    description:
      'An area path connects values to a baseline, showing how a quantity changes across an interval.',
    module: 'shape/area',
  },
  {
    id: 'streamgraph',
    category: 'Stack',
    title: 'Find the rhythm',
    description: 'A centred stack reveals the changing contribution of multiple series.',
    module: 'shape/stack',
  },
  {
    id: 'donut',
    category: 'Composition',
    title: 'Parts of a whole',
    description: 'A pie layout supplies angles; arc geometry gives each slice its shape.',
    module: 'shape/pie',
  },
  {
    id: 'radar',
    category: 'Radial',
    title: 'Compare profiles',
    description: 'Radial lines compare illustrative profiles across six dimensions.',
    module: 'shape/lineRadial',
  },
  {
    id: 'heatmap',
    category: 'Matrix',
    title: 'Spot the intensity',
    description: 'A grid maps two categories to position and a third value to colour.',
    module: 'math/scale',
  },
  {
    id: 'treemap',
    category: 'Hierarchy',
    title: 'Divide the space',
    description: 'A squarified treemap gives each leaf space in proportion to its value.',
    module: 'hierarchy',
  },
  {
    id: 'pack',
    category: 'Hierarchy',
    title: 'Gather the groups',
    description: 'Packed circles reveal the relative size of leaves in a hierarchy.',
    module: 'hierarchy',
  },
  {
    id: 'tree',
    category: 'Hierarchy',
    title: 'Trace the branches',
    description: 'A tidy tree positions related nodes; SVG links make the structure visible.',
    module: 'hierarchy',
  },
  {
    id: 'box-plot',
    category: 'Statistics',
    title: 'Read the spread',
    description: 'Quartiles, medians and whiskers describe the shape of each distribution.',
    module: 'math/stats',
  },
  {
    id: 'violin',
    category: 'Statistics',
    title: 'See the density',
    description:
      'Kernel density estimation reveals where observations cluster within a distribution.',
    module: 'math/stats',
  },
] as const;
export type GalleryId = (typeof galleryExamples)[number]['id'];
