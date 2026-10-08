import { Schema } from 'effect';

export { initialSettings } from './initial-settings';

const PanelId = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

export const Settings = Schema.Struct({
  panels: Schema.Array(
    Schema.Struct({
      id: PanelId,
      kind: Schema.Literals(['scatter', 'histogram']),
    }),
  ).check(Schema.isMaxLength(4)),
  linkInspections: Schema.Boolean,
  nextPanelId: PanelId,
}).check(
  Schema.makeFilter(({ panels }) => new Set(panels.map(({ id }) => id)).size === panels.length, {
    message: 'Panel IDs must be unique',
  }),
  Schema.makeFilter(({ panels, nextPanelId }) => panels.every(({ id }) => id < nextPanelId), {
    message: 'The next panel ID must be greater than all captured panel IDs',
  }),
);
export type Settings = typeof Settings.Type;
