export const exploreSpecimens = [
  {
    id: '4c0c68adb8210c249f623323',
    fn: 'colorsOf',
    line: 26,
    name: 'Bleached palette',
    short: 'Palette',
    note: 'Returns five empty colour values.',
    key: 'One eye marks a value replacement.',
    kind: 'value',
  },
  {
    id: '7f3599ead3dbd5cc848f7ff8',
    fn: 'colorsOf.read',
    line: 29,
    name: 'Fallback mimic',
    short: 'Fallback',
    note: 'Always returns the fallback colour.',
    key: 'One eye marks a value replacement.',
    kind: 'value',
  },
  {
    id: '9308eceba58e69c0bd7a0916',
    fn: 'colorsOf.read',
    line: 29,
    name: 'Hollow reader',
    short: 'Empty',
    note: 'Returns an empty string for every colour lookup.',
    key: 'One eye marks a value replacement.',
    kind: 'value',
  },
  {
    id: 'ae22caefc5e42f717cb32fb3',
    fn: 'colorsOf.read',
    line: 29,
    name: 'Literal mimic',
    short: 'Literal',
    note: 'Returns the same “xyzzy” string for every lookup.',
    key: 'One eye marks a value replacement.',
    kind: 'value',
  },
  {
    id: '088431c5ccfa86175c2fdbce',
    fn: 'PaintScatter.execute',
    line: 51,
    name: 'The endless one',
    short: 'Never',
    note: 'The paint effect never completes. The caller waits indefinitely.',
    key: 'Two eyes mark an effect mutation. The loop means it never completes.',
    kind: 'never',
  },
  {
    id: '4cbd778d63db8381c719e7f7',
    fn: 'PaintScatter.execute',
    line: 51,
    name: 'Fault spine',
    short: 'Die',
    note: 'The paint effect terminates with a defect.',
    key: 'Two eyes mark an effect mutation. The spikes mean it dies.',
    kind: 'die',
  },
  {
    id: 'c174995116163bbdb0dcf6af',
    fn: 'PaintScatter.execute',
    line: 51,
    name: 'False finisher',
    short: 'Succeed',
    note: 'Reports PaintedScatter with an empty key without doing the painting.',
    key: 'Two eyes mark an effect mutation. The halo means it immediately succeeds.',
    kind: 'succeed',
  },
] as const;
export interface Specimen {
  id: string;
  fn: string;
  line: number;
  name: string;
  short: string;
  note: string;
  key: string;
  kind: 'value' | 'never' | 'die' | 'succeed' | 'other';
}
