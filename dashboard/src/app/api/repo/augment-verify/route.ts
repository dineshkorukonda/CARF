import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { env } from "../../../../config/env";
import { resolveRepoMode } from "../../../../lib/deploymentMode";

interface ThresholdProbe {
  ok: boolean;
  status: number;
  endpoint: string;
  threshold?: number;
  window?: number;
  error?: string;
}

async function probeThreshold(
  url: string,
  apiKey: string
): Promise<ThresholdProbe> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }

    if (res.ok) {
      const threshold =
        typeof parsed.threshold === "number"
          ? parsed.threshold
          : typeof parsed.finalThreshold === "number"
            ? parsed.finalThreshold
            : undefined;
      const window =
        typeof parsed.window === "number"
          ? parsed.window
          : typeof parsed.finalWindow === "number"
            ? parsed.finalWindow
            : undefined;
      return { ok: true, status: res.status, endpoint: url, threshold, window };
    }

    return {
      ok: false,
      status: res.status,
      endpoint: url,
      error:
        typeof parsed.error === "string"
          ? parsed.error
          : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      endpoint: url,
      error: err instanceof Error ? err.message : "request failed",
    };
  }
}

/**
 * Verifies Augment policy endpoints against the deployed CARF API.
 * Does not fabricate thresholds. A 404 for an unknown SHA still proves
 * authentication and routing work.
 */
export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const installationId = String(body.installationId ?? "").trim();
  const owner = String(body.owner ?? "").trim();
  const repo = String(body.repo ?? "").trim();

  if (!installationId || !owner || !repo) {
    return NextResponse.json(
      { error: "Missing required fields: installationId, owner, repo" },
      { status: 400 }
    );
  }

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "Installation not found or unauthorized" }, { status: 404 });
  }

  const connection = await prisma.repoConnection.findUnique({
    where: {
      installationId_owner_repo: {
        installationId,
        owner,
        repo,
      },
    },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "Repository is not linked yet. Complete Augment setup first." },
      { status: 404 }
    );
  }

  if (resolveRepoMode(connection) !== "augment") {
    return NextResponse.json(
      { error: "Repository is configured as standalone, not augment." },
      { status: 400 }
    );
  }

  let apiKey: string;
  try {
    apiKey = await ensureCoreApiKey(prisma, installation);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        policyReady: false,
        authenticated: false,
        message: err instanceof Error ? err.message : "Failed to obtain installation API key",
      },
      { status: 502 }
    );
  }

  const latestCommit = await prisma.commit.findFirst({
    where: { owner, repo, installationId },
    orderBy: { createdAt: "desc" },
    select: { sha: true },
  });
  const probeSha = latestCommit?.sha || "HEAD";
  const coreBase = env.coreApiBaseUrl();

  const augmentUrl = `${coreBase}/v1/augment/threshold?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&sha=${encodeURIComponent(probeSha)}`;
  const thresholdUrl = `${coreBase}/v1/threshold?commit=${encodeURIComponent(probeSha)}`;

  const [augmentProbe, thresholdProbe] = await Promise.all([
    probeThreshold(augmentUrl, apiKey),
    probeThreshold(thresholdUrl, apiKey),
  ]);

  const authRejected =
    augmentProbe.status === 401 ||
    thresholdProbe.status === 401 ||
    augmentProbe.status === 0 ||
    thresholdProbe.status === 0;

  const routed =
    [augmentProbe.status, thresholdProbe.status].some((s) => s === 200 || s === 404);

  const policyReady = !authRejected && routed;
  const successful = augmentProbe.ok || thresholdProbe.ok;

  return NextResponse.json({
    success: policyReady,
    owner,
    repo,
    mode: "augment",
    policyReady,
    authenticated: !authRejected,
    sha: probeSha,
    threshold: successful ? (augmentProbe.threshold ?? thresholdProbe.threshold) : undefined,
    window: successful ? (augmentProbe.window ?? thresholdProbe.window) : undefined,
    probes: {
      augment: {
        status: augmentProbe.status,
        ok: augmentProbe.ok,
        error: augmentProbe.error,
      },
      threshold: {
        status: thresholdProbe.status,
        ok: thresholdProbe.ok,
        error: thresholdProbe.error,
      },
    },
    message: policyReady
      ? successful
        ? "CARF policy endpoints authenticated and returned threshold data."
        : "CARF policy endpoints authenticated. No classified commit is stored yet (404 is expected until a webhook arrives)."
      : "Could not verify CARF policy endpoints. Check CORE_API_BASE_URL and the installation API key.",
  });
}
