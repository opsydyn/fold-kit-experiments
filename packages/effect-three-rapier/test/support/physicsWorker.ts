// A worker serving Rapier's deterministic build, for the worker tests.
import { loadRapier } from '../../src/deterministic.ts';
import { servePhysics } from '../../src/worker.ts';

// In a worker, the global scope is the channel back to the page.
servePhysics(globalThis, loadRapier());
