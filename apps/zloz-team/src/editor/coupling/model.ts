import type { DiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';
import { Schema } from 'effect';

import type { CouplingProjection } from '../coupling-projection';

export const PAGE_SIZE = 12;
export const Model = Schema.Struct({
  source: Schema.Unknown,
  projection: Schema.Unknown,
  cohort: Schema.NullOr(Schema.String),
  page: Schema.Number,
  removedPage: Schema.Number,
  width: Schema.NullOr(Schema.Number),
  announcement: Schema.String,
});
// Only init/observe install validated confirmed-frame references and pure projections.
export type Model = Omit<typeof Model.Type, 'source' | 'projection'> &
  Readonly<{
    source: DiagramFrame | null;
    projection: CouplingProjection;
  }>;
export const init = (): Model => ({
  source: null,
  projection: { status: 'waiting' },
  cohort: null,
  page: 0,
  removedPage: 0,
  width: null,
  announcement: '',
});
