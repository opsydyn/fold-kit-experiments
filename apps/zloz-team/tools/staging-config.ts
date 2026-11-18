import { Data } from 'effect';

export const STAGING_HOST = 'teams-staging.opsydyn.xyz';
export const STAGING_ORIGIN = `https://${STAGING_HOST}`;
export const STAGING_STACK = 'zloz-team-staging';
export const STAGING_PROFILE = 'tech-radar';
export class InvalidStagingConfiguration extends Data.TaggedError('InvalidStagingConfiguration')<{
  readonly message: string;
}> {}

export function validateStagingConfiguration(config: {
  readonly stage: string;
  readonly origin: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly qualificationProbe?: boolean;
}) {
  if (config.stage !== 'staging' || config.origin !== STAGING_ORIGIN)
    throw new InvalidStagingConfiguration({ message: `Use stage staging and ${STAGING_ORIGIN}.` });
  if (config.qualificationProbe)
    throw new InvalidStagingConfiguration({
      message: 'The qualification probe is test-only and must be disabled in staging.',
    });
  if (!config.clientId.trim() || !config.clientSecret.trim())
    throw new InvalidStagingConfiguration({
      message: 'Configure both staging Google credentials in the ignored app .env.',
    });
}
