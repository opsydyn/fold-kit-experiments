import { Command } from '@effect/ui';
import { SourceLine } from '@opsydyn/dataset-explorer/source-line-core';
import { focusSourceLine, highlightSource } from '@opsydyn/dataset-explorer/source-ui';
import sdk from '@stackblitz/sdk';
import { Data, Effect, Schema } from 'effect';

import { Message } from './message';
import { Panel, Settings } from './model';
import { projectFiles, projectZip } from './project';

class ProjectPreparationError extends Data.TaggedError('ProjectPreparationError')<{
  readonly message: string;
}> {}

export const CopySource = Command.make(
  'CopySource',
  { args: { source: Schema.String } },
  ({ source }) =>
    Effect.tryPromise({
      try: () => navigator.clipboard.writeText(source),
      catch: () => 'Copy was blocked. Select the code and copy it with your keyboard.',
    }).pipe(
      Effect.match({
        onSuccess: () => Message.SucceededAction({ action: 'copy' }),
        onFailure: (error) => Message.FailedAction({ error }),
      }),
    ),
);

export const ExportProject = Command.make(
  'ExportProject',
  {
    args: {
      action: Schema.Literals(['download', 'playground']),
      settings: Settings,
      templateUrl: Schema.String,
    },
  },
  ({ action, settings, templateUrl }) =>
    Effect.tryPromise({
      try: async (signal) => {
        const response = await fetch(templateUrl, { signal });
        if (!response.ok) throw new ProjectPreparationError({ message: 'Project download failed' });
        const template = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.String))(
          await response.json(),
        );
        signal.throwIfAborted();
        const files = projectFiles(template, settings);
        if (action === 'playground') {
          sdk.openProject(
            {
              title: 'Foldkit Viz — Live line',
              description: 'Explore line geometry with Effect UI.',
              template: 'node',
              files,
            },
            { newWindow: false, openFile: 'src/settings.ts' },
          );
        } else {
          const url = URL.createObjectURL(
            new Blob([new Uint8Array(projectZip(files))], { type: 'application/zip' }),
          );
          const link = document.createElement('a');
          link.href = url;
          link.download = 'foldkit-viz-line.zip';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      },
      catch: () => 'Could not prepare the project. Please try again.',
    }).pipe(
      Effect.match({
        onSuccess: () => Message.SucceededAction({ action }),
        onFailure: (error) => Message.FailedAction({ error }),
      }),
    ),
);

export const HighlightSource = Command.make(
  'HighlightLineSource',
  { args: { source: Schema.String, language: Schema.String } },
  ({ source, language }) =>
    highlightSource(source, language).pipe(
      Effect.map((highlightedSource) => Message.SettledHighlightedSource({ highlightedSource })),
    ),
);

export const FocusSourceLine = Command.make(
  'FocusLineSourceLine',
  { args: SourceLine.fields },
  (location) =>
    focusSourceLine(location).pipe(Effect.map(() => Message.CompletedSourceLineFocus())),
);

export const FocusPanel = Command.make('FocusLinePanel', { args: { panel: Panel } }, ({ panel }) =>
  Effect.sync(() => {
    document.getElementById('line-tab-' + panel)?.focus();
    return Message.CompletedPanelFocus();
  }),
);
