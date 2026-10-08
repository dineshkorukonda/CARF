import { NextRequest, NextResponse } from "next/server";
import { load } from "js-yaml";
import { z } from "zod";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { mintInstallationToken } from "../../../../lib/installationAccess";
import { getCarfConfigFile, putCarfConfigFile, GitHubContentsError } from "../../../../adapters/github/contentsClient";
import { AnalysisTriggerSchema } from "../../../../lib/carfConfigSchema";
import { applyAnalysisTriggerPatch, carfConfigsEqual, InvalidCarfConfigError } from "../../../../lib/carfConfigWriter";

const targetSchema = z.object({ installationId: z.string().min(1), owner: z.string().min(1), repo: z.string().min(1) });

async function handle(request: NextRequest, save: boolean) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  let input: unknown;
  try {
    input = save ? await request.json() : Object.fromEntries(request.nextUrl.searchParams);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = targetSchema.extend({ analysisTrigger: AnalysisTriggerSchema.optional() }).safeParse(input);
  if (!parsed.success || (save && parsed.data.analysisTrigger === undefined)) return NextResponse.json({ error: "Invalid project or analysis trigger" }, { status: 400 });
  const { installationId, owner, repo } = parsed.data;
  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) return NextResponse.json({ error: "Not authorized for this installation" }, { status: 403 });
  try {
    const token = await mintInstallationToken(installationId);
    const existing = await getCarfConfigFile(owner, repo, token);
    if (save) {
      const trigger = AnalysisTriggerSchema.parse(parsed.data.analysisTrigger);
      const nextYaml = applyAnalysisTriggerPatch(existing?.content ?? null, trigger);
      if (!carfConfigsEqual(existing?.content ?? null, nextYaml)) {
        await putCarfConfigFile(owner, repo, nextYaml, "chore(carf): update automatic analysis trigger", token, existing?.sha);
      }
      return NextResponse.json({ analysisTrigger: trigger });
    }
    const config = existing ? load(existing.content) : {};
    if (!config || typeof config !== "object" || Array.isArray(config)) throw new InvalidCarfConfigError(".carf.yml must be a mapping");
    const trigger = AnalysisTriggerSchema.parse((config as Record<string, unknown>).analysisTrigger ?? "both");
    return NextResponse.json({ analysisTrigger: trigger });
  } catch (error) {
    if (error instanceof InvalidCarfConfigError || error instanceof z.ZodError) return NextResponse.json({ error: "Invalid analysis configuration in .carf.yml" }, { status: 400 });
    if (error instanceof GitHubContentsError) return NextResponse.json({ error: error.message }, { status: error.status >= 400 && error.status < 500 ? error.status : 502 });
    return NextResponse.json({ error: "Could not access .carf.yml. Try again." }, { status: 502 });
  }
}

export const GET = (request: NextRequest) => handle(request, false);
export const POST = (request: NextRequest) => handle(request, true);
