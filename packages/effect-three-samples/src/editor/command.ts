/** The editor's work outside the Model: writing a scene file, and reading one. */
import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { Message } from './message';

/** Offers `text` as a download named `name`, as a link the page clicks for the person. */
export const DownloadFile = Command.define('DownloadFile', {
  args: { name: Schema.String, text: Schema.String },
  messages: [Message.CompletedDownload],
  execute: ({ name, text }) =>
    Effect.sync(() => {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = Object.assign(document.createElement('a'), { href: url, download: name });
      link.click();
      URL.revokeObjectURL(url);
      return Message.CompletedDownload();
    }),
});

/** The text of a file the person chose. */
export const ReadText = Command.define('ReadText', {
  args: { file: Schema.instanceOf(File) },
  messages: [Message.ReadFile],
  execute: ({ file }) =>
    Effect.promise(() => file.text()).pipe(Effect.map((text) => Message.ReadFile({ text }))),
});
