-- Authorization must resolve exactly one current role for a user in a team.
CREATE UNIQUE INDEX member_organization_user_unique ON member (organizationId, userId);
