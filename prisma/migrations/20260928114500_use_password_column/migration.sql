-- Preserve existing Argon2 password hashes while restoring the User.password
-- name. Some existing deployments already use password despite recording the
-- earlier authentication migration, so this is intentionally idempotent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'passwordHash'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "passwordHash" TO "password";
  END IF;
END $$;
