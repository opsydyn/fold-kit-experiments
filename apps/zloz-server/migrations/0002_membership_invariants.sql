-- A count followed by a plugin update is not atomic on D1. Enforce the invariant
-- in the same SQLite statement, including direct organization plugin endpoints.
CREATE TRIGGER member_retains_owner_on_update
BEFORE UPDATE OF role, organizationId ON member
WHEN OLD.role = 'owner'
  AND (NEW.role != 'owner' OR NEW.organizationId != OLD.organizationId)
  AND (SELECT COUNT(*) FROM member WHERE organizationId = OLD.organizationId AND role = 'owner') <= 1
BEGIN
  SELECT RAISE(ABORT, 'zloz_last_owner');
END;

CREATE TRIGGER member_retains_owner_on_delete
BEFORE DELETE ON member
WHEN OLD.role = 'owner'
  AND (SELECT COUNT(*) FROM member WHERE organizationId = OLD.organizationId AND role = 'owner') <= 1
BEGIN
  SELECT RAISE(ABORT, 'zloz_last_owner');
END;

CREATE TRIGGER member_valid_role_on_insert
BEFORE INSERT ON member
WHEN NEW.role NOT IN ('owner', 'editor', 'viewer')
BEGIN
  SELECT RAISE(ABORT, 'zloz_invalid_role');
END;

CREATE TRIGGER member_valid_role_on_update
BEFORE UPDATE OF role ON member
WHEN NEW.role NOT IN ('owner', 'editor', 'viewer')
BEGIN
  SELECT RAISE(ABORT, 'zloz_invalid_role');
END;
