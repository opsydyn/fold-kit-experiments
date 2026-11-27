import type { ZlozEdge, Point } from './types';

/** Presentation of a visible label at the anchor resolved by the edge geometry policy. */
export type ZlozEdgeLabelContext = Readonly<{
  edge: ZlozEdge;
  labelPosition: Point;
  description: string;
  selected: boolean;
  readOnly: boolean;
  selectionDisabledReason?: string | undefined;
}>;

/** The current Model-owned draft for an editable label. */
export type ZlozEdgeLabelEditorContext = ZlozEdgeLabelContext & Readonly<{ draft: string }>;
