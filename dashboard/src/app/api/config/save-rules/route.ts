import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { mintInstallationToken } from "../../../../lib/installationAccess";
import { getCarfConfigFile, putCarfConfigFile } from "../../../../adapters/github/contentsClient";
import { applyClassificationThresholdPatch, InvalidCarfConfigError } from "../../../../lib/carfConfigWriter";
import { ClassificationSchema, ThresholdSchema } from "../../../../lib/carfConfigSchema";

/**
 * Issue #63's save action: JSON POST (not a form -- the classification/threshold form has
 * dynamic list state a plain HTML form can't express) carrying the same patch shape
 * RulesForm.tsx's live preview already validated client-side. Re-validated here too --
 * client-side validation is a UX nicety (#63's acceptance criterion), never a substitute
 * for server-side enforcement.
 */
export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as {
    installationId?: string;
    owner?: string;
    repo?: string;
    classification?: unknown;
    threshold?: unknown;
  };
  const { installationId, owner, repo } = body;

  if (!installationId || !owner || !repo) {
    return NextResponse.json({ error: "missing installationId/owner/repo" }, { status: 400 });
  }

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "not authorized for this installation" }, { status: 403 });
  }

  const classificationResult = ClassificationSchema.safeParse(body.classification);
  const thresholdResult = ThresholdSchema.safeParse(body.threshold);
  if (!classificationResult.success || !thresholdResult.success) {
    return NextResponse.json(
      {
        error: "invalid classification/threshold payload",
        issues: [...(classificationResult.success ? [] : classificationResult.error.issues), ...(thresholdResult.success ? [] : thresholdResult.error.issues)],
      },
      { status: 400 }
    );
  }

  try {
    const token = await mintInstallationToken(installationId);
    const existingFile = await getCarfConfigFile(owner, repo, token);

    const nextYaml = applyClassificationThresholdPatch(existingFile?.content ?? null, {
      classification: classificationResult.data,
      threshold: thresholdResult.data,
    });

    await putCarfConfigFile(
      owner,
      repo,
      nextYaml,
      "chore: update CARF classification/threshold config via dashboard",
      token,
      existingFile?.sha
    );
  } catch (error) {
    const status = error instanceof InvalidCarfConfigError ? 400 : 502;
    return NextResponse.json({ error: "failed to save .carf.yml" }, { status });
  }

  return NextResponse.json({ ok: true });
}
