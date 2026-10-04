-- Non-destructive migration: adds pm2Process column on RepoConnection and backfills from storedConfig
-- Preserves all existing rollouts, commits, and configurations.

ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "deploymentIntegration" TEXT DEFAULT 'github_actions';
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "runtimeAdapter" TEXT DEFAULT 'none';
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "pm2Process" TEXT;

-- Backfill pm2Process for PM2 repositories (including Sahaay)
UPDATE "RepoConnection"
SET "pm2Process" = COALESCE(
  "pm2Process",
  "storedConfig"->>'target',
  "storedConfig"->>'name',
  "storedConfig"->>'targetName',
  CASE WHEN lower("repo") = 'sahaay' THEN 'sahaay' ELSE NULL END
)
WHERE ("runtimeAdapter" = 'pm2' OR lower("repo") = 'sahaay' OR "storedConfig"->>'kind' = 'pm2');
