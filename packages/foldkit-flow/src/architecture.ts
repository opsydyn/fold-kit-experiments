/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts here, not structural placeholder names. */
/** C4 meaning is independent of notation. Technology describes containers/components. */
export type C4NodeArchitecture = Readonly<
  {
    family: 'c4';
    description?: string;
    scope?: 'internal' | 'external';
  } & (
    | { role: 'person' | 'software-system' }
    | { role: 'container' | 'component'; technology?: string }
  )
>;

/** Diagram roles, not executable business invariants or a prescribed DDD notation. */
export type DddNodeArchitecture = Readonly<
  { family: 'ddd'; description?: string } & (
    | {
        role:
          | 'entity'
          | 'value-object'
          | 'aggregate-root'
          | 'aggregate'
          | 'domain-event'
          | 'domain-service'
          | 'repository';
      }
    | { role: 'bounded-context'; subdomain?: 'core' | 'supporting' | 'generic' }
  )
>;
export type FlowNodeArchitecture = C4NodeArchitecture | DddNodeArchitecture;
/** Qualified built-in outlines. Person artwork is an adornment inside a card. */
export type FlowNodeShape = 'rectangle' | 'rounded-rectangle' | 'cylinder';
/** Serializable outline choice; renderer functions and themes remain view configuration. */
export type FlowNodeAppearance = Readonly<{ shape: FlowNodeShape }>;
export type ArchitectureNodePreset = Readonly<{
  architecture: FlowNodeArchitecture;
  label: string;
  shape: FlowNodeShape;
  kind?: 'group';
}>;

const presets: readonly ArchitectureNodePreset[] = [
  { architecture: { family: 'c4', role: 'person' }, label: 'Person', shape: 'rounded-rectangle' },
  {
    architecture: { family: 'c4', role: 'software-system' },
    label: 'Software System',
    shape: 'rectangle',
  },
  { architecture: { family: 'c4', role: 'container' }, label: 'Container', shape: 'rectangle' },
  { architecture: { family: 'c4', role: 'component' }, label: 'Component', shape: 'rectangle' },
  { architecture: { family: 'ddd', role: 'entity' }, label: 'Entity', shape: 'rounded-rectangle' },
  {
    architecture: { family: 'ddd', role: 'value-object' },
    label: 'Value Object',
    shape: 'rounded-rectangle',
  },
  {
    architecture: { family: 'ddd', role: 'aggregate-root' },
    label: 'Aggregate Root',
    shape: 'rounded-rectangle',
  },
  {
    architecture: { family: 'ddd', role: 'aggregate' },
    label: 'Aggregate',
    shape: 'rectangle',
    kind: 'group',
  },
  {
    architecture: { family: 'ddd', role: 'domain-event' },
    label: 'Domain Event',
    shape: 'rounded-rectangle',
  },
  {
    architecture: { family: 'ddd', role: 'domain-service' },
    label: 'Domain Service',
    shape: 'rounded-rectangle',
  },
  {
    architecture: { family: 'ddd', role: 'repository' },
    label: 'Repository',
    shape: 'rounded-rectangle',
  },
  {
    architecture: { family: 'ddd', role: 'bounded-context' },
    label: 'Bounded Context',
    shape: 'rounded-rectangle',
  },
];
/** Headless catalogue; presets do not imply that a bundled renderer implements their artwork. */
export const architectureNodePresets: readonly ArchitectureNodePreset[] = Object.freeze(
  presets.map((preset) =>
    Object.freeze({ ...preset, architecture: Object.freeze(preset.architecture) }),
  ),
);

/** Untrusted descriptor fields are inspected individually before they enter the public union. */
type UnknownNodeDescriptor = Readonly<{
  family?: unknown;
  role?: unknown;
  description?: unknown;
  scope?: unknown;
  technology?: unknown;
  subdomain?: unknown;
  shape?: unknown;
}>;
function record(value: unknown): value is UnknownNodeDescriptor {
  return (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
function fields(value: UnknownNodeDescriptor, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
/** Strict validation of the reserved descriptor, without claiming the host's data namespace. */
export function isNodeArchitecture(value: unknown): value is FlowNodeArchitecture {
  if (!record(value)) return false;
  if ('description' in value && typeof value.description !== 'string') return false;
  if (value.family === 'c4') {
    if ('scope' in value && value.scope !== 'internal' && value.scope !== 'external') return false;
    const technical = value.role === 'container' || value.role === 'component';
    return (
      (technical || value.role === 'person' || value.role === 'software-system') &&
      fields(
        value,
        technical
          ? ['family', 'role', 'description', 'scope', 'technology']
          : ['family', 'role', 'description', 'scope'],
      ) &&
      (!('technology' in value) || typeof value.technology === 'string')
    );
  }
  if (value.family !== 'ddd') return false;
  const context = value.role === 'bounded-context';
  return (
    architectureNodePresets.some(
      ({ architecture }) => architecture.family === 'ddd' && architecture.role === value.role,
    ) &&
    fields(
      value,
      context ? ['family', 'role', 'description', 'subdomain'] : ['family', 'role', 'description'],
    ) &&
    (!('subdomain' in value) ||
      (typeof value.subdomain === 'string' &&
        ['core', 'supporting', 'generic'].includes(value.subdomain)))
  );
}
export function isNodeAppearance(value: unknown): value is FlowNodeAppearance {
  return (
    record(value) &&
    fields(value, ['shape']) &&
    (value.shape === 'rectangle' ||
      value.shape === 'rounded-rectangle' ||
      value.shape === 'cylinder')
  );
}

/** ADR 0005: group identity and portless boundary semantics remain independent of notation. */
export function validNodeArchitectureFields(value: object & { kind?: unknown }): boolean {
  if ('architecture' in value) {
    if (!isNodeArchitecture(value.architecture)) return false;
    const { family, role } = value.architecture;
    if (value.kind === 'group') {
      if (
        family === 'c4'
          ? role !== 'software-system' && role !== 'container'
          : role !== 'aggregate' && role !== 'bounded-context'
      )
        return false;
    } else if (family === 'ddd' && role === 'aggregate') return false;
  }
  return (
    !('appearance' in value) ||
    (isNodeAppearance(value.appearance) &&
      (value.kind !== 'group' || value.appearance.shape === 'rectangle'))
  );
}
