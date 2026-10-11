import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { Return } from 'foldkit/update';
import { Flags } from './flags';

export const Model = Schema.Struct({ title: Schema.String, count: Schema.Number });
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({ ClickedIncrement: {} });
export type Message = typeof Message.Type;

export const init = (flags: Flags): Return<Model, Message> => ({
  model: { ...Schema.decodeUnknownSync(Flags)(flags), count: 0 },
});

export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    ClickedIncrement: () => ({ model: { ...model, count: model.count + 1 } }),
  });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: model.title,
  lang: 'en',
  dir: 'Ltr',
  body: h.main(
    [],
    [
      h.h1([], [model.title]),
      h.p([], [`Count: ${model.count}`]),
      h.button([h.OnClick(Message.ClickedIncrement())], ['Increment']),
    ],
  ),
});
