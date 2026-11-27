import { Command } from '@effect/ui';
import sdk from '@stackblitz/sdk';
import { Data, Effect, Schema } from 'effect';

import { Message } from './message';

class ProjectPreparationError extends Data.TaggedError('ProjectPreparationError')<{
  readonly message: string;
}> {}

export const OpenPlayground = Command.make(
  'OpenPlayground',
  { args: { templateUrl: Schema.String } },
  ({ templateUrl }) =>
    Effect.tryPromise({
      try: async (signal) => {
        const response = await fetch(templateUrl, { signal });
        if (!response.ok) throw new ProjectPreparationError({ message: 'Project download failed' });
        const files = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.String))(
          await response.json(),
        );
        signal.throwIfAborted();
        sdk.openProject(
          {
            title: 'Foldkit Viz — Dataset explorer',
            description: 'Explore Effect UI, chart composition and cached datasets.',
            template: 'node',
            files,
          },
          { newWindow: false, openFile: 'src/query.ts' },
        );
      },
      catch: () => 'Could not open StackBlitz. Please try again or download the project.',
    }).pipe(
      Effect.match({
        onSuccess: () => Message.SucceededPlayground(),
        onFailure: (error) => Message.FailedPlayground({ error }),
      }),
    ),
);
