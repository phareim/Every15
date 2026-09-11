CREATE TABLE IF NOT EXISTS "User" (id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT);
CREATE TABLE IF NOT EXISTS "session" (token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at TEXT NOT NULL);
INSERT OR REPLACE INTO "User" VALUES ('every15-test-user','phareim@gmail.com','Petter');
INSERT OR REPLACE INTO "session" VALUES ('every15-local-smoke','every15-test-user','2099-01-01T00:00:00.000Z');
INSERT OR REPLACE INTO "User" VALUES ('every15-other-user','not-allowed@example.com','Other');
INSERT OR REPLACE INTO "session" VALUES ('every15-local-denied','every15-other-user','2099-01-01T00:00:00.000Z');
INSERT OR REPLACE INTO "User" VALUES ('every15-second-owner','phareim@gmail.com','Second local fixture');
INSERT OR REPLACE INTO "session" VALUES ('every15-local-second','every15-second-owner','2099-01-01T00:00:00.000Z');
