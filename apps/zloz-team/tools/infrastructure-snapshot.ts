import {
  readInfrastructureSnapshot,
  type InfrastructureSnapshot,
} from '@opsydyn/foldkit-zloz-alchemy';
import type { StackPlan } from 'alchemy/Alchemist';
import * as Output from 'alchemy/Output';
import * as Stack from 'alchemy/Stack';
import { Context, Predicate } from 'effect';

type PlanResource = StackPlan['native']['resources'][string]['resource'];
const configuredEnvironment = (resource: PlanResource) => {
  const props = resource.Props;
  return Predicate.isObject(props) && Predicate.isObject(props.env)
    ? Object.entries(props.env)
    : [];
};

const valueBindingTypes = new Set(['plain_text', 'secret_text', 'json']);
const isValueBinding = (binding: StackPlan['native']['resources'][string]['bindings'][number]) => {
  const rows = Predicate.isObject(binding.data) ? binding.data.bindings : undefined;
  return (
    Array.isArray(rows) &&
    rows.length > 0 &&
    rows.every(
      (row) =>
        Predicate.isObject(row) && Predicate.isString(row.type) && valueBindingTypes.has(row.type),
    )
  );
};

/** Export only public logical names and relationships from a trusted in-process plan. */
export function infrastructureSnapshot(plan: StackPlan, revision: string) {
  const stack = Context.get(plan.context, Stack.Stack);
  const resources = plan.resources.map((row) => ({
    id: row.fqn,
    type: row.resourceType,
    action: row.action,
  }));
  const ids = new Set(resources.map(({ id }) => id));
  const links: InfrastructureSnapshot['links'][number][] = [];
  const omissions: InfrastructureSnapshot['omissions'][number][] = [];
  for (const { id } of resources) {
    const row = plan.native.resources[id];
    if (!row) continue;
    const namedTargets = new Set<string>();
    const valueBindings = new Set(row.bindings.filter(isValueBinding).map(({ sid }) => sid));
    const bindings = new Map<string, typeof row.resource.Props>();
    for (const { sid, data } of stack.bindings[id] ?? [])
      if (!valueBindings.has(sid)) bindings.set(sid, data);
    for (const [name, value] of configuredEnvironment(row.resource)) {
      if (Object.keys(Output.upstreamAny(value)).length) bindings.set(name, value);
    }
    for (const [name, value] of bindings) {
      const [target, ...others] = Object.keys(Output.upstreamAny(value));
      if (target && !others.length && ids.has(target) && target !== id) {
        namedTargets.add(target);
        links.push({ from: id, to: target, kind: 'binding', name });
      } else omissions.push({ resource: id, kind: 'binding', name });
    }
    for (const target of Object.keys(Output.upstreamAny(row.resource.Props))) {
      if (namedTargets.has(target)) continue;
      if (ids.has(target) && target !== id)
        links.push({ from: id, to: target, kind: 'dependency' });
      else omissions.push({ resource: id, kind: 'dependency', name: target });
    }
  }
  const descriptor: InfrastructureSnapshot = {
    format: 'foldkit-zloz-alchemy-infrastructure',
    version: 1,
    source: {
      packageVersion: '2.0.0-beta.85',
      stack: plan.stack.name,
      stage: plan.stack.stage,
      revision,
    },
    resources,
    links,
    omissions,
  };
  const json = JSON.stringify(descriptor, null, 2);
  const review = readInfrastructureSnapshot(json);
  if (review.status === 'blocked') return review;
  return { status: 'exportable' as const, json };
}
