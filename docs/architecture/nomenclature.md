# CARF Architecture & Terminology Nomenclature

This document defines the canonical terms, layer taxonomy, capability definitions, and naming standards across the CARF (Change-Aware Rollback Framework) dashboard, documentation, and user interfaces.

---

## 1. 3-Layer Architecture Taxonomy

CARF models deployments through a clear three-layer separation of concerns:

```
┌────────────────────────────────────────────────────────┐
│  Layer 1: CARF Core (Policy & Risk Engine)             │
│  - Change analysis (AST, churn vector, risk tier)      │
│  - Dynamic error-rate thresholding & soak windows      │
│  - Policy evaluation & rollback decisions              │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Layer 2: Deployment Integration                       │
│  - Delivery channel & workflow orchestration           │
│  - CI/CD pipelines & rollout controllers               │
│  - GitHub Actions, Argo Rollouts, Generic HTTP CI      │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Layer 3: Runtime Integration                          │
│  - Application execution platform & host process       │
│  - PM2, Docker / Docker Compose, Kubernetes, systemd   │
│  - Or "Policy Only (No Direct Runtime)"                │
└────────────────────────────────────────────────────────┘
```

---

## 2. Canonical Terms & Definitions

| Term | Category | Definition |
| :--- | :--- | :--- |
| **CARF Core** | Layer 1 | The central change analysis, risk scoring, threshold calculation, and policy engine. It analyzes commit diffs, calibrates dynamic error ceilings, and dictates soak observation rules. |
| **Deployment Integration** | Layer 2 | The CI/CD pipeline or rollout controller responsible for building, releasing, or orchestrating the deployment (e.g., GitHub Actions, Argo Rollouts, Generic HTTP CI). |
| **Runtime Integration** | Layer 3 | The execution platform where application processes or containers actually run (e.g., PM2, Docker / Docker Compose, Kubernetes, systemd, or Policy Only). |
| **Deployment Environment** | Environment | The logical deployment stage or lifecycle environment (e.g., `Development`, `Staging`, `Production`). This must never be conflated with the runtime platform, host server, or execution mode. |
| **Deployment Target** | Workload | The specific named workload, process, container, or service managed by a runtime integration (e.g., PM2 process name `api-service`, Docker container `web-app`, Kubernetes deployment `cart-service`). |
| **Health Provider** | Telemetry | The source of application health, telemetry, or error-rate measurements (e.g., HTTP health probe endpoint `/healthz`, Prometheus PromQL metric query). |
| **Runtime Adapter** | Technical | The technical driver, module, or agent client interfacing with a specific runtime platform. Used in technical and code contexts (e.g., `pm2Adapter`, `dockerAdapter`). |
| **Execution Mode** | Engine Mode | The operational mode for CARF Core: `Standalone Execution Mode` (CARF owns soak monitoring and automated rollback) vs. `Augment Execution Mode` (CARF provides policy, external controller owns rollout/rollback). |
| **Capabilities** | Features | Standardized operational capabilities unlocked by a repository's layer configuration: `Risk Policy`, `Runtime Monitoring`, and `Automated Rollback`. |
| **Integration Maturity** | Lifecycle | The stability and readiness tier of an integration: `Active` (Production-ready), `Preview` (Available for evaluation), and `Roadmap` (Planned future release). |

---

## 3. Standard Capability Names

Capabilities must always be presented to users with standardized labels:

1. **Risk Policy** (`capabilities.policy`)
   - *Description*: Dynamic error-rate thresholds and change-aware risk scoring calibrated per commit.
   - *Availability*: Always available via CARF Core across all integrations.

2. **Runtime Monitoring** (`capabilities.monitoring`)
   - *Description*: Active telemetry observation, error-rate evaluation, and soak window tracking.
   - *Availability*: Enabled when a Runtime Integration or telemetry probe is configured.

3. **Automated Rollback** (`capabilities.rollback`)
   - *Description*: Automatic execution or triggering of rollback when dynamic thresholds are breached during the soak window.
   - *Availability*: Enabled with direct Runtime Integrations (PM2, Docker, Kubernetes) or progressive delivery controllers (Argo Rollouts).

---

## 4. Integration Categorization

Integrations in the CARF dashboard and documentation are organized into three standard categories:

### 1. Deployment Integrations
- **GitHub Actions**: Official Actions workflow with pre-deployment risk gating and post-deploy soak reporting.
- **Argo Rollouts**: Cloud-native progressive canary analysis and blue/green automated rollbacks via CARF `AnalysisTemplate`.
- **Generic CI & HTTP API**: Universal webhook integration for GitLab CI, Jenkins, Bitbucket Pipelines, and custom scripts.

### 2. Runtime Integrations
- **PM2**: Direct local process manager runtime with zero host agent required when co-located, supporting instant process reload and rollbacks.
- **Docker / Docker Compose**: Container runtime adapter inspecting container health status, restart counts, and automated image tag rollbacks.
- **Kubernetes**: Native cluster workload management using `kubectl` rollout restart, undo, and pod readiness checks.
- **Linux systemd**: Native Linux service unit management with `systemctl` active status inspection and automated service rollback.
- **Policy Only (No Direct Runtime)**: Zero host agent or runtime footprint; CARF operates strictly as a policy calculation engine.

### 3. Health Providers
- **HTTP Health Probe**: Direct health endpoint polling (`/healthz`, `/health`) to evaluate service availability.
- **Prometheus PromQL**: Authoritative health metric evaluation querying Prometheus or VictoriaMetrics instant query API.


---

## 5. UI Nomenclature vs. Internal Code Identifiers

To ensure backwards compatibility, database schema stability, and uninterrupted API contracts:

- **UI & Documentation**: Use canonical product terms defined in this document (e.g., `Deployment Integration`, `Runtime Integration`, `Deployment Environment`, `Deployment Target`, `Risk Policy`, `Runtime Monitoring`, `Automated Rollback`).
- **Internal Identifiers**: Internal database column names, API request/response contracts, and TypeScript variable identifiers (e.g., `runtimeAdapter`, `deploymentIntegration`, `mode`, `adapterKind`, `pm2`, `docker`, `standalone`, `augment`) remain unchanged.
- **Single Source of Truth**: UI components import and reference standard terms from `dashboard/src/lib/terminology.ts`.
