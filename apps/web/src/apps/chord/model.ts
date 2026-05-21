import { Schema } from 'effect';
import * as ChordChart from '../../ui/chord-chart';

export const Model = Schema.Struct({ chord: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chord'> & {
  readonly chord: ChordChart.Model;
};

// Tech sector cross-investment flows ($B): Cloud, Software, Devices, Social, AI
const GROUPS: ReadonlyArray<ChordChart.GroupMeta> = [
  { label: 'Cloud', color: '#3b82f6' },
  { label: 'Software', color: '#8b5cf6' },
  { label: 'Devices', color: '#f97316' },
  { label: 'Social', color: '#ec4899' },
  { label: 'AI', color: '#14b8a6' },
];

// Symmetric flow matrix — how much each sector invests in / depends on others
const MATRIX: ReadonlyArray<ReadonlyArray<number>> = [
  [11, 28, 15, 10, 32], // Cloud
  [28, 9, 12, 8, 24], // Software
  [15, 12, 18, 6, 9], // Devices
  [10, 8, 6, 5, 18], // Social
  [32, 24, 9, 18, 14], // AI
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chord] = ChordChart.init({ matrix: MATRIX, groups: GROUPS });
  return [{ chord }, []];
};
