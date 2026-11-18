CREATE TABLE diagramDirectory (
  organizationId TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  diagramId TEXT NOT NULL,
  name TEXT NOT NULL,
  updatedAt INTEGER NOT NULL,
  PRIMARY KEY (organizationId, diagramId)
);

CREATE TRIGGER member_capacity_on_insert
BEFORE INSERT ON member
WHEN (SELECT COUNT(*) FROM member WHERE organizationId = NEW.organizationId) >= 10
BEGIN
  SELECT RAISE(ABORT, 'zloz_team_full');
END;

CREATE TRIGGER member_capacity_on_move
BEFORE UPDATE OF organizationId ON member
WHEN OLD.organizationId != NEW.organizationId
  AND (SELECT COUNT(*) FROM member WHERE organizationId = NEW.organizationId) >= 10
BEGIN
  SELECT RAISE(ABORT, 'zloz_team_full');
END;

CREATE TRIGGER invitation_valid_role_on_insert
BEFORE INSERT ON invitation
WHEN NEW.role IS NULL OR NEW.role NOT IN ('owner', 'editor', 'viewer')
BEGIN
  SELECT RAISE(ABORT, 'zloz_invalid_role');
END;

CREATE TRIGGER invitation_valid_role_on_update
BEFORE UPDATE OF role ON invitation
WHEN NEW.role IS NULL OR NEW.role NOT IN ('owner', 'editor', 'viewer')
BEGIN
  SELECT RAISE(ABORT, 'zloz_invalid_role');
END;
