import { orbitGeometry as rootOrbit, type OrbitGeometry } from '@opsydyn/foldkit-viz';
import {
  orbitGeometry,
  type OrbitAccessors,
  type OrbitConfig,
} from '@opsydyn/foldkit-viz/chart/orbit';

const check = (condition: boolean, reason: string): void => {
  if (!condition) throw new Error(reason);
};
const close = (actual: number, expected: number) =>
  check(Math.abs(actual - expected) < 1e-9, `Expected ${expected}, got ${actual}`);
const integrations = ['intrusive', 'functional', 'model', 'contract'] as const;
const data = integrations.map((kind) => ({ id: `relationship-${kind}`, kind }));
type Datum = (typeof data)[number];
const accessors: OrbitAccessors<Datum> = { key: (d) => d.id, value: () => 1, halo: (d) => d.kind };
const config: OrbitConfig = { size: 300, nodeRadius: { min: 22, max: 22 } };
const geometry: OrbitGeometry<Datum> = orbitGeometry(data, accessors, config);
check(rootOrbit === orbitGeometry, 'Root and pure subpath must expose the same function');
check(geometry.nodes.length === 4, 'All four integrations must survive layout');
check(
  JSON.stringify(geometry.halo.arcs.map((arc) => [arc.key, arc.count])) ===
    '[["intrusive",1],["functional",1],["model",1],["contract",1]]',
  'Halo must retain all four category counts',
);
const expected = [
  [0, -120],
  [120, 0],
  [0, 120],
  [-120, 0],
] as const;
for (const [index, node] of geometry.nodes.entries()) {
  check(
    node.datum === data[index] && node.key === data[index]?.id,
    'Keep original datum identity and order',
  );
  close(node.radius, 22);
  close(node.x, expected[index]![0]);
  close(node.y, expected[index]![1]);
}
close(geometry.core.radius, 76);
for (const length of [1, 12]) {
  const page = orbitGeometry(
    Array.from({ length }, (_, index) => ({ id: `edge-${index}`, kind: 'model' as const })),
    accessors,
    config,
  );
  check(
    page.nodes.every((node) => node.radius === 22),
    'Bounded pages keep equal 44px geometry',
  );
  close(page.core.radius, 76);
}
const weighted = orbitGeometry(
  [
    { id: 'a', kind: 'model', weight: 8 },
    { id: 'b', kind: 'contract', weight: 2 },
  ],
  { key: (d) => d.id, value: (d) => d.weight, halo: (d) => d.kind },
  { size: 300 },
);
check(
  JSON.stringify(weighted.halo.arcs.map((arc) => arc.count)) === '[1,1]',
  'Halo counts items, not accessor magnitudes',
);
check(orbitGeometry([], accessors, config).nodes.length === 0, 'Empty geometry remains empty');
console.log('headless-orbit-ok');
