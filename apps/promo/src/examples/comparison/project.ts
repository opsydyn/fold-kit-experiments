import { Match, Schema } from 'effect';
import { strToU8, zipSync } from 'fflate';

import type * as Comparison from '../../../../web/src/apps/comparison/main';
import { Linking } from '../../../../web/src/apps/comparison/model';
import { Settings } from '../../../../web/src/apps/comparison/settings';

// This is a maintained source path, not a domain status sentinel.
// oxlint-disable-next-line linteffect/no-string-sentinel-const
export const settingsPath = 'web/src/apps/comparison/initial-settings.ts';
type ProjectFiles = Readonly<Record<string, string>>;

export function captureSettings(model: Comparison.Model): Settings {
  const panels = model.panels.map((panel) =>
    Match.value(panel).pipe(
      Match.when({ _tag: 'Scatter' }, ({ id }) => ({ id, kind: 'scatter' as const })),
      Match.when({ _tag: 'Histogram' }, ({ id }) => ({ id, kind: 'histogram' as const })),
      Match.exhaustive,
    ),
  );
  const linkInspections = Linking.match(model.linking, {
    Independent: () => false,
    Linked: () => true,
  });
  return Schema.decodeUnknownSync(Settings)({
    panels,
    linkInspections,
    nextPanelId: model.nextPanelId,
  });
}

export function settingsSource(settings: Settings): string {
  const captured = Schema.decodeUnknownSync(Settings)(settings);
  // Serialisation boundary: only schema-validated settings enter generated TypeScript.
  return (
    "import type { Settings } from './settings';\n\nexport const initialSettings: Settings = " +
    // oxlint-disable-next-line linteffect/no-naked-object-state-update
    JSON.stringify(captured, null, 2) +
    ';\n'
  );
}

export function projectFiles(template: ProjectFiles, settings: Settings): ProjectFiles {
  // The public export contract is a source-path dictionary, not a closed record.
  // oxlint-disable-next-line anti-slop/no-known-value-widening
  return { ...template, ['src/' + settingsPath]: settingsSource(settings) };
}

export function projectZip(files: ProjectFiles): Uint8Array {
  // ZIP boundary converts the immutable source map into encoded file entries.
  return zipSync(
    // oxlint-disable-next-line linteffect/no-naked-object-state-update
    Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])),
  );
}
