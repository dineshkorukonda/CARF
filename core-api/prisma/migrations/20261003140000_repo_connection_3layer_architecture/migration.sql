-- Additive: 3-layer architecture fields (deploymentIntegration, runtimeAdapter) on RepoConnection.
-- Does not delete rows, rollouts, commits, or tokens.
-- Backfill preserves Sahaay and existing standalone/augment configurations.

ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "deploymentIntegration" TEXT DEFAULT 'github_actions';
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "runtimeAdapter" TEXT DEFAULT 'none';

-- Backfill runtimeAdapter for PM2/standalone repos (including Sahaay)
UPDATE "RepoConnection"
SET "runtimeAdapter" = 'pm2'
WHERE ("runtimeAdapter" = 'none' OR "runtimeAdapter" IS NULL)
  AND (
    "mode" = 'standalone'
    OR lower("repo") = 'sahaay'
    OR ("storedConfig"->>'mode') = 'standalone'
    OR NULLIF("storedConfig"->>'target', '') IS NOT NULL
    OR ("storedConfig"->>'kind') = 'pm2'
    OR "storedConfig"->'adapter' IS NOT NULL
    OR "installTokenHash" IS NOT NULL
  );

-- Backfill deploymentIntegration based on storedConfig if specified
UPDATE "RepoConnection"
SET "deploymentIntegration" = 'argo_rollouts'
WHERE ("storedConfig"->>'integration') = 'argo-rollouts'
   OR ("storedConfig"->>'deploymentIntegration') = 'argo_rollouts';

UPDATE "RepoConnection"
SET "deploymentIntegration" = 'flagger'
WHERE ("storedConfig"->>'integration') = 'flagger'
   OR ("storedConfig"->>'deploymentIntegration') = 'flagger';

UPDATE "RepoConnection"
SET "deploymentIntegration" = 'generic_http'
WHERE ("storedConfig"->>'integration') = 'generic-http'
   OR ("storedConfig"->>'deploymentIntegration') = 'generic_http';
