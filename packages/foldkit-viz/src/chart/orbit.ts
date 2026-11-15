import { pie } from '../shape/pie.js';

/**
 * Orbit geometry: items on one ring around a core, with a halo of category
 * arcs between them. Suited to "big ball of mud" views of a system, where each
 * module orbits the core, its size shows its risk, and the halo shows how the
 * modules integrate.
 *
 * Angles follow d3-shape's arc convention (radians, clockwise from twelve
 * o'clock), so the halo arcs feed `shape/arc` directly. Coordinates are
 * relative to the centre; translate by `centre` to draw them. No rendering or
 * colour policy.
 */

export type OrbitAccessors<T> = Readonly<{
  /** Unique, non-empty identity of the item. */
  key: (datum: T, index: number) => string;
  /** Finite, non-negative magnitude, shown as the item's area. */
  value: (datum: T, index: number) => number;
  /** Non-empty category counted into the halo. */
  halo: (datum: T, index: number) => string;
}>;

export type OrbitConfig = Readonly<{
  /** Side of the square the orbit fills. */
  size: number;
  /** Space kept clear at the edge. Default 8. */
  padding?: number;
  /** Bounds on node radius before the ring's spacing caps them. Default 4 to 12. */
  nodeRadius?: Readonly<{ min: number; max: number }>;
  /** Values mapped to the radius bounds; others are clamped. Default `[0, largest value]`. */
  valueDomain?: readonly [number, number];
  /** Gap between the nodes and the halo. Default 6. */
  ringGap?: number;
  /** Width of the halo band; 0 draws none. Default 10. */
  haloWidth?: number;
  /** Padding between halo arcs, in radians. Default 0.04. */
  haloPadAngle?: number;
  /** Gap between the halo and the core. Default 6. */
  coreGap?: number;
  /** The core's share of the room inside the halo, in (0, 1]. Default 1. */
  coreScale?: number;
}>;

export type OrbitNode<T> = Readonly<{
  datum: T;
  key: string;
  index: number;
  value: number;
  angle: number;
  x: number;
  y: number;
  radius: number;
}>;

export type OrbitHaloArc = Readonly<{
  key: string;
  count: number;
  startAngle: number;
  endAngle: number;
  padAngle: number;
  innerRadius: number;
  outerRadius: number;
}>;

export type OrbitGeometry<T> = Readonly<{
  size: number;
  /** Centre of the square, on both axes. */
  centre: number;
  /** The ring the node centres sit on. */
  ring: Readonly<{ radius: number }>;
  /** Node radius bounds after the ring's spacing has capped them. */
  nodeRadius: Readonly<{ min: number; max: number }>;
  halo: Readonly<{
    innerRadius: number;
    outerRadius: number;
    arcs: ReadonlyArray<OrbitHaloArc>;
  }>;
  core: Readonly<{ radius: number; maxRadius: number }>;
  nodes: ReadonlyArray<OrbitNode<T>>;
}>;

/** Minimum clearance between neighbouring nodes, each side. */
const NODE_CLEARANCE = 1;

const finite = (value: number, message: string): number => {
  if (!Number.isFinite(value)) throw new RangeError(message);
  return value;
};
const nonNegative = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`Orbit ${name} must be finite and non-negative`);
  return value;
};

/**
 * Lays out items on one ring, in data order, clockwise from twelve o'clock.
 *
 * Node area grows linearly with value between the radius bounds. Neighbours
 * never overlap: on a crowded ring both bounds shrink to what the spacing
 * allows, and an orbit too small to fit the nodes at all is rejected rather
 * than drawn overlapping. Duplicate keys are rejected.
 */
