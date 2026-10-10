import { SourceHighlighter, highlightedTree } from '@opsydyn/dataset-explorer/highlighting';
import { SourceLine, focusSourceLine } from '@opsydyn/dataset-explorer/source-lines';
// Browser delivery is an imperative boundary, entirely inside Command Effects.
/* oxlint-disable linteffect/no-if-statement, linteffect/no-magic-domain-string */
import sdk from '@stackblitz/sdk';
import { Data, Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { Settings } from '../../../../web/src/apps/comparison/settings';
import { Message } from './message';
import { projectFiles, projectZip, settingsPath } from './project';

class ProjectPreparationError extends Data.TaggedError('ProjectPreparationError')<{
  readonly message: string;
}> {}

export const CopySource = Command.define('CopySource', {
  args: { source: Schema.String },
  messages: [Message.SucceededAction, Message.FailedAction],
  execute: ({ source }) =>
    Effect.tryPromise({
      try: () => navigator.clipboard.writeText(source),
      catch: () => 'Copy was blocked. Select the code and copy it with your keyboard.',
    }).pipe(
      Effect.map(() => Message.SucceededAction({ action: 'copy' })),
      Effect.catch((error) => Effect.succeed(Message.FailedAction({ error }))),
    ),
});

export const ExportProject = Command.define('ExportProject', {
  args: {
    action: Schema.Literals(['download', 'playground']),
    settings: Settings,
    templateUrl: Schema.String,
  },
  messages: [Message.SucceededAction, Message.FailedAction],
  execute: ({ action, settings, templateUrl }) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(templateUrl);
        if (!response.ok) throw new ProjectPreparationError({ message: 'Project download failed' });
        const template = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.String))(
          await response.json(),
        );
        const files = projectFiles(template, settings);
        if (action === 'playground') {
          sdk.openProject(
            {
              title: 'Foldkit Viz - Chart comparison',
              description: 'Compare linked views of illustrative salary data.',
              template: 'node',
              files: { ...files },
            },
            { newWindow: false, openFile: 'src/' + settingsPath },
          );
        } else {
          const url = URL.createObjectURL(
            new Blob([new Uint8Array(projectZip(files))], { type: 'application/zip' }),
          );
          const link = document.createElement('a');
          link.href = url;
          link.download = 'foldkit-viz-comparison.zip';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      },
      catch: () => 'Could not prepare the project. Please try again.',
    }).pipe(
      Effect.map(() => Message.SucceededAction({ action })),
      Effect.catch((error) => Effect.succeed(Message.FailedAction({ error }))),
    ),
});

export const HighlightSource = Command.define('HighlightSource', {
  args: { source: Schema.String, language: Schema.String },
  messages: [Message.SettledHighlightedSource],
  execute: ({ source, language }) =>
    SourceHighlighter.get.pipe(
      Effect.map((engine) =>
        Message.SettledHighlightedSource({
          highlightedSource: { source, language, tree: highlightedTree(source, language, engine) },
        }),
      ),
      Effect.catch(() =>
        Effect.succeed(
          Message.SettledHighlightedSource({
            highlightedSource: { source, language, tree: highlightedTree(source, language) },
          }),
        ),
      ),
    ),
});

export const FocusSourceLine = Command.define('FocusSourceLine', {
  args: SourceLine.fields,
  messages: [Message.CompletedSourceLineFocus],
  execute: (location) =>
    focusSourceLine(location).pipe(Effect.map(() => Message.CompletedSourceLineFocus())),
});
