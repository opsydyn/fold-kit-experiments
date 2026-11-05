/**
 * Keeps the package skills in step with what this repository ships.
 *
 * Each skill under `skills/` names the versions it was qualified on, in its SKILL.md and in
 * the package.json of its standalone examples. They drifted once (FoldKit 0.167 and
 * Effect 4.0 two upgrades after the workspace moved on), so:
 *
 * - A third-party dependency an example pins must equal the root catalog's version (a
 *   catalog range such as `^6.0.3` counts as its base version). Upgrading FoldKit, Effect
 *   or Astro for the workspace upgrades the skills with it.
 * - A version a skill's text names as `name@x.y.z`, or as FoldKit, Effect or Astro
 *   followed by a version, must equal the one its examples install, or the catalog's.
 * - An `@opsydyn/*` pin behind the package's own version is a warning, not a failure:
 *   release PRs bump those versions, and a skill names what is published and qualified.
 *
 *   bun tools/check-skills.ts
 */
import { Glob } from 'bun';

type Manifest = {
  readonly name?: string;
  readonly version?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly workspaces?: {
    readonly catalog?: Readonly<Record<string, string>>;
    readonly catalogs?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  };
};

const read = async (path: string): Promise<Manifest> => Bun.file(path).json();

/** A catalog entry's version without its range operator: `^6.0.3` is 6.0.3. */
const base = (version: string): string => version.replace(/^[\^~]/, '');

const root = await read('package.json');
/** Each dependency's versions across the catalogs: the default's, and a named one's. */
const catalog = new Map<string, ReadonlyArray<string>>();
for (const entries of [
  root.workspaces?.catalog ?? {},
  ...Object.values(root.workspaces?.catalogs ?? {}),
]) {
  for (const [name, version] of Object.entries(entries)) {
    catalog.set(name, [...(catalog.get(name) ?? []), base(version)]);
  }
}

const ours = new Map<string, string>();
for await (const path of new Glob('packages/*/package.json').scan('.')) {
  const { name, version } = await read(path);
  if (name !== undefined && version !== undefined) ours.set(name, version);
}

const problems: Array<string> = [];
const warnings: Array<string> = [];

/** What the text calls these, mapped to their package names. */
const named = new Map([
  ['FoldKit', 'foldkit'],
  ['Effect', 'effect'],
  ['Astro', 'astro'],
]);

for await (const skillFile of new Glob('skills/*/SKILL.md').scan('.')) {
  const skill = skillFile.slice(0, -'/SKILL.md'.length);
  const installed = new Map<string, string>();

  for await (const path of new Glob(`${skill}/assets/**/package.json`).scan('.')) {
    if (path.includes('node_modules')) continue;
    const manifest = await read(path);
    const pins = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const [name, version] of Object.entries(pins)) {
      installed.set(name, version);
      const where = `${path} ${name}@${version}`;
      if (name.startsWith('@opsydyn/')) {
        const current = ours.get(name);
        if (current !== undefined && current !== version) {
          warnings.push(`${where}: the package is at ${current}; qualify the skill once published`);
        }
      } else {
        const versions = catalog.get(name) ?? [];
        if (versions.length > 0 && !versions.includes(version)) {
          problems.push(`${where}: the catalogs have ${versions.join(' or ')}`);
        }
      }
    }
  }

  const text = await Bun.file(skillFile).text();
  const mentions = [
    ...[...text.matchAll(/`((?:@[\w-]+\/)?[\w.-]+)@(\d+\.\d+\.\d+)`/g)].map(
      ([, name = '', version = '']) => ({ name, version }),
    ),
    ...[...text.matchAll(/\b(FoldKit|Effect|Astro)\s+`(\d+\.\d+\.\d+)`/g)].map(
      ([, label = '', version = '']) => ({
        name: named.get(label) ?? label,
        version,
      }),
    ),
  ];
  for (const { name, version } of mentions) {
    const expected = [...(installed.has(name) ? [installed.get(name)] : (catalog.get(name) ?? []))];
    if (expected.length > 0 && !expected.includes(version)) {
      problems.push(`${skillFile} names ${name} ${version}, not ${expected.join(' or ')}`);
    }
  }
}

warnings.forEach((warning) => console.warn(`warning: ${warning}`));
if (problems.length > 0) {
  problems.forEach((problem) => console.error(problem));
  process.exit(1);
}
console.log('skills: every pinned and named version matches the workspace');
