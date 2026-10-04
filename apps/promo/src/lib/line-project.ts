import { buildExampleTemplate } from './example-project';
import type { SourceFile } from './example-project';

export const buildLineTemplate = (sources: ReadonlyArray<SourceFile>) =>
  buildExampleTemplate(sources, 'line');
