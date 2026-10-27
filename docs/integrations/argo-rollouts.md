# Argo Rollouts integration (preview)

Argo Rollouts remains a preview integration. Controller adapter contracts and reference manifests exist; the production standalone config does not accept an Argo runtime adapter. Argo owns rollout execution and recovery.

Example `.carf.yml` for policy use:

```yaml
mode: augment
deploymentIntegration: argo_rollouts
runtimeAdapter: none
```

Fetch CARF policy through authenticated HTTP in the delivery pipeline and use the threshold/window in your controller analysis. Do not assume environments/argo-rollouts/analysis-template.yaml performs that wiring: it probes the sample application's HTTP health endpoint directly and does not read CARF policy.

The reference environment includes controller installation, healthy/broken rollout manifests, and abort scripts. Validate controller readiness, authenticated policy lookup, a healthy promotion, a failed analysis, abort, previous revision restoration, and traffic recovery on a disposable cluster before treating this integration as live-tested.
