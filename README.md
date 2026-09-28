# CARF — Change-Aware Rollback Framework

CARF (Change-Aware Rollback Framework) is a decision layer and sidecar protocol for progressive delivery and standalone deployment pipelines that replaces static rollback thresholds with dynamic, risk-calibrated error tolerances computed from commit diffs via deterministic file-path classification and Tree-sitter AST structural complexity parsing.

## Deployment & Adapter Modes

CARF supports two operational modes:
- **Augment Mode**: External tools (CI/CD pipelines, canary orchestrators, shell scripts) query `GET /v1/threshold?commit=$SHA` to obtain the calculated dynamic error budget and soak duration.
- **Standalone Mode**: CARF monitors target health directly during the soak window and autonomously executes rollback on threshold breach. **PM2** is the supported standalone runtime adapter.

## Testing & Deployment Guides

Step-by-step guides for testing CARF are available in:
- **[Testing & Deployment Playbook](docs/TESTING_GUIDE.md)**:
  - **Local vs Hosted Project**: Testing locally on `localhost:3000` vs hosted production at [`https://carf.indevs.in`](https://carf.indevs.in).
  - **Augment Mode**: Consuming dynamic error budgets from CI/CD actions or deployment hooks.
  - **PM2 Process Manager**: Standalone Mode on Node.js servers with release directories (`/var/www/releases/<sha>` and symlink `/var/www/current`) or in-place git deployments, zero-downtime `pm2 reload`, and automated rollback verification.

## Hosted Service & Dashboard

- Hosted Dashboard: [`https://carf.indevs.in`](https://carf.indevs.in)
- Core API: [`https://carf.indevs.in/v1`](https://carf.indevs.in/v1)
- **[Dashboard & GitHub App Setup Guide](dashboard/README.md)**: GitHub App OAuth settings, Auth.js credentials, Neon DB migrations, and installation callbacks.

All rights reserved for CARF Team 2027
