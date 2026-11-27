import type { Html } from '@effect/ui/html';

export const paintDefinitions = <Message>(h: Html.H<Message>, index: number, colour: string) => [
  h
    .el('pattern')
    .attrs({ id: `bars-dots-${index}`, patternUnits: 'userSpaceOnUse', width: '7', height: '7' })
    .children(h.el('circle').attrs({ cx: '3.5', cy: '3.5', r: '1.6', fill: colour }).children()),
  h
    .el('pattern')
    .attrs({
      id: `bars-hatch-${index}`,
      patternUnits: 'userSpaceOnUse',
      patternTransform: 'rotate(45)',
      width: '6',
      height: '6',
    })
    .children(
      h
        .el('line')
        .attrs({ x1: '0', x2: '0', y1: '0', y2: '6', stroke: colour, 'stroke-width': '2' })
        .children(),
    ),
  h
    .el('linearGradient')
    .attrs({ id: `bars-gradient-${index}`, x1: '0%', x2: '100%', y1: '0%', y2: '0%' })
    .children(
      h.el('stop').attrs({ offset: '0', 'stop-color': colour, 'stop-opacity': '0.35' }).children(),
      h.el('stop').attrs({ offset: '1', 'stop-color': colour, 'stop-opacity': '1' }).children(),
    ),
];
