import {
  AlchemyTextError,
  parseAlchemyJson,
  projectAlchemyDescriptor,
  type AlchemyProjection,
} from '@opsydyn/foldkit-zloz-alchemy';
export { alchemyTextLimits } from '@opsydyn/foldkit-zloz-alchemy';
/** Host text boundary; the private portable adapter continues to own descriptor validation. */
export function decodeAlchemyText(text: string): AlchemyProjection {
  // oxlint-disable-next-line linteffect/no-try-catch -- Bounded data-only JSON parsing translates scanner/syntax failures into visible findings.
  try {
    return projectAlchemyDescriptor(parseAlchemyJson(text));
  } catch (error) {
    return {
      type: 'blocked',
      source: null,
      findings: [
        {
          code: error instanceof AlchemyTextError ? error.textCode : 'invalid-json',
          sourceId: null,
          severity: 'unsupported',
          reason:
            error instanceof AlchemyTextError
              ? `${error.message}${error.path ? ` (${error.path})` : ''}`
              : 'Malformed descriptor JSON.',
        },
      ],
    };
  }
}
