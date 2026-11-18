import { fileURLToPath } from 'node:url';

import { STAGING_PROFILE } from './staging-config';

const action = process.argv[2];
if (action !== 'plan' && action !== 'deploy') throw new Error('Choose plan or deploy.');
const extra = process.argv.slice(3);
if (extra.length && !(action === 'deploy' && extra.length === 1 && extra[0] === '--yes'))
  throw new Error('Only deploy accepts --yes, after reviewing its exact staging plan.');
const cli = fileURLToPath(new URL('./cli.js', import.meta.resolve('alchemy/bin/alchemy.js')));
const child = Bun.spawn(
  [
    process.execPath,
    cli,
    action,
    '--config',
    'staging.alchemy.ts',
    '--stage',
    'staging',
    '--profile',
    STAGING_PROFILE,
    '--no-input',
    ...extra,
  ],
  {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      ALCHEMY_WORKERD_PATH: fileURLToPath(import.meta.resolve('workerd/bin/workerd')),
    },
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  },
);
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.exit(await child.exited);
