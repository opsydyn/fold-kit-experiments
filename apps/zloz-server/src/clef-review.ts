import type { AIClient } from '@alchemy.run/cloudflare/Workers';
import {
  RelationshipDecisionContentSchema,
  type RelationshipDecision,
} from '@opsydyn/foldkit-zloz-alchemy/relationship-decision';
import { Data, Effect, Schema } from 'effect';

const modelId = '@cf/cloudflare/clef';
const question = {
  type: 'noul',
  instructions: 'Does the reviewer need more evidence to judge this proposal?',
} as const;
const encodeContent = Schema.encodeEffect(Schema.fromJsonString(RelationshipDecisionContentSchema));
const decodeResponse = Schema.decodeUnknownEffect(
  Schema.Struct({
    model: Schema.Literals(['clef', modelId]),
    answers: Schema.Struct({
      needsEvidence: Schema.Struct({
        type: Schema.Literal('noul'),
        noul: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
      }),
    }),
  }),
);
class ClefUnavailable extends Data.TaggedError('ClefUnavailable') {}

export function reviewWithClef(client: Pick<AIClient, 'raw'>, proposal: RelationshipDecision) {
  const review = Effect.gen(function* () {
    const state = yield* encodeContent(proposal.content);
    const ai = yield* client.raw;
    const response = yield* Effect.tryPromise(() =>
      ai.run(modelId, { model: 'clef', state, questions: { needsEvidence: question } }),
    );
    const decoded = yield* decodeResponse(response);
    return {
      proposalId: proposal.proposalId,
      revision: proposal.revision,
      contextFingerprint: proposal.contextFingerprint,
      needsEvidenceProbability: decoded.answers.needsEvidence.noul,
    };
  });
  return review.pipe(
    Effect.mapError(() => new ClefUnavailable()),
    Effect.timeoutOrElse({
      duration: '20 seconds',
      orElse: () => Effect.fail(new ClefUnavailable()),
    }),
  );
}
