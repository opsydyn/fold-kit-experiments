import {
  createEventStormingDddConversionPlan,
  createEventStormingDddConversionPlanV2,
  dryRunModellingPatchV2,
  ZlozError,
  type ZlozModellingPatchChange,
  type ZlozModellingPatchLoss,
  type ZlozEventStormingDddConversionChanges,
  type ZlozEventStormingDddDisclosure,
  parseEventStormingDddConversion,
  parseEventStormingDddConversionV2,
  parseModellingPatchReceiptV2,
  type ZlozEventStormingDddConversion,
  type ZlozEventStormingDddConversionV2,
  type ZlozModellingPatchReceiptV2,
} from '@opsydyn/foldkit-zloz';
import { Effect, Match, Result, Schema } from 'effect';

import { readReceiptInput, writeResponse } from './io';
import { cliProtocol, CliInputError, CliReceiptIncompatible, type CliDiagnostic } from './protocol';
export type CliNativeReceiptReview =
  | Readonly<{
      kind: 'patch';
      changes: readonly ZlozModellingPatchChange[];
      losses: readonly ZlozModellingPatchLoss[];
    }>
  | Readonly<{
      kind: 'ddd';
      changes: ZlozEventStormingDddConversionChanges;
      losses: readonly ZlozEventStormingDddDisclosure[];
    }>;
function receiptReview(
  receipt:
    | ZlozEventStormingDddConversion
    | ZlozEventStormingDddConversionV2
    | ZlozModellingPatchReceiptV2,
): CliNativeReceiptReview {
  if (receipt.format === 'foldkit-zloz-patch-receipt') {
    const preview = dryRunModellingPatchV2(receipt.patch.source, receipt.patch);
    if (preview.type !== 'reviewable')
      throw new ZlozError('invalid-edit', 'Receipt patch cannot reproduce a reviewable proposal.');
    return { kind: 'patch', changes: preview.changes, losses: preview.losses };
  }
  const plan =
    receipt.version === 2
      ? createEventStormingDddConversionPlanV2(receipt.source, receipt.mappings)
      : createEventStormingDddConversionPlan(receipt.source, receipt.mappings);
  if (plan.type !== 'reviewable')
    throw new ZlozError('invalid-edit', 'Receipt conversion cannot reproduce a reviewable plan.');
  return { kind: 'ddd', changes: plan.changes, losses: plan.preview.disclosures };
}
export type CliNativeReceiptInspection = Readonly<{
  protocol: typeof cliProtocol;
  operation: 'ddd-receipt-inspect' | 'patch-receipt-inspect';
  status: 'inspected';
  scope: 'recorded-evidence';
  data: Readonly<{
    authority: 'read-only-evidence';
    review: CliNativeReceiptReview;
    receipt:
      | ZlozEventStormingDddConversion
      | ZlozEventStormingDddConversionV2
      | ZlozModellingPatchReceiptV2;
  }>;
  diagnostics: readonly CliDiagnostic[];
}>;
const marker = Schema.Struct({ format: Schema.String, version: Schema.Number });
function decodeNativeReceipt(
  operation: 'ddd-receipt-inspect' | 'patch-receipt-inspect',
  v2: boolean,
  text: string,
) {
  return Match.value({ operation, v2 }).pipe(
    Match.when({ operation: 'patch-receipt-inspect' }, () => parseModellingPatchReceiptV2(text)),
    Match.when({ v2: true }, () => parseEventStormingDddConversionV2(text)),
    Match.orElse(() => parseEventStormingDddConversion(text)),
  );
}
export function inspectNativeReceipt(
  operation: 'ddd-receipt-inspect' | 'patch-receipt-inspect',
  input: string,
) {
  const reading = Effect.gen(function* () {
    const { text, value } = yield* readReceiptInput(input);
    const matching = Match.value(operation).pipe(
      Match.when('ddd-receipt-inspect', () =>
        Schema.Struct({
          format: Schema.Literal('foldkit-zloz-ddd-conversion'),
          version: Schema.Literals([1, 2]),
        }),
      ),
      Match.orElse(() =>
        Schema.Struct({
          format: Schema.Literal('foldkit-zloz-patch-receipt'),
          version: Schema.Literal(2),
        }),
      ),
    );
    const versionCheck = Match.value(Schema.is(marker)(value) && !Schema.is(matching)(value)).pipe(
      Match.when(true, () => Result.fail(new CliReceiptIncompatible({ subject: input }))),
      Match.orElse(() => Result.succeed(null)),
    );
    yield* Effect.fromResult(versionCheck);
    const v2 = Schema.is(Schema.Struct({ version: Schema.Literal(2) }))(value);
    const decoding = Effect.try({
      try: () => decodeNativeReceipt(operation, v2, text),
      catch: () =>
        new CliInputError({
          code: 'invalid-receipt',
          dimension: 'semantics',
          subject: input,
          message:
            'Receipt source, choices, recorded acceptance and complete target are inconsistent with the declared version.',
        }),
    });
    const receipt = yield* decoding;
    const response: CliNativeReceiptInspection = {
      protocol: cliProtocol,
      operation,
      status: 'inspected',
      scope: 'recorded-evidence',
      data: { authority: 'read-only-evidence', receipt, review: receiptReview(receipt) },
      diagnostics: [],
    };
    yield* writeResponse(response);
  });
  return reading.pipe(
    Effect.catchTag(['CliInputError', 'CliReceiptIncompatible'], (error) =>
      Effect.gen(function* () {
        yield* writeResponse({
          protocol: cliProtocol,
          operation,
          status: 'rejected',
          diagnostics: [
            {
              code: error.code,
              message: error.message,
              dimension: error.dimension,
              subject: error.subject,
              severity: 'error',
            },
          ],
        });
        return yield* Effect.fail(error);
      }),
    ),
  );
}
