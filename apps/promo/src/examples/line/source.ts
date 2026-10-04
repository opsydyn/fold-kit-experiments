import { Schema } from 'effect';

export const SourceName = Schema.Literals([
  'settings.ts',
  'chart.ts',
  'measurement.ts',
  'shared/measurement.ts',
  'shared/frame.ts',
  'main.ts',
  'model.ts',
  'message.ts',
  'update.ts',
  'view.ts',
  'command.ts',
  'editor-mount.ts',
  'project.ts',
  'chart.css',
  'source.ts',
]);
export type SourceName = typeof SourceName.Type;
export const Source = Schema.Struct({ name: SourceName, content: Schema.String });
