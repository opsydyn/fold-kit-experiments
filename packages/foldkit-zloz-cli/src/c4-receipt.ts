import {
  captureEdition,
  compareEditionsV2,
  createEventStormingC4ConversionPlanV2,
  parseEventStormingC4ConversionV2,
  compareEditions,
  createEventStormingC4ConversionPlan,
  parseEventStormingC4Conversion,
} from '@opsydyn/foldkit-zloz';

import { cliProtocol, type CliC4ReceiptInspection, type CliResponse } from './protocol';

export function inspectC4Receipt(
  text: string,
): Extract<CliResponse, { operation: 'c4-receipt-inspect'; status: 'inspected' }> {
  const receipt = parseEventStormingC4Conversion(text);
  const plan = createEventStormingC4ConversionPlan(receipt.source, receipt.options);
  const comparison = compareEditions(
    captureEdition({
      id: 'receipt-before',
      name: 'Before conversion',
      snapshot: receipt.source.document.snapshot,
    }),
    captureEdition({
      id: 'receipt-after',
      name: 'After conversion',
      snapshot: receipt.document.snapshot,
    }),
  );
  const data: CliC4ReceiptInspection = {
    format: receipt.format,
    version: receipt.version,
    authority: 'read-only-evidence',
    provenance: receipt.source,
    target: receipt.document,
    choices: receipt.options,
    changes: { nodes: comparison.nodes, edges: comparison.edges },
    losses: plan.disclosures,
    lossesAccepted: receipt.lossesAccepted,
  };
  return {
    protocol: cliProtocol,
    operation: 'c4-receipt-inspect',
    status: 'inspected',
    scope: 'recorded-conversion',
    data,
    diagnostics: data.losses.map((loss) => ({
      code: loss.code,
      subject: loss.id,
      message: loss.reason,
      severity: 'loss',
      dimension: 'semantics',
    })),
  };
}

export function inspectC4ReceiptV2(
  text: string,
): Extract<CliResponse, { operation: 'c4-receipt-inspect'; status: 'inspected' }> {
  const receipt = parseEventStormingC4ConversionV2(text);
  const plan = createEventStormingC4ConversionPlanV2(receipt.source, receipt.options);
  const comparison = compareEditionsV2(
    { id: 'receipt-before', name: 'Before conversion', snapshot: receipt.source.document.snapshot },
    { id: 'receipt-after', name: 'After conversion', snapshot: receipt.document.snapshot },
  );
  const losses = plan.disclosures;
  return {
    protocol: cliProtocol,
    operation: 'c4-receipt-inspect',
    status: 'inspected',
    scope: 'recorded-conversion',
    data: {
      format: receipt.format,
      version: 2,
      authority: 'read-only-evidence',
      provenance: receipt.source,
      target: receipt.document,
      choices: receipt.options,
      changes: {
        nodes: comparison.nodes,
        edges: comparison.edges,
        modeChange: comparison.modeChange,
      },
      losses,
      lossesAccepted: true,
    },
    diagnostics: losses.map((loss) => ({
      code: loss.code,
      subject: loss.id,
      message: loss.reason,
      severity: 'loss',
      dimension: 'semantics',
    })),
  };
}
