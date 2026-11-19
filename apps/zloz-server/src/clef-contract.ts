import { Schema } from 'effect';

export const ClefReference = Schema.Struct({
  proposalId: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{1,128}$/)),
  revision: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
  ),
  contextFingerprint: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
});
export type ClefReference = typeof ClefReference.Type;
export const ClefAdvice = Schema.Struct({
  ...ClefReference.fields,
  needsEvidenceProbability: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
});
export type ClefAdvice = typeof ClefAdvice.Type;

export const sameClefReference = (left: ClefReference, right: ClefReference) =>
  left.proposalId === right.proposalId &&
  left.revision === right.revision &&
  left.contextFingerprint === right.contextFingerprint;
