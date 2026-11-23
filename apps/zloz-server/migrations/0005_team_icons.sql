CREATE TABLE teamIcon (
  organizationId TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  mediaType TEXT NOT NULL CHECK (mediaType IN ('image/png', 'image/webp')),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  PRIMARY KEY (organizationId, id)
);
