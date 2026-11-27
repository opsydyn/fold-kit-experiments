import type { ZlozCouplingIntegration } from '@opsydyn/foldkit-zloz/coupling';

import type { CouplingRow, RecordedCouplingRow } from '../coupling-projection';

export const labels = {
  'complementary-balance': 'Complementary balance',
  'low-volatility-balance': 'Low-volatility balance',
  imbalance: 'Imbalanced',
  unknown: 'Unknown inputs',
  stale: 'Stale graph pin',
  'invalid-binding': 'Invalid binding',
  'not-started': 'Not started',
} as const;
export const readinessKeys = [
  'complementary-balance',
  'low-volatility-balance',
  'imbalance',
  'unknown',
  'stale',
  'invalid-binding',
  'not-started',
] as const;
export const integrations = ['intrusive', 'functional', 'model', 'contract'] as const;
export const colours = {
  intrusive: 'var(--danger)',
  functional: 'var(--accent)',
  model: 'var(--c4)',
  contract: 'var(--ddd)',
};
export const assessed = (
  row: CouplingRow,
): row is Extract<
  RecordedCouplingRow,
  { state: 'complementary-balance' | 'low-volatility-balance' | 'imbalance' }
> & { readonly integrationType: ZlozCouplingIntegration } =>
  (row.state === 'complementary-balance' ||
    row.state === 'low-volatility-balance' ||
    row.state === 'imbalance') &&
  row.integrationType !== null;
export const outcomeLabel = (row: CouplingRow): string => {
  if (!assessed(row)) return labels[row.state];
  return `${labels[row.state]} · ${row.result.pattern.replaceAll('-', ' ')} · ${row.result.basis.replaceAll('-', ' ')}`;
};
