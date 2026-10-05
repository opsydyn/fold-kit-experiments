import sdk from '@stackblitz/sdk';
import { Data, Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { Message } from './message';

class ProjectPreparationError extends Data.TaggedError('ProjectPreparationError')<{
  readonly message: string;
}> {}

export const OpenPlayground = Command.define('OpenPlayground', {
  args: { templateUrl: Schema.String },
  messages: [Message.SucceededPlayground, Message.FailedPlayground],
  execute: ({ templateUrl }) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(templateUrl);
        if (!response.ok) throw new ProjectPreparationError({ message: 'Project download failed' });
        const files = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.String))(
          await response.json(),
        );
        sdk.openProject(
          {
            title: 'Foldkit Viz — Dataset explorer',
            description:
              'Explore native FoldKit KeyedQuery, chart composition and cached datasets.',
            template: 'node',
            files,
          },
          { newWindow: false, openFile: 'src/query.ts' },
        );
      },
      catch: () => 'Could not open StackBlitz. Please try again or download the project.',
    }).pipe(
      Effect.map(() => Message.SucceededPlayground()),
      Effect.catch((error) => Effect.succeed(Message.FailedPlayground({ error }))),
    ),
});
