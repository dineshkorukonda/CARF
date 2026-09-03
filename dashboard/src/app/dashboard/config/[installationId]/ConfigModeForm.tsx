"use client";

import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "../../../../components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Button } from "../../../../components/ui/button";
import { LIVE_ADAPTER_KINDS, type AdapterKind } from "../../../../lib/carfConfigSchema";
import { Info } from "lucide-react";

interface ConfigModeFormProps {
  installationId: string;
  owner: string;
  repo: string;
  defaultMode: "standalone" | "augment";
  defaultAdapterKind: AdapterKind;
  defaultAdapterTarget: string;
}

const ADAPTER_DETAILS: Record<AdapterKind, { placeholder: string; label: string; description: string }> = {
  kubernetes: {
    label: "Kubernetes Deployment Name",
    placeholder: "e.g. api-deployment",
    description: "CARF executes 'kubectl rollout undo deployment/<target>' when the dynamic error threshold is breached.",
  },
  dockerCompose: {
    label: "Docker Compose Service Name",
    placeholder: "e.g. web",
    description: "CARF redeploys via 'IMAGE_TAG=<baseSha> docker compose up -d <target>'. Ensure your compose file uses ${IMAGE_TAG}.",
  },
  pm2: {
    label: "PM2 Process Name",
    placeholder: "e.g. api-server",
    description: "CARF repoints /var/www/current to /var/www/releases/<baseSha> and executes 'pm2 reload <target>'.",
  },
  dockerSwarm: {
    label: "Docker Swarm Service Name",
    placeholder: "e.g. prod_web",
    description: "CARF executes 'docker service update --rollback <target>'. Swarm tracks previous task specs natively.",
  },
  gitops: {
    label: "Argo CD Application Name",
    placeholder: "e.g. production-app",
    description: "CARF rolls back the specified Argo CD application to the base revision via the Argo CD API.",
  },
};

export function ConfigModeForm({
  installationId,
  owner,
  repo,
  defaultMode,
  defaultAdapterKind,
  defaultAdapterTarget,
}: ConfigModeFormProps) {
  const [mode, setMode] = useState<"standalone" | "augment">(defaultMode);
  const [adapterKind, setAdapterKind] = useState<AdapterKind>(defaultAdapterKind);

  const currentAdapter = ADAPTER_DETAILS[adapterKind] ?? ADAPTER_DETAILS.kubernetes;

  return (
    <form action="/api/config/save" method="POST" className="mt-4 flex flex-col gap-6">
      <input type="hidden" name="installationId" value={installationId} />
      <input type="hidden" name="owner" value={owner} />
      <input type="hidden" name="repo" value={repo} />

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-1 text-sm font-medium">Operating Mode</legend>
        <RadioGroup
          name="mode"
          value={mode}
          onValueChange={(val) => setMode(val as "standalone" | "augment")}
          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
        >
          <Label className="flex items-center gap-2 font-normal cursor-pointer">
            <RadioGroupItem value="augment" />
            <span>Augment Mode</span>
          </Label>
          <Label className="flex items-center gap-2 font-normal cursor-pointer">
            <RadioGroupItem value="standalone" />
            <span>Standalone Mode</span>
          </Label>
        </RadioGroup>
      </fieldset>

      {mode === "augment" ? (
        <div className="rounded-sm border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Info className="size-3.5 text-primary shrink-0" />
            <span>Augment Mode active</span>
          </div>
          <p>
            CARF dynamically scores each commit diff and computes custom risk thresholds and observation windows.
            Rollback monitoring and execution are handled by your external orchestrator (Argo Rollouts, Flagger, or CI/CD script) querying <code className="rounded bg-muted px-1 py-0.5">GET /v1/threshold</code> with your installation key.
          </p>
        </div>
      ) : (
        <fieldset className="flex flex-col gap-3 rounded-sm border border-border p-4 bg-card">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Standalone Rollback Engine
          </legend>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Adapter Type</Label>
            <Select
              name="adapterKind"
              value={adapterKind}
              onValueChange={(val) => setAdapterKind(val as AdapterKind)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIVE_ADAPTER_KINDS.map((kind: AdapterKind) => (
                  <SelectItem key={kind} value={kind}>
                    {kind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">{currentAdapter.label}</Label>
            <Input
              type="text"
              name="adapterTarget"
              placeholder={currentAdapter.placeholder}
              defaultValue={defaultAdapterTarget}
              required={mode === "standalone"}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {currentAdapter.description}
            </p>
          </div>
        </fieldset>
      )}

      <Button type="submit" className="self-start">
        Save Configuration
      </Button>
    </form>
  );
}
