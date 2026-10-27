-- Recover repository identity on legacy outcomes before replacing the narrower key.
UPDATE "RolloutOutcome" AS outcome SET "owner" = commit."owner", "repo" = commit."repo"
FROM "Commit" AS commit WHERE outcome."commitId" = commit."id"
AND (outcome."owner" IS NULL OR outcome."repo" IS NULL);
CREATE UNIQUE INDEX "RolloutOutcome_installationId_owner_repo_commitSha_key"
ON "RolloutOutcome"("installationId", "owner", "repo", "commitSha");
DROP INDEX IF EXISTS "RolloutOutcome_installationId_commitSha_key";
