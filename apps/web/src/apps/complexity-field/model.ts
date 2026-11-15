import { randomLcg } from '@opsydyn/foldkit-viz/math/random';
import { Schema } from 'effect';

import type { AppInitProps } from '../types';

export const Subdomain = Schema.Literals(['core', 'supporting', 'generic']);
export type Subdomain = typeof Subdomain.Type;
export const Integration = Schema.Literals(['intrusive', 'contract', 'functional']);
export type Integration = typeof Integration.Type;
export type RiskTier = 'high' | 'medium' | 'low';

export const Module = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  subdomain: Subdomain,
  integration: Integration,
  modularity: Schema.Number,
  balance: Schema.Number,
  risk: Schema.Number,
});
export type Module = typeof Module.Type;

export const Model = Schema.Struct({
  modules: Schema.Array(Module),
  inspected: Schema.NullOr(Schema.String),
  selected: Schema.NullOr(Schema.String),
  /** Average risk at or above which the system reads as a big ball of mud. */
  threshold: Schema.Number,
});
export type Model = typeof Model.Type;

const services = [
  'apim',
  'billing',
  'catalog',
  'identity',
  'search',
  'orders',
  'payments',
  'ledger',
  'notify',
  'reports',
  'gateway',
  'profile',
  'inventory',
  'audit',
];
const roles = ['learn', 'sync', 'core'];
const subdomains: ReadonlyArray<Subdomain> = ['core', 'supporting', 'generic'];
const integrations: ReadonlyArray<Integration> = ['intrusive', 'contract', 'functional'];
const round = (value: number): number => Math.round(value * 10) / 10;

/** A synthetic system: balance follows Khononov's 1-10 scale, and risk is 11 - balance. */
const seedModules = (): ReadonlyArray<Module> => {
  const random = randomLcg(42);
  return services.flatMap((service, serviceIndex) =>
    roles.map((role, roleIndex) => {
      const index = serviceIndex * roles.length + roleIndex;
      const balance = round(1 + random() * 9);
      return {
        id: `m${index}`,
        label: `${service}-${role}`,
        subdomain: subdomains[Math.floor(random() * subdomains.length)] ?? 'generic',
        integration: integrations[Math.floor(random() * integrations.length)] ?? 'contract',
        modularity: round(2 + random() * 7),
        balance,
        risk: round(11 - balance),
      };
    }),
  );
};

export const riskTier = (risk: number): RiskTier =>
  risk >= 7 ? 'high' : risk >= 4 ? 'medium' : 'low';

const average = (values: ReadonlyArray<number>): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export const summarise = (modules: ReadonlyArray<Module>) => ({
  averageModularity: average(modules.map(({ modularity }) => modularity)),
  averageBalance: average(modules.map(({ balance }) => balance)),
  averageRisk: average(modules.map(({ risk }) => risk)),
  maxRisk: Math.max(0, ...modules.map(({ risk }) => risk)),
  highestRisk: modules.reduce<Module | undefined>(
    (highest, module) => (highest === undefined || module.risk > highest.risk ? module : highest),
    undefined,
  ),
  counts: {
    core: modules.filter(({ subdomain }) => subdomain === 'core').length,
    supporting: modules.filter(({ subdomain }) => subdomain === 'supporting').length,
    generic: modules.filter(({ subdomain }) => subdomain === 'generic').length,
  },
});

export const init = (_props: AppInitProps) => ({
  model: { modules: seedModules(), inspected: null, selected: null, threshold: 8 },
});
