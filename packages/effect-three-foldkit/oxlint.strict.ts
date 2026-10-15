// Named oxlint.strict.ts (not oxlint.config.ts) so the root `oxlint .` does not
// auto-discover it as a nested config. The adapter shares the core package's strict policy (ADR-003). Both packages install
// @opsydyn/oxlint-effect@2.0.1 locally because the workspace root still uses 0.4.0.
export { default } from '../effect-three/oxlint.strict.ts';
