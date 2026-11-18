import { Schema } from 'effect';

export const Id = Schema.String.pipe(Schema.check(Schema.isPattern(/^[A-Za-z0-9_-]{1,128}$/)));
export const Role = Schema.Literals(['owner', 'editor', 'viewer']);
export type Role = typeof Role.Type;
export const Email = Schema.String.pipe(
  Schema.check(Schema.isMaxLength(254), Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
);
const Name = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(100), Schema.isPattern(/\S/)),
);
export const BootstrapCommand = Schema.Struct({
  ownerEmail: Email,
  name: Name,
  slug: Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/))),
  apply: Schema.Boolean,
});
export const Team = Schema.Struct({ id: Id, name: Schema.String, slug: Schema.String });
export const BootstrapResult = Schema.Union([
  Schema.TaggedStruct('Ready', {
    status: Schema.Literal('ready'),
    name: Name,
    slug: Schema.String,
  }),
  Schema.TaggedStruct('Applied', { status: Schema.Literals(['created', 'existing']), team: Team }),
]);
export const Member = Schema.Struct({
  id: Id,
  userId: Id,
  name: Schema.String,
  email: Email,
  role: Role,
});
export const Invitation = Schema.Struct({
  id: Id,
  email: Email,
  role: Role,
  expiresAt: Schema.Number,
  status: Schema.String,
});
export const Diagram = Schema.Struct({ id: Id, name: Schema.String, updatedAt: Schema.Number });
export const TeamView = Schema.Struct({
  team: Team,
  role: Role,
  currentUserId: Id,
  members: Schema.Array(Member),
  invitations: Schema.Array(Invitation),
  diagrams: Schema.Array(Diagram),
});
export const InvitationView = Schema.Union([
  Schema.TaggedStruct('Pending', {
    id: Id,
    team: Team,
    role: Role,
    email: Email,
    expiresAt: Schema.Number,
  }),
  Schema.TaggedStruct('Joined', { team: Team }),
  Schema.TaggedStruct('Expired', {}),
  Schema.TaggedStruct('Cancelled', {}),
  Schema.TaggedStruct('Used', {}),
]);
export const InviteCommand = Schema.Struct({ email: Email, role: Role });
export const RoleCommand = Schema.Struct({ memberId: Id, role: Role });
export const RemoveCommand = Schema.Struct({ memberId: Id });
export const CancelCommand = Schema.Struct({ invitationId: Id });
export const MutationResult = Schema.Struct({
  teamId: Id,
  destination: Schema.Literals(['team', 'home']),
});
export const Problem = Schema.Struct({ code: Schema.String, message: Schema.String });
export type TeamView = typeof TeamView.Type;
export type InvitationView = typeof InvitationView.Type;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
