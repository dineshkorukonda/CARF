# Kubernetes runtime (preview)

Kubernetes library adapter methods and reference manifests/scripts exist. Managed standalone selection is not enabled: AdapterKindSchema accepts only pm2 and docker. Choosing a Kubernetes runtime in metadata does not create a controller or enable automatic rollback.

Example `.carf.yml` for an external pipeline:

```yaml
mode: augment
deploymentIntegration: generic_http
runtimeAdapter: kubernetes
```

Use authenticated CARF policy reads in your pipeline. That pipeline must deploy, observe Pod readiness and restart behavior, run kubectl rollout undo when needed, and verify the recovered image and service traffic. Reference artifacts live in environments/kubernetes. Contract tests do not establish live cluster recovery.
