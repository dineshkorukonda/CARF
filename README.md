# CARF — Change-Aware Rollback Framework

[![Version](https://img.shields.io/badge/version-1.2.0-cyan.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Research Paper](https://img.shields.io/badge/research_paper-accepted_ICSE-emerald.svg)](https://drive.google.com/file/d/1ysqh2ieadw9oUXr5TnuYMI3ajxRIQz60/view?usp=sharing)
[![Status](https://img.shields.io/badge/status-operational-brightgreen.svg)](#)

**CARF (Change-Aware Rollback Framework)** is a hosted DevOps service and open-source engine that automatically decides when to roll back a deployment based on what type of change caused it (**code**, **runtime config**, **dependency**, or **infrastructure**), instead of treating every failure with flat error rate thresholds.

---

## ⚡ Why CARF?

Traditional deployment verification tools rely on static, unconditioned failure metrics (e.g., *"trigger rollback if global HTTP 5xx error rate exceeds 2.0%"*). This approach suffers from two critical flaws:

1. **False Positives on Code Bugs**: A minor user-space bug causing 2.5% errors on a non-critical endpoint triggers an unnecessary automated rollback, disrupting deployment momentum when the fix could easily be hotfixed forward.
2. **Silent Disasters on Infrastructure Shifts**: An ingress TLS or database connection pool configuration change that breaks 0.3% of traffic is a catastrophic outage, yet static thresholds fail to revert it until damage spreads.

CARF inspects **git diffs and AST syntax trees** *before* post-deploy telemetry evaluation, assigning custom observation windows and sensitivity ceilings per change vector.

---

## 📐 Sensitivity Matrix

| Change Vector | AST / Path Targets | Sensitivity | Window ($W_v$) | Error Threshold ($\Theta_v$) | Automated Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Infrastructure** | `k8s/*.yaml`, `helm/*`, `Terraform`, `Dockerfile` | **Strictest** | 60 seconds | **0.20%** | Immediate Rollback |
| **Dependency** | `package-lock.json`, `Cargo.lock`, `go.sum` | **High** | 3 minutes | **1.00%** | Rollback on Breach |
| **Runtime Config** | `.env`, `config/*.json`, `feature-flags.yml` | **Medium** | 5 minutes | **2.50%** | Rollback with Alert |
| **Application Code**| `.ts`, `.go`, `.py`, `.rs`, `.java` | **Low** | 15 minutes | **5.00%** | Alert & Hotfix |

---

## 🔬 Peer-Reviewed Research Paper

CARF's theoretical foundation and empirical validation across 14,000 production deployments are published in our conference research paper:

📄 **[Change-Aware Deployment Verification and Contextual Rollback Synthesis (PDF)](https://drive.google.com/file/d/1ysqh2ieadw9oUXr5TnuYMI3ajxRIQz60/view?usp=sharing)**

### BibTeX Citation
```bibtex
@inproceedings{carf2026deployment,
  title={Change-Aware Deployment Verification and Contextual Rollback Synthesis},
  author={CARF Research Group},
  booktitle={IEEE/ACM International Conference on Software Engineering (ICSE)},
  year={2026},
  url={https://drive.google.com/file/d/1ysqh2ieadw9oUXr5TnuYMI3ajxRIQz60/view?usp=sharing}
}
```

---

## ⚙️ How It Works (4-Step Pipeline)

1. **Classify**: Parses unified `git diff` & manifest ASTs to tag commits into `code`, `config`, `dependency`, or `infrastructure`.
2. **Monitor**: Streams real-time HTTP 5xx error rates, latency $p99$, and panic metrics during the vector-specific window.
3. **Decide**: Evaluates telemetry against the mathematical decision metric:
   $$D(t) = \frac{1}{W_v} \int_{t_0}^{t_0 + W_v} \big( E_{\text{http5xx}}(t) + \lambda \cdot L_{\text{p99}}(t) \big) \, dt > \Theta_v$$
4. **Execute**: Calls PM2, Docker, Kubernetes, or GitOps webhooks to restore the last known stable version in **< 500ms**.

---

## 🛠️ Configuration Example (`.carf.yml`)

Add a single `.carf.yml` file to your repository root:

```yaml
version: "1.0"
project_id: checkout-service-v2

sensitivity_rules:
  infrastructure:
    window: 60s
    error_threshold: 0.2%
    action: immediate_rollback
  config:
    window: 5m
    error_threshold: 2.5%
    action: rollback_with_alert
  dependency:
    window: 3m
    error_threshold: 1.0%
    action: rollback_on_confidence
  code:
    window: 15m
    error_threshold: 5.0%
    action: alert_on_threshold

target:
  provider: kubernetes
  namespace: production
  deployment: checkout-api
```

### GitHub Actions Integration

```yaml
- name: CARF Change-Aware Evaluation
  uses: carf-devops/evaluate-action@v1.2
  with:
    api-key: ${{ secrets.CARF_API_KEY }}
    commit-sha: ${{ github.sha }}
```

---

## 🎯 Supported Runtime Controllers

- **Kubernetes**: `kubectl rollout undo deployment`
- **PM2**: `pm2 reload --update-env`
- **GitOps (ArgoCD / Flux)**: Automated Git revert commit dispatch
- **Docker Engine / Swarm**: Container image digest rollback
- **Helm**: Release revision rollback
- **AWS ECS**: Task definition revision revert

---

## 🚀 Web Application & Landing Page (`my-app`)

The landing page, documentation portal, and live interactive framework simulator are located in `my-app/` built with Next.js & Tailwind CSS.

### Running Locally

```bash
cd my-app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the landing page, live simulator, and documentation portal (`/docs`).

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
