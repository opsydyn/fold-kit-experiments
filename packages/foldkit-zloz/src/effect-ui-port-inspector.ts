import type { Html } from '@effect/ui/html';

import type { ZlozPortControlContext } from './port-inspector';
import type {
  ZlozPortPositionDraftChange,
  ZlozPortPositionEditorContext,
  ZlozPortPositionInputContext,
} from './port-position-editor';

export function portControlReasonId(control: ZlozPortControlContext) {
  return control.reason === null ? undefined : control.reasonId;
}

export function portPositionInput<M>(
  h: Html.H<M>,
  { entry }: ZlozPortPositionEditorContext,
  { field, value }: ZlozPortPositionInputContext,
  onChange: (change: Extract<ZlozPortPositionDraftChange, { type: 'number' }>) => M,
) {
  const { node, port, positionControl } = entry;
  const label = field === 'offset' ? 'Offset' : `Anchor ${field.toUpperCase()}`;
  return h.input
    .attr('type', 'number')
    .attr('name', field)
    .attr('aria-label', `${label} for ${port.id} port on ${node.label}`)
    .attr('aria-describedby', portControlReasonId(positionControl))
    .attr('min', '0')
    .attr('max', '1')
    .attr('step', 'any')
    .attr('required', '')
    .value(value)
    .disabled(positionControl.reason !== null)
    .on('input', ({ value: text }) => onChange({ type: 'number', field, text }));
}
