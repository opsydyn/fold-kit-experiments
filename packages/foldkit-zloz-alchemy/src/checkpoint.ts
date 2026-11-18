import { canonicalOperationValue, parseGraph } from '@opsydyn/foldkit-zloz';
import type { ZlozGraph } from '@opsydyn/foldkit-zloz';
import { Data, Schema } from 'effect';

import { sha256Text } from './digest';
import type { DiagramTarget } from './session';

const Version = Schema.Number.pipe(
  Schema.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
  ),
);
const Checkpoint = Schema.Struct({
  format: Schema.Literal('zloz.checkpoint'),
  version: Schema.Literal(1),
  target: Schema.Struct({ teamId: Schema.String, diagramId: Schema.String }),
  documentVersion: Version,
  graph: Schema.Unknown,
  digest: Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/))),
});
export type DiagramCheckpoint = Readonly<{
  format: 'zloz.checkpoint';
  version: 1;
  target: DiagramTarget;
  documentVersion: number;
  graph: ZlozGraph;
  digest: string;
}>;
export class InvalidCheckpoint extends Data.TaggedError('InvalidCheckpoint') {}
export async function createDiagramCheckpoint(
  target: DiagramTarget,
  documentVersion: number,
  graph: ZlozGraph,
): Promise<DiagramCheckpoint> {
  const content = {
    format: 'zloz.checkpoint' as const,
    version: 1 as const,
    target: { ...target },
    documentVersion,
    graph: parseGraph(JSON.stringify({ version: 1, graph })),
  };
  return { ...content, digest: await sha256Text(canonicalOperationValue(content)) };
}
export async function parseDiagramCheckpoint(text: string): Promise<DiagramCheckpoint> {
  if (new TextEncoder().encode(text).byteLength > 2_097_152) throw new InvalidCheckpoint();
  const decoded = Schema.decodeUnknownSync(Schema.fromJsonString(Checkpoint))(text);
  const graph = parseGraph(JSON.stringify({ version: 1, graph: decoded.graph }));
  const { digest, ...content } = { ...decoded, graph };
  if ((await sha256Text(canonicalOperationValue(content))) !== digest)
    throw new InvalidCheckpoint();
  return { ...content, digest };
}
