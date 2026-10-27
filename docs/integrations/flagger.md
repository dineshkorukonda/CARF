# Flagger integration (preview)

Flagger controller contracts and a reference Canary are present. Automatic CARF policy-to-controller wiring and a live service-mesh acceptance run remain incomplete. Flagger owns traffic shifting, promotion, and rollback.

Example `.carf.yml` for policy use:

```yaml
mode: augment
deploymentIntegration: flagger
runtimeAdapter: none
```

The reference environments/flagger/canary.yaml uses a native request-success-rate metric. It does not call CARF or consume CARF's dynamic policy. A production bridge must read policy with an installation credential and translate health observations into the controller's supported metric/webhook protocol; POST /v1/report is a CARF JSON verdict API, not a drop-in Flagger webhook protocol adapter.

Acceptance requires a disposable cluster with a supported service mesh, healthy promotion, failure injection, canary abort, primary traffic restoration, and evidence that the dynamic CARF threshold/window was actually applied.
