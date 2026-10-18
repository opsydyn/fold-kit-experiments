/** A note under a sample's stage, when its renderer is not the one the page asked for. */
import type { Html, HtmlBuilder } from 'foldkit/html';

export const rendererNote = <Message>(
  h: HtmlBuilder<Message>,
  notice: string | null,
): ReadonlyArray<Html> => (notice === null ? [] : [h.p([h.Class('e3-note')], [notice])]);
