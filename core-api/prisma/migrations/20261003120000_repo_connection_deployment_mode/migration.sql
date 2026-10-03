-- Additive: explicit deployment mode on RepoConnection.
-- Does not delete rows, rollouts, commits, or tokens.
-- Backfill prefers storedConfig.mode / integration, then Sahaay/PM2 cues.

CREATE TYPE "DeploymentMode" AS ENUM ('standalone', 'augment');

ALTER TABLE "RepoConnection" ADD COLUMN "mode" "DeploymentMode";

UPDATE "RepoConnection"
SET "mode" = 'augment'
WHERE ("storedConfig"->>'mode') = 'augment'
   OR NULLIF("storedConfig"->>'integration', '') IS NOT NULL;

UPDATE "RepoConnection"
SET "mode" = 'standalone'
WHERE "mode" IS NULL
  AND (
    lower("repo") = 'sahaay'
    OR ("storedConfig"->>'mode') = 'standalone'
    OR NULLIF("storedConfig"->>'target', '') IS NOT NULL
    OR ("storedConfig"->>'kind') = 'pm2'
    OR "storedConfig"->'adapter' IS NOT NULL
    OR "installTokenHash" IS NOT NULL
  );

-- Remaining rows (including any accidental "production" connection) stay
-- standalone only as a NOT NULL default. UI will not treat repo=production
-- as a GitHub repository unless GitHub actually returns that name.
UPDATE "RepoConnection"
SET "mode" = 'standalone'
WHERE "mode" IS NULL;

ALTER TABLE "RepoConnection"
  ALTER COLUMN "mode" SET NOT NULL,
  ALTER COLUMN "mode" SET DEFAULT 'standalone';
