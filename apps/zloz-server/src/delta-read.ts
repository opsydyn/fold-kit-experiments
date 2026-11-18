import { Option, Schema } from 'effect';

const Identifier = Schema.String.pipe(Schema.check(Schema.isPattern(/^[A-Za-z0-9_-]{1,128}$/)));
const Key = Schema.Tuple([Identifier, Identifier]);
const Read = Schema.Struct({
  id: Schema.String,
  tag: Schema.Literal('ZlozDiagramDeltaV1.events'),
  payload: Schema.Struct({
    key: Schema.String,
    after: Schema.Number.pipe(
      Schema.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(0),
        Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
      ),
    ),
  }),
});
const Tag = Schema.Struct({ tag: Schema.String });
/** New projection reads are deliberately narrower than the SDK API. No filters or other methods. */
export function deltaRead(url: URL) {
  const text = url.searchParams.get('read');
  if (!text) return { kind: 'legacy' as const };
  const tag = Schema.decodeUnknownOption(Schema.fromJsonString(Tag))(text);
  if (Option.isNone(tag)) return { kind: 'invalid' as const };
  if (!tag.value.tag.startsWith('ZlozDiagramDeltaV1')) return { kind: 'legacy' as const };
  const read = Schema.decodeUnknownOption(Schema.fromJsonString(Read), {
    onExcessProperty: 'error',
  })(text);
  if (Option.isNone(read)) return { kind: 'invalid' as const };
  const key = Schema.decodeUnknownOption(Schema.fromJsonString(Key))(read.value.payload.key);
  if (Option.isNone(key)) return { kind: 'invalid' as const };
  const [teamId, diagramId] = key.value;
  return { kind: 'delta' as const, target: { teamId, diagramId } };
}
