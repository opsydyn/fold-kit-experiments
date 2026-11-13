// Expected pinned upstream strict-optional failure: state-less View.definition.state.
import * as Domain from '@alchemy.run/domain';
import { Schema } from 'effect';
class Changed extends Domain.Event('Changed', {}) {}
class Change extends Domain.Command('Change', {
  target: Schema.String,
  input: {},
  events: [Changed],
}) {}
class Item extends Domain.Aggregate('Item', {
  read: {},
  id: Schema.String,
  state: Schema.Number,
  initial: 0,
  commands: [Change],
  decide: { Change: () => [] },
  evolve: { Changed: (state) => state },
}) {}
class Stateless extends Domain.View('Stateless', {
  from: [Item],
  key: Item,
  events: [Changed],
  emit: { Changed: () => [] },
}) {}
export const probe: Domain.Model.Any = Domain.Model('Probe', {
  aggregates: [Item],
  views: [Stateless],
});
