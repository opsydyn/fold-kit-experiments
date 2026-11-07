import { portAnchor, type FlowNode, type Port } from '@opsydyn/foldkit-flow';

export function nextPort(node: FlowNode, kind: Port['kind']): Port {
  let sequence = 1;
  while (node.ports.some(({ id }) => id === kind + '-' + sequence)) sequence++;
  const side = kind === 'input' ? 'left' : 'right';
  const positions = [
    0,
    ...node.ports.filter((port) => port.side === side).map((port) => portAnchor(port).y),
    1,
  ].sort((a, b) => a - b);
  let largestGap = -1;
  let offset = 0.5;
  for (let index = 1; index < positions.length; index++) {
    const start = positions[index - 1] ?? 0;
    const end = positions[index] ?? 1;
    if (end - start > largestGap) {
      largestGap = end - start;
      offset = (start + end) / 2;
    }
  }
  return {
    id: kind + '-' + sequence,
    label: (kind === 'input' ? 'Input ' : 'Output ') + sequence,
    kind,
    side,
    offset,
  };
}
