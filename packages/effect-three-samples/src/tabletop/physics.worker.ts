// The tabletop's physics with `?physics=worker`: Rapier's deterministic build in a worker,
// for the page's `remotePhysics` (ADR-017).
import { loadRapier } from '@opsydyn/effect-three-rapier/deterministic';
import { servePhysics } from '@opsydyn/effect-three-rapier/worker';

servePhysics(globalThis, loadRapier());
