import { strToU8, zipSync } from 'fflate';

import type { Settings } from './chart';
import { settingsSource } from './chart';

export function projectFiles(template: Readonly<Record<string, string>>, settings: Settings) {
  return { ...template, 'src/settings.ts': settingsSource(settings) };
}

export function projectZip(files: Readonly<Record<string, string>>): Uint8Array {
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([name, source]) => [name, strToU8(source)])),
  );
}
