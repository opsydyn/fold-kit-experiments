import { describe, expect, it } from 'vitest';

import { Message } from './message';
import { init, riskTier, summarise } from './model';
import { update } from './update';

const { model } = init({});

describe('complexity field update', () => {
  it('inspects a module on hover or focus and clears it on leave', () => {
    const inspected = update(model, Message.InspectedModule({ key: 'm3' })).model;
    expect(inspected.inspected).toBe('m3');
    expect(update(inspected, Message.InspectedModule({ key: null })).model.inspected).toBeNull();
  });

  it('selects a module, and selecting it again clears the selection', () => {
    const selected = update(model, Message.SelectedModule({ key: 'm5' })).model;
    expect(selected.selected).toBe('m5');
    expect(update(selected, Message.SelectedModule({ key: 'm5' })).model.selected).toBeNull();
  });
});

describe('complexity field model', () => {
  it('seeds a deterministic system of 42 modules', () => {
    expect(model.modules).toHaveLength(42);
    expect(init({}).model.modules).toEqual(model.modules);
    expect(new Set(model.modules.map(({ id }) => id)).size).toBe(42);
  });

  it('derives risk from balance and tiers it', () => {
    for (const module of model.modules) expect(module.risk).toBeCloseTo(11 - module.balance);
    expect([riskTier(8), riskTier(5), riskTier(2)]).toEqual(['high', 'medium', 'low']);
  });

  it('summarises averages and the highest-risk module', () => {
    const summary = summarise(model.modules);
    const highest = Math.max(...model.modules.map(({ risk }) => risk));
    expect(summary.highestRisk?.risk).toBe(highest);
    expect(summary.averageRisk + summary.averageBalance).toBeCloseTo(11);
    expect(summary.counts.core + summary.counts.supporting + summary.counts.generic).toBe(42);
  });
});
