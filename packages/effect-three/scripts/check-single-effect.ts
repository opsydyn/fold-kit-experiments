// Two copies of `effect` break service tags and instanceof checks (PLAN D7).
const proc = Bun.spawnSync(['bun', 'pm', 'ls', '--all']);
const out = proc.stdout.toString();
const versions = new Set([...out.matchAll(/[\s─]effect@(\d[^\s]*)/g)].map((m) => m[1]));
if (versions.size !== 1) {
  console.error(
    `expected exactly one effect version, found: ${[...versions].join(', ') || 'none'}`,
  );
  process.exit(1);
}
console.log(`single effect version: ${[...versions].join('')}`);
