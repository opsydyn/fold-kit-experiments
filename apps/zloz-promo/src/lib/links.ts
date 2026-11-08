export const repository = 'https://github.com/opsydyn/fold-kit-experiments';
export const api = 'https://opsydyn.github.io/fold-kit-experiments/flow/api/';
export const viz = 'https://opsydyn.github.io/fold-kit-experiments/viz/';
export const three = 'https://opsydyn.github.io/fold-kit-experiments/three/';

const target = new URL(import.meta.env.ZLOZ_WORKBENCH_URL ?? 'http://127.0.0.1:4323/');
if (!['http:', 'https:'].includes(target.protocol))
  throw new Error('ZLOZ_WORKBENCH_URL must use HTTP or HTTPS');
export const workbench = target.href;
export const localWorkbench = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
