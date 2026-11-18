import { expect, test } from 'bun:test';

import { STAGING_ORIGIN, validateStagingConfiguration } from '../tools/staging-config';

test('staging rejects other stages, production origin and missing provider credentials', () => {
  const valid = {
    stage: 'staging',
    origin: STAGING_ORIGIN,
    clientId: 'fixture-id',
    clientSecret: 'fixture-secret',
  };
  expect(() => validateStagingConfiguration(valid)).not.toThrow();
  for (const change of [
    { stage: 'prod' },
    { qualificationProbe: true },
    { origin: 'https://zloz.opsydyn.xyz' },
    { clientId: '' },
    { clientSecret: '' },
  ])
    expect(() => validateStagingConfiguration({ ...valid, ...change })).toThrow();
});
