import workspace from '../../../../package.json' with { type: 'json' };

// The Vite plugin accepts platform patches that can require a newer Effect.
const platformNode = workspace.workspaces.catalog['@effect/platform-node'];
export const standaloneEffectOverrides = {
  '@effect/platform-node': platformNode,
  '@effect/platform-node-shared': platformNode,
};
