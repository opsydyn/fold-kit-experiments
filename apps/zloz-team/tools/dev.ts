import { fileURLToPath } from 'node:url';

// beta.85's bundled workerd predates our compatibility date. Its supported
// override also reaches the sidecar and Astro child; keep the explicit pin.
const workerd = fileURLToPath(import.meta.resolve('workerd/bin/workerd'));
const cli = fileURLToPath(new URL('./cli.js', import.meta.resolve('alchemy/bin/alchemy.js')));
const child = Bun.spawn(
  [
    process.execPath,
    ...(process.env.ZLOZ_C11_CLI_PROFILE
      ? ['--cpu-prof', `--cpu-prof-dir=${process.env.ZLOZ_C11_CLI_PROFILE}`]
      : []),
    cli,
    'dev',
    '--stage',
    process.env.ZLOZ_LOCAL_STAGE ?? 'qualification',
    ...process.argv.slice(2),
  ],
  {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      ALCHEMY_WORKERD_PATH: workerd,
      // Keep all records without the per-record pretty timestamp formatter on
      // the local service-binding/telemetry host. Explicit operator choices win.
      ALCHEMY_LOG_FORMAT: process.env.ALCHEMY_LOG_FORMAT ?? 'json',
      // CLI usage exports are unrelated to the local app and add a remote,
      // one-second exporter loop to its service-binding host. Keep local logs
      // and Worker observability; an explicit empty value retains CLI opt-in.
      ALCHEMY_TELEMETRY_DISABLED: process.env.ALCHEMY_TELEMETRY_DISABLED ?? '1',
    },
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  },
);
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.exit(await child.exited);
