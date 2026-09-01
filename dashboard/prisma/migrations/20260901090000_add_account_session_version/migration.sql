-- Adds Account.sessionVersion, carried in the signed session cookie and incremented on
-- every password change so that changing a password revokes sessions minted before it.
--
-- Existing rows start at 0 while every live cookie was minted without a version field at
-- all. Those cookies no longer parse under the new 4-part format, so this migration signs
-- every current user out exactly once, which is the intended behaviour for a change that
-- exists to revoke sessions.
ALTER TABLE "Account" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
