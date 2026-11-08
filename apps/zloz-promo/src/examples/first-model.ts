import { createArchitectureNode, serializeGraph } from '@opsydyn/foldkit-zloz';

const system = createArchitectureNode({
  id: 'orders',
  label: 'Order platform',
  position: { x: 0, y: 0 },
  size: { width: 240, height: 160 },
  ports: [],
  architecture: { family: 'c4', role: 'software-system' },
});

export const document = serializeGraph({ nodes: [system], edges: [] });
