# systemd runtime (roadmap)

A systemd library adapter has unit tests. Managed standalone configuration, remote execution, reference environment, and real unit lifecycle acceptance are not implemented.

Example `.carf.yml` for an external service deployment pipeline:

```yaml
mode: augment
deploymentIntegration: generic_http
runtimeAdapter: systemd
```

The external pipeline may read CARF policy and report health observations. It must own release restoration, systemctl restart, and recovery verification. Do not configure adapter.kind=systemd; the standalone schema rejects it. The host verification agent does not add systemd deployment support.
