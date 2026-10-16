// Named oxlint.strict.ts (not oxlint.config.ts) so the root `oxlint .` does not
// auto-discover it as a nested config. The physics package shares the core package's
// strict policy (ADR-003).
export { default } from '../effect-three/oxlint.strict.ts';
