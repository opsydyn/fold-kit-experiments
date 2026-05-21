// Chord layout + ribbon path — D3 d3-chord v3 parity
import { path } from './path';

const halfPi = Math.PI / 2;
const tau = 2 * Math.PI;

// TYPES

export type ChordSubgroup = Readonly<{
  index: number;
  subindex: number;
  startAngle: number;
  endAngle: number;
  value: number;
}>;

export type Chord = Readonly<{
  source: ChordSubgroup;
  target: ChordSubgroup;
}>;

export type ChordGroup = Readonly<{
  index: number;
  startAngle: number;
  endAngle: number;
  value: number;
}>;

export type ChordLayout = Readonly<{
  groups: ReadonlyArray<ChordGroup>;
  chords: ReadonlyArray<Chord>;
}>;

export type ChordConfig = Readonly<{
  padAngle?: number;
  sortGroups?: ((a: number, b: number) => number) | null;
  sortSubgroups?: ((a: number, b: number) => number) | null;
}>;

// CHORD LAYOUT

export function chord(
  matrix: ReadonlyArray<ReadonlyArray<number>>,
  config: ChordConfig = {},
): ChordLayout {
  const { padAngle = 0, sortGroups = null, sortSubgroups = null } = config;
  const n = matrix.length;

  // Compute group sums
  const groupSums = new Float64Array(n);
  for (let i = 0; i < n; ++i) {
    for (let j = 0; j < n; ++j) {
      groupSums[i] += matrix[i]?.[j] ?? 0;
    }
  }

  const totalSum = groupSums.reduce((s, v) => s + v, 0);
  const k = totalSum > 0 ? Math.max(0, tau - padAngle * n) / totalSum : 0;

  // Group ordering
  const groupOrder = Array.from({ length: n }, (_, i) => i);
  if (sortGroups) groupOrder.sort((a, b) => sortGroups(groupSums[a] ?? 0, groupSums[b] ?? 0));

  // Subgroup index per group: which targets have nonzero flow
  const subgroupOrders: number[][] = groupOrder.map((gi) => {
    const subs = Array.from({ length: n }, (_, j) => j).filter(
      (j) => (matrix[gi]?.[j] ?? 0) > 0 || (matrix[j]?.[gi] ?? 0) > 0,
    );
    if (sortSubgroups)
      subs.sort((a, b) => sortSubgroups(matrix[gi]?.[a] ?? 0, matrix[gi]?.[b] ?? 0));
    return subs;
  });

  // Build subgroups and groups
  const subgroups: ChordSubgroup[][] = Array.from({ length: n }, () => new Array(n));
  const groups: ChordGroup[] = new Array(n);

  let x = 0;
  for (let gi = 0; gi < n; ++gi) {
    const i = groupOrder[gi] ?? gi;
    const x0 = x;
    const subs = subgroupOrders[gi] ?? [];
    for (const j of subs) {
      const v = matrix[i]?.[j] ?? 0;
      const startAngle = x;
      x += v * k;
      const row = subgroups[i];
      if (row) row[j] = { index: i, subindex: j, startAngle, endAngle: x, value: v };
    }
    groups[i] = {
      index: i,
      startAngle: x0,
      endAngle: x === x0 ? x0 + padAngle : x,
      value: groupSums[i] ?? 0,
    };
    x += padAngle;
  }

  // Build chords: for each pair (i, j) with i < j pick the larger as source
  const chords: Chord[] = [];
  for (let gi = 0; gi < n; ++gi) {
    const i = groupOrder[gi] ?? gi;
    for (let gj = gi + 1; gj < n; ++gj) {
      const j = groupOrder[gj] ?? gj;
      const sij = subgroups[i]?.[j];
      const sji = subgroups[j]?.[i];
      if (!sij || !sji) continue;
      if (sij.value === 0 && sji.value === 0) continue;
      if (sij.value < sji.value) {
        chords.push({ source: sji, target: sij });
      } else {
        chords.push({ source: sij, target: sji });
      }
    }
    // self-chord
    const sii = subgroups[i]?.[i];
    if (sii && sii.value > 0) {
      chords.push({ source: sii, target: sii });
    }
  }

  return { groups, chords };
}

// RIBBON PATH

export type RibbonConfig = Readonly<{
  radius: number;
  sourceRadius?: number;
  targetRadius?: number;
}>;

export function ribbon(source: ChordSubgroup, target: ChordSubgroup, config: RibbonConfig): string {
  const { radius, sourceRadius = radius, targetRadius = radius } = config;
  const p = path(3);

  const sa0 = source.startAngle - halfPi;
  const sa1 = source.endAngle - halfPi;
  const ta0 = target.startAngle - halfPi;
  const ta1 = target.endAngle - halfPi;

  const sx0 = sourceRadius * Math.cos(sa0);
  const sy0 = sourceRadius * Math.sin(sa0);

  p.moveTo(sx0, sy0);
  p.arc(0, 0, sourceRadius, sa0, sa1);

  if (source !== target) {
    p.quadraticCurveTo(0, 0, targetRadius * Math.cos(ta0), targetRadius * Math.sin(ta0));
    p.arc(0, 0, targetRadius, ta0, ta1);
  }

  p.quadraticCurveTo(0, 0, sx0, sy0);
  p.closePath();

  return p.toString();
}
