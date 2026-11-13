import { ZlozError } from '@opsydyn/foldkit-zloz';
import { projectAlchemyDescriptor, type AlchemyProjection } from '@opsydyn/foldkit-zloz-alchemy';
export const alchemyTextLimits = { maxBytes: 1_048_576, maxDepth: 16, maxValues: 16_384 } as const;
class AlchemyTextError extends ZlozError {
  constructor(
    readonly textCode: string,
    reason: string,
    readonly path: string,
  ) {
    super('invalid-edit', reason);
  }
}
const digit = (char: string | undefined) => char !== undefined && char >= '0' && char <= '9';
const pointer = (path: string, key: string) =>
  path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1');
/** Bounded grammar/duplicate preflight. Native JSON.parse constructs the value only afterward. */
function preflight(text: string, maxDepth: number, maxValues: number): void {
  let i = 0,
    values = 0;
  let nonfinite: string | null = null;
  const fail = (path: string, message = 'Malformed Alchemy descriptor JSON.'): never => {
    throw new AlchemyTextError('invalid-json', message, path);
  };
  const skip = () => {
    while (text[i] === ' ' || text[i] === '\t' || text[i] === '\r' || text[i] === '\n') i++;
  };
  const string = (path: string): string => {
    const start = i++;
    while (i < text.length) {
      const char = text[i++];
      if (char === '"') return text.slice(start, i);
      if (char === '\\') {
        const escaped = text[i++];
        if (escaped === 'u') {
          for (let n = 0; n < 4; n++) {
            const hex = text[i++];
            if (hex === undefined || !/[0-9a-fA-F]/u.test(hex))
              fail(path, 'Invalid JSON Unicode escape.');
          }
        } else if (
          escaped === undefined ||
          !['"', '\\', '/', 'b', 'f', 'n', 'r', 't'].includes(escaped)
        )
          fail(path, 'Invalid JSON escape.');
      } else if (char !== undefined && char.charCodeAt(0) < 32)
        fail(path, 'Unescaped control character in JSON string.');
    }
    return fail(path, 'Unterminated JSON string.');
  };
  const value = (depth: number, path: string): void => {
    if (depth > maxDepth)
      throw new AlchemyTextError(
        'limit-exceeded',
        'Alchemy descriptor exceeds its JSON value-depth budget.',
        path,
      );
    if (++values > maxValues)
      throw new AlchemyTextError(
        'limit-exceeded',
        'Alchemy descriptor exceeds its JSON value budget.',
        path,
      );
    skip();
    const char = text[i];
    if (char === '{') {
      i++;
      skip();
      const keys = new Set<string>();
      if (text[i] === '}') {
        i++;
        return;
      }
      while (i < text.length) {
        if (text[i] !== '"') fail(path, 'Expected a JSON property name.');
        const key: string = JSON.parse(string(path)),
          child = pointer(path, key);
        if (keys.has(key)) fail(child, 'Duplicate decoded JSON property names are not allowed.');
        keys.add(key);
        skip();
        if (text[i++] !== ':') fail(child, 'Expected a colon after JSON property name.');
        value(depth + 1, child);
        skip();
        const end = text[i++];
        if (end === '}') return;
        if (end !== ',') fail(path, 'Expected comma or closing object.');
        skip();
      }
      return fail(path, 'Unterminated JSON object.');
    }
    if (char === '[') {
      i++;
      skip();
      if (text[i] === ']') {
        i++;
        return;
      }
      let index = 0;
      while (i < text.length) {
        value(depth + 1, pointer(path, String(index++)));
        skip();
        const end = text[i++];
        if (end === ']') return;
        if (end !== ',') fail(path, 'Expected comma or closing array.');
        skip();
      }
      return fail(path, 'Unterminated JSON array.');
    }
    if (char === '"') {
      string(path);
      return;
    }
    for (const literal of ['true', 'false', 'null'])
      if (text.startsWith(literal, i)) {
        i += literal.length;
        return;
      }
    const start = i;
    if (text[i] === '-') i++;
    if (text[i] === '0') i++;
    else {
      if (!digit(text[i])) return fail(path, 'Expected a JSON value.');
      while (digit(text[i])) i++;
    }
    if (text[i] === '.') {
      i++;
      if (!digit(text[i])) fail(path, 'JSON fraction requires digits.');
      while (digit(text[i])) i++;
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (!digit(text[i])) fail(path, 'JSON exponent requires digits.');
      while (digit(text[i])) i++;
    }
    if (!Number.isFinite(Number(text.slice(start, i)))) nonfinite ??= path;
  };
  value(0, '');
  skip();
  if (i !== text.length) fail('', 'Expected exactly one JSON document.');
  if (nonfinite !== null)
    throw new AlchemyTextError(
      'invalid-json',
      'Alchemy descriptor numbers must be finite.',
      nonfinite,
    );
}

/** Host text boundary; the private portable adapter continues to own descriptor validation. */
export function decodeAlchemyText(text: string): AlchemyProjection {
  // oxlint-disable-next-line linteffect/no-try-catch -- Bounded data-only JSON parsing translates scanner/syntax failures into visible findings.
  try {
    if (
      text.length > alchemyTextLimits.maxBytes ||
      new TextEncoder().encode(text).byteLength > alchemyTextLimits.maxBytes
    )
      throw new AlchemyTextError('limit-exceeded', 'Descriptor exceeds 1 MiB of UTF-8 text.', '');
    preflight(text, alchemyTextLimits.maxDepth, alchemyTextLimits.maxValues);
    return projectAlchemyDescriptor(JSON.parse(text));
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
