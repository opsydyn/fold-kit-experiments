// Minimal pinned upstream compatibility probe. This is expected to fail under
// exactOptionalPropertyTypes: true; no casts, dependency upgrades or skipped errors.
import * as Domain from '@alchemy.run/domain';
import { Schema } from 'effect';
class Changed extends Domain.Event('Changed', {}) {}
class Change extends Domain.Command('Change', {
  target: Schema.String,
  input: {},
  events: [Changed],
}) {}
class Item extends Domain.Aggregate('Item', {
  id: Schema.String,
  state: Schema.Number,
  initial: 0,
  commands: [Change],
  decide: { Change: () => [] },
  evolve: { Changed: (state) => state },
}) {}
export const probe: Domain.Model.Any = Domain.Model('Probe', { aggregates: [Item] });
