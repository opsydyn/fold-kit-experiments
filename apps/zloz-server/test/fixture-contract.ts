import { Schema } from 'effect';

export const Actor = Schema.Struct({
  userId: Schema.String,
  email: Schema.String,
  cookie: Schema.String,
  sessionId: Schema.String,
  memberId: Schema.String,
});
export const Fixture = Schema.Struct({
  organizationId: Schema.String,
  otherOrganizationId: Schema.String,
  owner: Actor,
  editor: Actor,
  viewer: Actor,
  outsider: Actor,
});
export type Fixture = typeof Fixture.Type;
