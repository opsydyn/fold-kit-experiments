import type { Port } from './types';

/** Persisted by v2 documents and retained by their editor sessions; legacy initialization stays strict. */
export type ZlozConnectionMode = 'strict' | 'loose';
/** Port-kind compatibility only. This does not check IDs, duplicates, lifecycle or grant edit permission. */
export type ZlozConnectionPortPair = Readonly<{
  mode?: ZlozConnectionMode;
  sourceKind: Port['kind'] | undefined;
  targetKind: Port['kind'] | undefined;
}>;
export type ZlozConnectionPortPairDecision =
  | Readonly<{ type: 'compatible'; mode: ZlozConnectionMode }>
  | Readonly<{
      type: 'incompatible';
      code: 'unsupported-mode' | 'source-missing' | 'target-missing' | 'port-kinds';
      reason: string;
    }>;
export function resolveConnectionPortPair({
  mode = 'strict',
  sourceKind,
  targetKind,
}: ZlozConnectionPortPair): ZlozConnectionPortPairDecision {
  if (mode !== 'strict' && mode !== 'loose')
    return {
      type: 'incompatible',
      code: 'unsupported-mode',
      reason: 'Unsupported connection mode.',
    };
  if (sourceKind !== 'input' && sourceKind !== 'output')
    return {
      type: 'incompatible',
      code: 'source-missing',
      reason: 'Choose an existing source port.',
    };
  if (targetKind !== 'input' && targetKind !== 'output')
    return {
      type: 'incompatible',
      code: 'target-missing',
      reason: 'Choose an existing target port.',
    };
  if (mode === 'strict' && (sourceKind !== 'output' || targetKind !== 'input'))
    return {
      type: 'incompatible',
      code: 'port-kinds',
      reason: 'Strict connections require an output source and input target.',
    };
  return { type: 'compatible', mode };
}
