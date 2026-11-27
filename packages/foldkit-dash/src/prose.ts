import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Schema } from 'effect';

export interface ProseElement {
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly ProseNode[];
}

export type ProseNode = string | ProseElement;

export const Prose: Schema.Codec<ProseNode, ProseNode> = Schema.Union([
  Schema.String,
  Schema.Struct({
    tag: Schema.String,
    attributes: Schema.Record(Schema.String, Schema.String),
    children: Schema.Array(Schema.suspend(() => Prose)),
  }),
]);

const isText = Schema.is(Schema.String);

export function renderProse<M>(h: Html.H<M>, node: ProseNode): View.Content<M> | string {
  if (isText(node)) return node;
  return h
    .el(node.tag)
    .attrs(node.attributes)
    .children(node.children.map((child) => renderProse(h, child)));
}
