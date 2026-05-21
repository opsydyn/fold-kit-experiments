import { Schema } from 'effect';
import * as SankeyChart from '../../ui/sankey-chart';

export const Model = Schema.Struct({ sankey: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'sankey'> & {
  readonly sankey: SankeyChart.Model;
};

// UK energy flow (simplified): sources → carriers → end uses
const NODES: ReadonlyArray<SankeyChart.NodeMeta> = [
  { id: 'Coal', label: 'Coal', color: '#78716c' },
  { id: 'Gas', label: 'Gas', color: '#f97316' },
  { id: 'Nuclear', label: 'Nuclear', color: '#8b5cf6' },
  { id: 'Renewables', label: 'Renewables', color: '#14b8a6' },
  { id: 'Electricity', label: 'Electricity', color: '#3b82f6' },
  { id: 'Heating', label: 'Heating', color: '#ef4444' },
  { id: 'Residential', label: 'Residential', color: '#22c55e' },
  { id: 'Commercial', label: 'Commercial', color: '#a855f7' },
  { id: 'Industrial', label: 'Industrial', color: '#f59e0b' },
  { id: 'Losses', label: 'Losses', color: '#94a3b8' },
];

const LINKS = [
  { source: 'Coal', target: 'Electricity', value: 50 },
  { source: 'Coal', target: 'Heating', value: 20 },
  { source: 'Gas', target: 'Electricity', value: 75 },
  { source: 'Gas', target: 'Heating', value: 25 },
  { source: 'Nuclear', target: 'Electricity', value: 70 },
  { source: 'Renewables', target: 'Electricity', value: 45 },
  { source: 'Renewables', target: 'Heating', value: 15 },
  { source: 'Electricity', target: 'Residential', value: 70 },
  { source: 'Electricity', target: 'Commercial', value: 60 },
  { source: 'Electricity', target: 'Industrial', value: 70 },
  { source: 'Electricity', target: 'Losses', value: 40 },
  { source: 'Heating', target: 'Residential', value: 30 },
  { source: 'Heating', target: 'Commercial', value: 20 },
  { source: 'Heating', target: 'Industrial', value: 10 },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [sankey] = SankeyChart.init({ nodes: NODES, links: LINKS });
  return [{ sankey }, []];
};
