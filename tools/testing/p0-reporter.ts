import type { Reporter } from 'vitest/node';

// Vitest treats a tag filter that skips every test as a successful run.
export default class P0Reporter implements Reporter {
  onTestRunEnd: NonNullable<Reporter['onTestRunEnd']> = (modules, _errors, reason) => {
    if (reason !== 'passed') return;
    const passed = modules.some((module) =>
      Array.from(module.children.allTests('passed')).some((test) => test.tags.includes('p0')),
    );
    if (!passed) {
      console.error('No P0 test ran. Tag at least one runnable test with p0.');
      process.exitCode = 1;
    }
  };
}
