import { exportMermaid } from '@opsydyn/foldkit-zloz-mermaid';

import type { Model } from './model';

export function mermaidPreview(model: Pick<Model, 'editor' | 'mermaidLossConsentRevision'>) {
  return exportMermaid(model.editor.graph, {
    lossPolicy: model.mermaidLossConsentRevision === model.editor.revision ? 'report' : 'reject',
  });
}

export function mermaidExportSource(model: Pick<Model, 'editor' | 'modelIdentity' | 'modelEpoch'>) {
  return {
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
    revision: model.editor.revision,
  };
}
