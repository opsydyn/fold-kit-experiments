import {
  createSvgReview,
  portPosition,
  resolveSvgReview,
  updateSvgReview,
  type ZlozOperationDocument,
  type ZlozSvgAdapter,
  type ZlozSvgPrimitive,
  type ZlozSvgReviewContext,
  type ZlozSvgReviewRequest,
  type ZlozSvgReviewState,
} from '@opsydyn/foldkit-zloz';

import { c4Appearance } from '../appearance/c4';
import { assetPath, builtInIcon } from './team-icons';

// Use the SDK's checked primitive vocabulary for portable C4 symbols.
const circle = (x: number, y: number, radius: number): ZlozSvgPrimitive => ({
  type: 'circle',
  center: { x, y },
  radius,
});
const poly = (
  type: 'polygon' | 'polyline',
  points: readonly (readonly [number, number])[],
): ZlozSvgPrimitive => ({
  type,
  points: points.map(([x, y]) => ({ x, y })),
});
const symbols = {
  user: [
    circle(10, 5, 3),
    poly('polyline', [
      [3, 18],
      [4, 14],
      [7, 11],
      [13, 11],
      [16, 14],
      [17, 18],
    ]),
  ],
  package: [
    { type: 'rect', position: { x: 2, y: 3 }, width: 16, height: 14, radius: 2 },
    poly('polyline', [
      [2, 8],
      [18, 8],
    ]),
    poly('polyline', [
      [8, 3],
      [8, 11],
      [12, 11],
      [12, 3],
    ]),
  ],
  cloud: [
    circle(6, 12, 4),
    circle(11, 8, 5),
    circle(16, 12, 3),
    { type: 'rect', position: { x: 6, y: 12 }, width: 10, height: 4, radius: 2 },
  ],
  stack: [
    poly('polygon', [
      [1, 7],
      [10, 2],
      [19, 7],
      [10, 12],
    ]),
    poly('polyline', [
      [1, 12],
      [10, 17],
      [19, 12],
    ]),
  ],
  cube: [
    poly('polygon', [
      [2, 5],
      [10, 1],
      [18, 5],
      [18, 14],
      [10, 19],
      [2, 14],
    ]),
    poly('polyline', [
      [2, 5],
      [10, 10],
      [18, 5],
    ]),
    poly('polyline', [
      [10, 10],
      [10, 19],
    ]),
  ],
} satisfies Readonly<Record<ReturnType<typeof c4Appearance>['icon'], readonly ZlozSvgPrimitive[]>>;

const cardAdapter = (images: Readonly<Record<string, string>> | null): ZlozSvgAdapter => ({
  id: 'zloz-teams-c4-card',
  version: '1',
  render: (context) => {
    if (context.kind !== 'node') throw new Error('The card renderer requires a node.');
    const {
      node,
      theme: { tokens },
      font,
    } = context;
    const { x, y } = node.position;
    const architecture = context.node.architecture;
    const appearance = architecture?.family === 'c4' ? c4Appearance(architecture) : null;
    const image = images?.[node.id];
    const labels = [
      node.label,
      ...(appearance && architecture?.family === 'c4'
        ? [
            appearance.label,
            ...('technology' in architecture && architecture.technology
              ? [architecture.technology]
              : []),
            ...(architecture.scope &&
            !(architecture.role === 'software-system' && architecture.scope === 'external')
              ? [architecture.scope]
              : []),
            ...(architecture.description ? [architecture.description] : []),
          ]
        : []),
    ];
    let line = 0;
    const text = labels.map((label, index): ZlozSvgPrimitive => {
      const position = { x: x + 38, y: y + 23 + line * font.size * 1.25 };
      line += label.split(/\r\n|\r|\n/u).length;
      return {
        type: 'text',
        position,
        text: label,
        fill: tokens.nodeColor,
        weight: index === 0 ? 600 : font.weight,
      };
    });
    return [
      {
        type: 'rect',
        position: node.position,
        ...node.size,
        radius: 4,
        fill: tokens.nodeBackground,
        stroke: tokens.nodeBorder,
        strokeWidth: 1.5,
      },
      {
        type: 'group',
        translate: { x: x + 10, y: y + 9 },
        children: image
          ? [{ type: 'raster', position: { x: 0, y: 0 }, width: 20, height: 20, data: image }]
          : symbols[builtInIcon(node.icon) ?? appearance?.icon ?? 'cube'].map((symbol) => ({
              ...symbol,
              fill: 'none',
              stroke: tokens.nodeColor,
              strokeWidth: 1.5,
            })),
      },
      ...text,
      ...node.ports.flatMap((port): ZlozSvgPrimitive[] => {
        const center = portPosition(node, port.id);
        const input = port.kind === 'input';
        return [
          {
            type: 'circle',
            center,
            radius: 4,
            fill: input ? tokens.inputPort : tokens.outputPort,
            stroke: tokens.portBorder,
            strokeWidth: 1,
          },
          {
            type: 'text',
            position: { x: center.x + (input ? -9 : 9), y: center.y - 7 },
            anchor: input ? 'end' : 'start',
            text: port.label ?? port.id,
          },
        ];
      }),
    ];
  },
});

