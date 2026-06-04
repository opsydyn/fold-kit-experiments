import { Schema } from 'effect';
import * as DSB from '../../ui/diverging-stacked-bar';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & { readonly chart: DSB.Model };

// Likert survey: "Rate your agreement with each statement"
const CATEGORIES: ReadonlyArray<DSB.LikertCategory> = [
  { label: 'Strongly disagree', weight: -1.0, color: '#ef4444' },
  { label: 'Disagree', weight: -0.5, color: '#fca5a5' },
  { label: 'Neutral', weight: 0.0, color: '#d1d5db' },
  { label: 'Agree', weight: 0.5, color: '#93c5fd' },
  { label: 'Strongly agree', weight: 1.0, color: '#3b82f6' },
];

const ROWS: ReadonlyArray<DSB.LikertRow> = [
  { label: 'Easy to learn', counts: [5, 12, 18, 38, 27] },
  { label: 'Well documented', counts: [8, 15, 22, 34, 21] },
  { label: 'Good performance', counts: [3, 8, 12, 44, 33] },
  { label: 'Active community', counts: [6, 18, 24, 32, 20] },
  { label: 'Production ready', counts: [4, 9, 14, 41, 32] },
  { label: 'Enjoyable to use', counts: [7, 11, 16, 40, 26] },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = DSB.init({ categories: CATEGORIES, rows: ROWS });
  return [{ chart }, []];
};