export function orbitGeometry<T>(
  data: ReadonlyArray<T>,
  accessors: OrbitAccessors<T>,
  config: OrbitConfig,
): OrbitGeometry<T> {
  const size = finite(config.size, 'Orbit size must be finite and positive');
  if (size <= 0) throw new RangeError('Orbit size must be finite and positive');
  const padding = nonNegative(config.padding ?? 8, 'padding');
  const ringGap = nonNegative(config.ringGap ?? 6, 'ring gap');
  const haloWidth = nonNegative(config.haloWidth ?? 10, 'halo width');
  const haloPadAngle = nonNegative(config.haloPadAngle ?? 0.04, 'halo pad angle');
  const coreGap = nonNegative(config.coreGap ?? 6, 'core gap');
  const coreScale = config.coreScale ?? 1;
  if (!Number.isFinite(coreScale) || coreScale <= 0 || coreScale > 1)
    throw new RangeError('Orbit core scale must be in (0, 1]');
  const bounds = config.nodeRadius ?? { min: 4, max: 12 };
  if (
    !Number.isFinite(bounds.min) ||
    !Number.isFinite(bounds.max) ||
    bounds.min <= 0 ||
    bounds.min > bounds.max
  )
    throw new RangeError('Orbit node radius bounds must be finite with 0 < min <= max');

  const keys = new Set<string>();
  const items = data.map((datum, index) => {
    const key = accessors.key(datum, index);
    if (key === '' || keys.has(key))
      throw new RangeError('Orbit keys must be unique and non-empty');
    keys.add(key);
    const value = nonNegative(accessors.value(datum, index), 'values');
    const halo = accessors.halo(datum, index);
    if (halo === '') throw new RangeError('Orbit halo categories must be non-empty');
    return { datum, key, index, value, halo };
  });

  const domain = config.valueDomain ?? [0, Math.max(0, ...items.map((item) => item.value))];
  if (!Number.isFinite(domain[0]) || !Number.isFinite(domain[1]) || domain[0] > domain[1])
    throw new RangeError('Orbit value domain must be finite and increasing');

  const room = size / 2 - padding;
  if (room <= 0) throw new RangeError('Orbit padding leaves no room');
  const count = items.length;
  // A node of radius r on a ring of radius R - r clears its neighbour when
  // r <= (R - r) sin(pi / n) - clearance, so r <= (R sin(pi / n) - clearance) / (1 + sin(pi / n)).
  const spacing = Math.sin(Math.PI / count);
  const maxRadius =
    count < 2
      ? Math.min(bounds.max, room / 2)
      : Math.min(bounds.max, (room * spacing - NODE_CLEARANCE) / (1 + spacing));
  if (maxRadius <= 0) throw new RangeError(`Orbit of size ${size} is too small for ${count} nodes`);
  const minRadius = Math.min(bounds.min, maxRadius);
  const ringRadius = room - maxRadius;

  const span = domain[1] - domain[0];
  const radiusOf = (value: number): number => {
    const share = span > 0 ? Math.min(1, Math.max(0, (value - domain[0]) / span)) : 0;
    return Math.sqrt(minRadius ** 2 + share * (maxRadius ** 2 - minRadius ** 2));
  };
  const nodes = items.map(({ datum, key, index, value }) => {
    const angle = (index / count) * Math.PI * 2;
    return {
      datum,
      key,
      index,
      value,
      angle,
      x: ringRadius * Math.sin(angle),
      y: -ringRadius * Math.cos(angle),
      radius: radiusOf(value),
    };
  });

  const haloOuter = ringRadius - maxRadius - ringGap;
  const haloInner = haloOuter - haloWidth;
  const coreMax = haloInner - coreGap;
  if (coreMax <= 0) throw new RangeError(`Orbit of size ${size} leaves no room for its core`);

  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.halo, (counts.get(item.halo) ?? 0) + 1);
  const arcs =
    haloWidth === 0
      ? []
      : pie([...counts], { value: ([, total]) => total, sort: null, padAngle: haloPadAngle }).map(
          (slice) => ({
            key: slice.data[0],
            count: slice.data[1],
            startAngle: slice.startAngle,
            endAngle: slice.endAngle,
            padAngle: slice.padAngle,
            innerRadius: haloInner,
            outerRadius: haloOuter,
          }),
        );

  return {
    size,
    centre: size / 2,
    ring: { radius: ringRadius },
    nodeRadius: { min: minRadius, max: maxRadius },
    halo: { innerRadius: haloInner, outerRadius: haloOuter, arcs },
    core: { radius: coreMax * coreScale, maxRadius: coreMax },
    nodes,
  };
}
