import { Effect, Schema } from 'effect';

import seed from './advisory-seed.json';
import originalRuns from './explore-runs.json';
import { exploreSpecimens, type Specimen } from './specimens';

const Entry = Schema.Struct({
  id: Schema.String,
  file: Schema.String,
  fn: Schema.String,
  genre: Schema.String,
  description: Schema.optionalKey(Schema.String),
  line: Schema.Number,
  outcome: Schema.String,
});
const Run = Schema.Struct({
  workspace: Schema.optionalKey(Schema.String),
  selected: Schema.optionalKey(Schema.Number),
  budgetSkipped: Schema.optionalKey(Schema.Number),
  failed: Schema.optionalKey(Schema.Boolean),
  run: Schema.Number,
  attempt: Schema.Number,
  startedAt: Schema.String,
  commit: Schema.String,
  reportSha256: Schema.String,
  entries: Schema.Array(Entry),
});
const decodeRuns = Schema.decodeUnknownEffect(Schema.Array(Run));
type Run = typeof Run.Type;
interface Observation {
  label: string;
  outcome: string;
  url?: string;
}
interface RecordEntry extends Specimen {
  workspace: string;
  file: string;
  observations: Observation[];
}

const traits = new Map<string, Specimen['kind']>([
  ['FnValue', 'value'],
  ['EffectNever', 'never'],
  ['EffectDie', 'die'],
  ['EffectSucceed', 'succeed'],
]);

export function fieldGuide(imported: readonly Run[]) {
  const latestRuns = new Map<string, Run>();
  const records = new Map<string, RecordEntry>();
  for (const specimen of exploreSpecimens) {
    records.set(specimen.id, {
      ...specimen,
      workspace: 'apps/web',
      file: 'src/apps/explore/mount.ts',
      observations: originalRuns.map((run) => ({
        label: run.label,
        outcome: run.outcomes[specimen.id],
      })),
    });
  }
  const runs = new Map<string, Run>();
  const observations: readonly Run[] = [...seed, ...imported];
  for (const run of observations) {
    runs.set([run.workspace ?? 'apps/web', run.run, run.attempt].join('/'), run);
  }
  for (const run of [...runs.values()].sort(
    (a, b) => a.startedAt.localeCompare(b.startedAt) || a.run - b.run || a.attempt - b.attempt,
  )) {
    const workspace = run.workspace ?? 'apps/web';
    latestRuns.set(workspace, run);
    for (const entry of run.entries) {
      const key = workspace === 'apps/web' ? entry.id : workspace + '/' + entry.id;
      const kind = traits.get(entry.genre) ?? 'other';
      const suffix = entry.id.slice(0, 6);
      const specimen: RecordEntry = records.get(key) ?? {
        ...entry,
        workspace,
        kind,
        name: entry.fn + ' · ' + suffix,
        short: suffix,
        note: entry.description ?? 'Recorded in the ' + workspace + ' mutation advisory.',
        key:
          kind === 'value'
            ? 'One eye marks a value replacement.'
            : 'The silhouette reflects the mutation family.',
        observations: [],
      };
      specimen.observations.push({
        label:
          run.startedAt.slice(0, 10) + ' · ' + run.commit.slice(0, 7) + ' · attempt ' + run.attempt,
        outcome: entry.outcome,
        url:
          'https://github.com/opsydyn/fold-kit-experiments/actions/runs/' +
          run.run +
          '/attempts/' +
          run.attempt,
      });
      records.set(key, specimen);
    }
  }
  return { records, latestRuns };
}

export function loadGuide(fetchArchive: typeof fetch = fetch) {
  const response = Effect.tryPromise(() =>
    fetchArchive(
      'https://raw.githubusercontent.com/opsydyn/fold-kit-experiments/field-guide-data/archive.json',
      { signal: AbortSignal.timeout(3000) },
    ),
  );
  return response.pipe(
    Effect.filterOrFail(
      (result) => result.ok,
      (result) => result.status,
    ),
    Effect.flatMap((result) => Effect.tryPromise(() => result.json())),
    Effect.flatMap(decodeRuns),
    Effect.match({
      onSuccess: (runs) => ({ ...fieldGuide(runs), offline: false }),
      onFailure: () => ({ ...fieldGuide([]), offline: true }),
    }),
    Effect.runPromise,
  );
}