export const iconReferences = (graph: ZlozOperationDocument['graph']) => [
  ...new Set(
    graph.nodes.flatMap((node) =>
      node.kind !== 'group' && node.icon?.startsWith('team:') ? [node.icon] : [],
    ),
  ),
];

export async function loadIcons(team: string, references: readonly string[]) {
  const results = await Promise.allSettled(
    references.map(async (reference) => {
      const response = await fetch(assetPath(team, reference));
      const type = response.headers.get('content-type');
      if (!response.ok || (type !== 'image/png' && type !== 'image/webp'))
        throw new Error('Missing icon');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 64 * 1024) throw new Error('Icon exceeds export limit');
      let binary = '';
      for (let index = 0; index < bytes.length; index += 4096)
        binary += String.fromCharCode(...bytes.subarray(index, index + 4096));
      return [reference, `data:${type};base64,${btoa(binary)}`] as const;
    }),
  );
  return Object.fromEntries(
    results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
  );
}

export type Availability = 'current' | 'newer' | 'offline';
export type Review = Readonly<{
  graph: ZlozOperationDocument['graph'];
  version: number;
  title: string;
  state: ZlozSvgReviewState;
  notice: string;
  images: Readonly<Record<string, string>> | null;
}>;

export function open(
  document: ZlozOperationDocument,
  title: string,
  scope: string,
  previous?: Review,
) {
  return {
    graph: document.graph,
    version: document.version,
    title,
    state: createSvgReview(scope, previous?.state.preferences),
    notice: '',
    images: iconReferences(document.graph).length ? null : {},
  } satisfies Review;
}

export function availability(
  review: Review,
  current: ZlozOperationDocument | undefined,
): Availability {
  if (!current) return 'offline';
  return review.version === current.version ? 'current' : 'newer';
}

function context(review: Review, available: Availability): ZlozSvgReviewContext {
  const images: Record<string, string> = {};
  // Leave room under the SVG writer's output budget for geometry and labels.
  let imageCharacters = 1_000_000;
  for (const node of review.graph.nodes) {
    const data = node.kind !== 'group' && node.icon ? review.images?.[node.icon] : undefined;
    if (!data || data.length > imageCharacters) continue;
    images[node.id] = data;
    imageCharacters -= data.length;
  }
  const card = cardAdapter(images);
  return {
    scope: review.state.scope,
    sourceRevision: review.version,
    snapshot: { graph: review.graph },
    title: review.title,
    description:
      'Confirmed ZLOZ Teams diagram. Shared assessments, decisions and live board decorations are outside the SVG.',
    fileName: `zloz-v${review.version}.svg`,
    theme: { colorScheme: 'light' },
    regions: [{ id: 'model', label: 'Whole diagram', value: { type: 'model', padding: 32 } }],
    themes: [
      { id: 'source', label: 'Light', value: { colorScheme: 'light' } },
      { id: 'dark', label: 'Dark', value: { colorScheme: 'dark' } },
    ],
    renderers: {
      nodes: 'built-in',
      edges: 'built-in',
      overrides: review.graph.nodes.flatMap((node) => {
        if (node.architecture?.family !== 'c4' && !node.icon) return [];
        const target = { kind: 'node', id: node.id } as const;
        return [
          {
            target,
            renderer:
              node.kind === 'group'
                ? {
                    type: 'fallback',
                    reason:
                      'C4 groups keep their canonical outline and text. No C4 symbol is drawn for groups.',
                  }
                : {
                    type: 'svg',
                    id: card.id,
                    version: card.version,
                    bounds: { ...node.position, ...node.size },
                    fidelity: 'approximate',
                    reason:
                      node.icon?.startsWith('team:') && !review.images?.[node.icon]
                        ? 'The custom icon is unavailable. The SVG uses a default symbol.'
                        : node.icon?.startsWith('team:') && !images[node.id]
                          ? 'The icon would exceed the SVG image budget. The SVG uses a default symbol.'
                          : node.icon?.startsWith('team:')
                            ? 'The team icon is embedded as an image. Card styling becomes a static card.'
                            : 'The board’s Phosphor icon and card styling become a portable C4 vector symbol and static card.',
                  },
          },
        ];
      }),
    },
    writing: { adapters: [card] },
    canDownload: () =>
      available === 'newer'
        ? 'A newer confirmed version is available.'
        : available === 'offline'
          ? 'Reconnect to download the confirmed SVG.'
          : review.images === null
            ? 'Loading team icons for this SVG.'
            : null,
  };
}

export const resolve = (review: Review, available: Availability) =>
  resolveSvgReview(review.state, context(review, available));

export function update(review: Review, available: Availability, request: ZlozSvgReviewRequest) {
  const { state, notice, payload } = updateSvgReview(
    review.state,
    context(review, available),
    request,
  );
  return { review: { ...review, state, notice }, payload };
}
