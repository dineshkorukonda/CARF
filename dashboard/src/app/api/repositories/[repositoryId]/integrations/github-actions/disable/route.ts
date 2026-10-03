import { NextRequest } from "next/server";
import { handleGithubActionsIntegration } from "../../../../../../../lib/githubActionsIntegrationRoute";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ repositoryId: string }> }) {
  const { repositoryId } = await params;
  return handleGithubActionsIntegration(repositoryId, "disable");
}