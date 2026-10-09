export const repository = 'https://github.com/opsydyn/fold-kit-experiments';
export const sourceRoot = repository + '/tree/main/packages/foldkit-viz/src';
export const comparisonExample = {
  title: 'Chart comparison',
  href: '/examples/comparison/',
} as const;
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
