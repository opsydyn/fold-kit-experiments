import type { ZlozPlacementControlsContext } from '@opsydyn/foldkit-zloz';
import { placementPalette } from '@opsydyn/foldkit-zloz/effect-ui';
import type { ZlozDiagnostics } from '@opsydyn/foldkit-zloz/foldkit';
import { Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import { architectureNativePanel } from './native-panel';

type Palette = Readonly<{
  controls: ZlozPlacementControlsContext;
  diagnostics: Pick<ZlozDiagnostics, 'instructions' | 'measurements'>;
  custom: boolean;
}>;
const panel = architectureNativePanel<Palette>(
  'ArchitecturePalette',
  Schema.is(Message.cases.ObservedPlacementInput),
  (h, { controls, diagnostics, custom }, request) =>
    placementPalette(
      h,
      controls,
      (input) => request(Message.ObservedPlacementInput({ input })),
      custom
        ? {
            ...diagnostics,
            entryClass: 'workbench-custom-palette-entry',
            renderEntry: (entry, builder) =>
              builder.span.children(
                builder.strong(`◇ ${entry.label}`),
                builder.span('Compose a new system element'),
              ),
          }
        : diagnostics,
    ),
);

export function architecturePalettePanel(h: HtmlBuilder<Message>, palette: Palette) {
  return panel(h, palette, 'architecture-effect-ui', 'palette');
}
