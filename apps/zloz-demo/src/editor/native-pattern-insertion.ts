import type { ZlozPlacementControlsContext } from '@opsydyn/foldkit-zloz';
import { placementPalette } from '@opsydyn/foldkit-zloz/effect-ui';
import type { ZlozDiagnostics } from '@opsydyn/foldkit-zloz/foldkit';
import { Schema } from 'effect';

import { historyAllowsMessage } from './history';
import { Message } from './message';
import { architectureNativePanel } from './native-panel';
import { settingCheckbox } from './native-settings';

type Pattern = Extract<Message, { _tag: 'ClickedInsertPattern' }>['pattern'];

const patterns = [
  ['c4-context', 'Insert C4 context pattern'],
  ['ddd-aggregate', 'Insert DDD aggregate pattern'],
  ['event-storming', 'Insert event-storming pattern'],
  ['context-map', 'Insert context-map starter'],
] as const satisfies readonly (readonly [Pattern, string])[];

type PatternInsertion = Readonly<{
  controls: ZlozPlacementControlsContext;
  diagnostics: Pick<ZlozDiagnostics, 'instructions' | 'measurements'>;
  protected: boolean;
  history: boolean;
  customPalette: boolean;
  reason: string | null;
}>;

const acceptsInput = Schema.is(
  Schema.Union([
    Message.cases.ClickedPatternInsertionProtection,
    Message.cases.ClickedCustomPalette,
    Message.cases.ClickedInsertPattern,
    Message.cases.ObservedPlacementInput,
  ]),
);

export const nativePatternInsertion = architectureNativePanel<PatternInsertion>(
  'ArchitecturePatternInsertion',
  acceptsInput,
  (h, model, request) => {
    const { controls, diagnostics, customPalette, reason } = model;
    const button = (label: string, message: Message, disabled = false) =>
      h.button
        .attr('type', 'button')
        .disabled(disabled || (model.history && !historyAllowsMessage(message)))
        .style({ padding: '10px 16px', cursor: 'pointer' })
        .on('click', request(message))
        .children(label);
    return h.div
      .attr('role', 'group')
      .attr('aria-label', 'Insert architecture patterns')
      .children(
        h.p.children(
          'Add a pattern beside your diagram. Existing content stays; each insertion is one Undo step.',
        ),
        h.label.children(
          settingCheckbox(h, model.protected, request(Message.ClickedPatternInsertionProtection())),
          'Protect pattern insertion',
        ),
        h.h3.children('Placement palette'),
        button(
          customPalette ? 'Use native palette' : 'Use custom palette',
          Message.ClickedCustomPalette(),
        ),
        placementPalette(
          h,
          controls,
          (input) => request(Message.ObservedPlacementInput({ input })),
          customPalette
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
        ...patterns.map(([pattern, label]) =>
          button(label, Message.ClickedInsertPattern({ pattern }), reason !== null).key(pattern),
        ),
        reason === null
          ? null
          : h.p
              .attr('role', 'status')
              .attr('aria-label', 'Pattern insertion protection reason')
              .children(reason),
      );
  },
);
