import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

// A Likert survey: agreement with six statements.
const ANSWERS = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
const COLOURS = ['#ef4444', '#fca5a5', '#d1d5db', '#93c5fd', '#3b82f6'];
const STATEMENTS: ReadonlyArray<readonly [string, ReadonlyArray<number>]> = [
  ['Easy to learn', [5, 12, 18, 38, 27]],
  ['Well documented', [8, 15, 22, 34, 21]],
  ['Good performance', [3, 8, 12, 44, 33]],
  ['Active community', [6, 18, 24, 32, 20]],
  ['Production ready', [4, 9, 14, 41, 32]],
  ['Enjoyable to use', [7, 11, 16, 40, 26]],
];

/**
 * Each answer's share of its statement, negative for disagreement. Neutral is
 * split in half across zero, so its two pieces stack as separate series.
 */
function pieces(): ReadonlyArray<Row> {
  // Stacked outward from zero in this order on each side.
  const order = [2, 2, 1, 3, 0, 4];
  return STATEMENTS.flatMap(([statement, counts]) => {
    const total = counts.reduce((sum, n) => sum + n, 0);
    return order.map((answer, k) => {
      const share = (counts[answer] ?? 0) / total;
      const neutral = answer === 2;
      const signed = neutral ? (k === 0 ? -share / 2 : share / 2) : answer < 2 ? -share : share;
      return {
        statement,
        answer: ANSWERS[answer] ?? '',
        piece: neutral ? `Neutral ${k === 0 ? 'below' : 'above'}` : (ANSWERS[answer] ?? ''),
        share: signed,
        label: `${statement}, ${ANSWERS[answer] ?? ''}: ${Math.round(share * 100)}%`,
      };
    });
  });
}

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Survey agreement',
  description: 'Agreement with six statements; disagreement extends left of zero, agreement right.',
  margins: { left: 112 },
  data: pieces(),
  x: { label: 'Share of answers', domain: [-0.5, 0.9] },
  y: { label: '', padding: 0.3 },
  color: { domain: ANSWERS, range: COLOURS },
  marks: [
    {
      mark: 'bar',
      x: 'share',
      y: 'statement',
      z: 'piece',
      fill: 'answer',
      stack: 'zero',
      title: 'label',
    },
    { mark: 'rule', x: { value: 0 }, stroke: { value: 'currentColor' } },
  ],
};
