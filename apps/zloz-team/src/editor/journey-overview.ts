import { layoutStateFlow, type StateFlowEdge } from '@opsydyn/foldkit-viz/stateflow';
import type { ZlozNode } from '@opsydyn/foldkit-zloz';
import type { HtmlBuilder } from 'foldkit/html';

type Link = Readonly<{ id: string; label: string; target: ZlozNode }>;
type Outgoing = (node: ZlozNode) => readonly Link[];

// Walk outward once per note. Keep the inspector legible on large boards.
function neighbourhood(root: ZlozNode, outgoing: Outgoing) {
  const notes = new Map([[root.id, root]]);
  const links: StateFlowEdge[] = [];
  let partial = false;
  for (const source of notes.values()) {
    for (const link of outgoing(source)) {
      if (!notes.has(link.target.id) && notes.size >= 8) {
        partial = true;
        continue;
      }
      notes.set(link.target.id, link.target);
      links.push({
        id: link.id,
        source: source.id,
        target: link.target.id,
        event: link.label,
        guard: 'unguarded',
        transitionCount: 0,
      });
    }
  }
  return { notes, links, partial };
}

export function journeyOverview<M>(
  h: HtmlBuilder<M>,
  start: ZlozNode,
  steps: readonly Link[],
  outgoing: Outgoing,
) {
  const current = steps.at(-1)?.target ?? start;
  const fromStart = neighbourhood(start, outgoing);
  const local = !fromStart.notes.has(current.id);
  const { notes, links, partial } = local ? neighbourhood(current, outgoing) : fromStart;
  const layout = layoutStateFlow(
    {
      nodes: Array.from(notes.values(), (node) => ({
        id: node.id,
        label: node.label,
        role: 'normal',
        visitCount: 0,
      })),
      edges: links,
    },
    { iterations: 60, linkDistance: 92, collideRadius: 38 },
  );
  const xs = layout.nodes.map((node) => node.x),
    ys = layout.nodes.map((node) => node.y);
  const x = Math.min(...xs) - 52,
    y = Math.min(...ys) - 18;
  const width = Math.max(104, Math.max(...xs) - x + 52),
    height = Math.max(62, Math.max(...ys) - y + 30);
  const visited = new Set(steps.map((step) => step.id));
  const position = `Step ${steps.length + 1} · ${current.label}`;
  const describe = (edge: StateFlowEdge) =>
    `${notes.get(edge.source)?.label} ${edge.event.toLowerCase()} ${notes.get(edge.target)?.label}`;
  return h.figure(
    [h.Class('journey-overview')],
    [
      h.figcaption([], [position]),
      h.svg(
        [
          h.ViewBox(`${x} ${y} ${width} ${height}`),
          h.Width('100%'),
          h.Height('160'),
          h.Role('img'),
          h.AriaLabel('Journey overview'),
          h.AriaDescribedBy('journey-overview-description'),
        ],
        [
          h.desc(
            [h.Id('journey-overview-description')],
            [[position, ...links.map(describe)].join('. ')],
          ),
          ...layout.edges.map((edge) => {
            const dx = edge.x2 - edge.x1,
              dy = edge.y2 - edge.y1;
            const length = Math.hypot(dx, dy);
            const ink = visited.has(edge.id) ? 'var(--team-accent)' : 'var(--team-edge)';
            return h.g(
              [
                h.Key('link:' + edge.id),
                h.Transform(
                  `translate(${edge.x1} ${edge.y1}) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI})`,
                ),
              ],
              [
                h.path(
                  [
                    h.D(`M 8 0 H ${length - 11} m -5 -3 5 3 -5 3`),
                    h.Stroke(ink),
                    h.StrokeWidth(visited.has(edge.id) ? '2.8' : '1.5'),
                    h.Fill('none'),
                  ],
                  [],
                ),
              ],
            );
          }),
          ...layout.nodes.map((node) => {
            const here = node.id === current.id;
            return h.g(
              [h.Key('note:' + node.id), h.Transform(`translate(${node.x} ${node.y})`)],
              [
                h.title([], [node.label]),
                ...(here
                  ? [
                      h.circle(
                        [
                          h.R('10'),
                          h.Fill('none'),
                          h.Stroke('var(--team-accent)'),
                          h.StrokeWidth('2'),
                        ],
                        [],
                      ),
                    ]
                  : []),
                h.circle(
                  [
                    h.R('5'),
                    h.Fill(here ? 'var(--team-accent)' : 'var(--team-panel)'),
                    h.Stroke('currentColor'),
                  ],
                  [],
                ),
                h.text(
                  [h.Y('22'), h.TextAnchor('middle'), h.FontSize('11'), h.Fill('currentColor')],
                  [node.label.length > 13 ? node.label.slice(0, 12) + '…' : node.label],
                ),
              ],
            );
          }),
        ],
      ),
      ...(partial || local ? [h.small([], [`Showing ${notes.size} nearby notes`])] : []),
    ],
  );
}
