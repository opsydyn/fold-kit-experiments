import { Schema } from 'effect';

export const Id = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/),
);
const prompt = Schema.String.pipe(Schema.decodeTo(Schema.Trim)).check(
  Schema.isBetweenLength(3, 400),
);
const title = Schema.String.pipe(Schema.decodeTo(Schema.Trim)).check(Schema.isBetweenLength(1, 72));
export const Start = Schema.Union([
  Schema.Struct({ id: Id, prompt, kind: Schema.optionalKey(Schema.Literal('sprite')) }),
  Schema.Struct({
    id: Id,
    prompt,
    kind: Schema.Literal('backdrop'),
    title,
  }),
]);
export const Apply = Schema.Struct({ id: Id });
export const Reveal = Schema.Struct({ id: Id, style: Schema.Literals(['plain', 'generated']) });
export const LedgerRevision = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
);
export const CaptureRoom = Schema.Struct({
  roomId: LedgerRevision,
  expectedBackdrop: LedgerRevision,
});
export const EditLedgerEntry = Schema.Struct({
  id: LedgerRevision,
  expectedRevision: LedgerRevision,
  title,
  notes: Schema.String.check(Schema.isMaxLength(1500)),
});
export const PublishLedgerEntry = Schema.Struct({
  id: LedgerRevision,
  expectedVersion: LedgerRevision,
  title,
  recap: Schema.String.check(Schema.isMaxLength(1500)),
});
export const artwork = {
  sprite: { width: 32, height: 48, maxBytes: 96_000 },
  backdrop: { width: 1024, height: 576, maxBytes: 2_500_000 },
} as const;
export type ArtKind = keyof typeof artwork;
export const Move = Schema.Struct({
  id: Schema.Literals(['pip', 'mira', 'brasswick', 'wicket']),
  x: Schema.Number.check(Schema.isFinite(), Schema.isBetween({ minimum: 0, maximum: 1440 })),
  y: Schema.Number.check(Schema.isFinite(), Schema.isBetween({ minimum: 0, maximum: 746 })),
  expected: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export type Role = 'dm' | 'player';
export type Token = Readonly<{
  id: typeof Move.Type.id;
  label: string;
  x: number;
  y: number;
  positionVersion: number;
  artVersion: number;
  assetId: string | null;
}>;
export type Backdrop = Readonly<{ title: string; revision: number; roomRevision?: number }> &
  (Readonly<{ style: 'original' | 'plain' }> | Readonly<{ style: 'generated'; assetId: string }>);
export const roomIdentity = (backdrop: Backdrop) => backdrop.roomRevision ?? backdrop.revision;
export type Publication = Readonly<{ version: number; title: string; recap: string }>;
export type LedgerEntry = Readonly<{
  id: number;
  revision: number;
  room: Backdrop;
  title: string;
  notes: string;
  published?: Publication;
}>;
export type PartyLedgerEntry = Publication &
  Readonly<{
    id: number;
    room: Readonly<Pick<Backdrop, 'title' | 'style'>>;
  }>;
export const partyEntryFor = (entry: LedgerEntry, publication: Publication): PartyLedgerEntry => ({
  id: entry.id,
  version: publication.version,
  title: publication.title,
  recap: publication.recap,
  room: { title: entry.room.title, style: entry.room.style },
});
export type Scene = Readonly<{ version: number; tokens: readonly Token[]; backdrop: Backdrop }>;
export const initialScene: Scene = {
  version: 0,
  backdrop: { title: 'The Aurora Gate', revision: 0, style: 'original' },
  tokens: (
    [
      { id: 'pip', label: 'Pip', x: 540, y: 674 },
      { id: 'mira', label: 'Mira', x: 725, y: 647 },
      { id: 'brasswick', label: 'Brasswick', x: 895, y: 706 },
      { id: 'wicket', label: 'Wicket', x: 1070, y: 651 },
    ] as const
  ).map(({ id, label, x, y }) => ({
    id,
    label,
    x,
    y,
    positionVersion: 0,
    artVersion: 0,
    assetId: null,
  })),
};

type JobState =
  | Readonly<{ status: 'pending' | 'ready' | 'failed' }>
  | Readonly<{ status: 'applied'; version: number }>;
type JobRecord = Readonly<{ id: string; prompt: string; artVersion: number; assetId: string }> &
  JobState;
export type SpriteJob = JobRecord & Readonly<{ kind?: 'sprite' }>;
export type BackdropJob = JobRecord &
  Readonly<{ kind: 'backdrop'; title: string; plainVersion?: number }>;
export type Job = SpriteJob | BackdropJob;
export type RoomView = Scene & Readonly<{ role: Role; job?: SpriteJob; backdropJob?: BackdropJob }>;
export const seats = ['mira', 'brasswick', 'wicket'] as const;
export type Seat = (typeof seats)[number];
export type Participant =
  | { role: 'dm'; joined: true }
  | { role: 'player'; seat: Seat; joined: boolean };
export const seatNames = {
  mira: 'Mira',
  brasswick: 'Brasswick',
  wicket: 'Wicket',
};
export const mayMove = (participant: Participant, token: string) =>
  participant.role === 'dm' || token === participant.seat;
const AccountId = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{1,128}$/));
export const InviteSeats = Schema.Tuple([AccountId, AccountId, AccountId]);
export const isAccountId = Schema.is(AccountId);
export const RoomNotice = Schema.Literals(['room', 'party-ledger']);
export type RoomNotice = typeof RoomNotice.Type;
