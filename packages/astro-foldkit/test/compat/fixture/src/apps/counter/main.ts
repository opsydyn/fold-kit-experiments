import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';

export const Model = Schema.Struct({ count: Schema.Number });
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({ ClickedIncrement: {} });
export type Message = typeof Message.Type;

export const init = (props: { start?: number }) => ({ model: { count: props.start ?? 0 } });

export const update = (model: Model, message: Message) =>
  Message.match(message, {
    ClickedIncrement: () => ({ model: { count: model.count + 1 } }),
  });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Counter',
  body: h.button(
    [h.Class('compat-counter'), h.OnClick(Message.ClickedIncrement())],
    [`Count: ${model.count}`],
  ),
});
