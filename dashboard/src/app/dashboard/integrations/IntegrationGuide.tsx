import { BookOpen, ExternalLink } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

const GUIDES = {
  github_actions: {
    purpose: "Use your existing GitHub Actions deployment with a PM2 process on your server.",
    steps: ["Connect the repository through Add Repository and select GitHub Actions as the deployment integration.", "Keep CARF_API_KEY in Actions secrets. Configure the workflow to deploy on your PM2 host, using SSH or a runner on that host.", "Set the process name and health URL, then configure a rollback workflow that restores a known good revision."],
    verify: "Run a staging deployment. Confirm the workflow reaches CARF, the PM2 process is healthy, and the release appears in the repository activity view.",
    troubleshoot: "If PM2 cannot find the process, check the runner host and OS user. For a 401 response, check the Actions secret and installation associated with the repository.",
  },
  argo_rollouts: {
    purpose: "Keep Argo in charge of traffic and recovery while CARF provides commit risk information.",
    steps: ["Confirm the Rollouts controller and CRDs are installed in your cluster.", "Configure an AnalysisTemplate and reference it from your Rollout with the release commit SHA.", "Make the CARF API reachable from the controller and supply credentials through a Kubernetes Secret."],
    verify: "Deploy a staging canary and inspect the AnalysisRun result before increasing traffic. Rehearse an analysis failure and confirm Argo aborts the rollout.",
    troubleshoot: "For an analysis error, inspect AnalysisRun events, API connectivity, and response mapping. Use the git commit SHA rather than a pod template hash for commit lookup.",
  },
  flagger: {
    purpose: "Use CARF alongside Flagger's canary analysis and traffic management.",
    steps: ["Install Flagger with the provider used by your cluster and confirm its Canary resource targets the right Deployment.", "Configure a webhook endpoint compatible with Flagger's request and response contract; adapt the payload if your CARF endpoint expects a different schema.", "Set analysis intervals and failure limits, and give the controller access to the endpoint and credentials."],
    verify: "Run a staging canary and inspect Flagger events. Confirm successful analysis advances traffic and failed analysis returns traffic to the primary workload.",
    troubleshoot: "For rejected webhooks, compare the actual Flagger payload with the endpoint contract. For timeouts, check controller network access and webhook timeout settings.",
  },
  generic_http: {
    purpose: "Add CARF risk checks to GitLab CI, Jenkins, or another pipeline that can make HTTP requests.",
    steps: ["Store the CARF credential in your CI secret store and identify the owner, repository, and release SHA.", "Request the release policy from CARF and make the pipeline stop when the request or risk gate fails.", "Deploy, send measured health reports during the soak window, and connect a failure decision to your pipeline's recovery step."],
    verify: "Test a staging release with a real commit. Confirm authentication, policy lookup, health reporting, and the pipeline failure path separately.",
    troubleshoot: "For missing commit data, check the repository and SHA. If a gate fails but deployment continues, check the script exit code and pipeline failure handling.",
  },
  kubernetes: {
    purpose: "Monitor a Kubernetes Deployment and restore its previous revision through the runtime adapter.",
    steps: ["Select the cluster context, namespace, and Deployment you intend to protect.", "Give the agent identity the required Deployment access and confirm a previous revision is retained.", "Configure workload health checks and complete repository setup before starting monitoring."],
    verify: "Check Deployment readiness in staging, then rehearse recovery and confirm the previous revision becomes ready.",
    troubleshoot: "For forbidden errors, inspect the agent's RBAC permissions. If rollback has no revision to restore, check rollout history and revisionHistoryLimit.",
  },
  docker: {
    purpose: "Monitor a Compose service and recover using a known good container image.",
    steps: ["Identify the Compose file and service name on the Docker host.", "Add a container healthcheck and use immutable image tags so the previous release can be restored.", "Configure agent access to Docker and retain the previous image and release configuration."],
    verify: "Check the service health with docker compose ps in staging. Rehearse recovery and confirm the restored image and health status.",
    troubleshoot: "If health is missing, check that the service defines a healthcheck. If recovery cannot pull an image, check the saved tag and registry credentials.",
  },
  systemd: {
    purpose: "Monitor a Linux service and restart it after restoring the previous release.",
    steps: ["Identify the systemd unit and the application's working directory.", "Give the agent user permission to inspect and restart that specific service.", "Configure the health endpoint and retain a known good revision, including its build artifacts."],
    verify: "Confirm systemctl reports an active service and the health endpoint responds. Rehearse restoring a previous release in staging and inspect the service journal.",
    troubleshoot: "If a restart fails, inspect journalctl for the unit and check the service user, working directory, and executable path.",
  },
  prometheus: {
    purpose: "Use Prometheus metrics as health signals alongside your deployment integration or runtime adapter.",
    steps: ["Make the metrics endpoint reachable from the component that evaluates health.", "Choose a query scoped to your service and check its result units: an error ratio differs from latency in seconds.", "Configure the query and threshold, and connect it to the integration that owns deployment recovery."],
    verify: "Evaluate the query with staging traffic. Confirm it returns a finite value for the intended service and responds when you introduce a controlled failure.",
    troubleshoot: "For empty or NaN results, check labels, scrape status, and the traffic denominator. Prometheus supplies telemetry; your deployment controller or runtime adapter performs recovery.",
  },
} as const;

export function IntegrationGuide({ id, docsLink }: { id: keyof typeof GUIDES; docsLink: string }) {
  const guide = GUIDES[id];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BookOpen className="size-4 text-primary" />Setup guide</CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">{guide.purpose}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-foreground">
          {guide.steps.map((step) => <li key={step} className="pl-1">{step}</li>)}
        </ol>
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Verify the connection</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{guide.verify}</p>
        </div>
        <details className="rounded-md border border-border p-3 text-sm">
          <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-ring">Troubleshooting</summary>
          <p className="mt-2 leading-relaxed text-muted-foreground">{guide.troubleshoot}</p>
        </details>
        <Button nativeButton={false} variant="outline" size="sm" render={<a href={`https://github.com/dineshkorukonda/CARF/blob/main${docsLink}`} target="_blank" rel="noreferrer" />}>
          Read full integration guide<ExternalLink className="size-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
