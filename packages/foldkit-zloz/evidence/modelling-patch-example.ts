import { captureModellingPatch, dryRunModellingPatch } from '../src/index';
import fixture from '../test/fixtures/modelling-patch-v1.json';

const patch = captureModellingPatch(fixture);
// Actual deterministic public-package results, with no file IO or model mutation in core.
console.log(
  JSON.stringify(
    {
      reviewable: dryRunModellingPatch(patch.source, patch),
      protected: dryRunModellingPatch(patch.source, patch, {
        canChange: () => 'Architecture owner review is required.',
      }),
      stale: dryRunModellingPatch({ ...patch.source, revision: patch.source.revision + 1 }, patch),
    },
    null,
    2,
  ),
);
