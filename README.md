# CARF — Change-Aware Rollback Framework

CARF (Change-Aware Rollback Framework) is a framework-agnostic decision layer and sidecar protocol for progressive delivery pipelines (such as Argo Rollouts, Flagger, and standalone deployment scripts) that replaces static rollback thresholds with dynamic, risk-calibrated error tolerances computed from commit diffs via deterministic file-path classification and Tree-sitter AST structural complexity parsing.

## Testing & Deployment Guides

Comprehensive step-by-step guides for testing CARF across project types are available in:
- **[Testing & Deployment Playbook](docs/TESTING_GUIDE.md)**:
  - **Local vs Hosted Project**: Testing locally on `localhost:3000` vs hosted production at [`https://carf.indevs.in`](https://carf.indevs.in).
  - **Serverless Projects**: AWS Lambda, Vercel, Cloudflare Workers, and SST in Augment Mode via CI/CD canary traffic shifting and automated rollback.
  - **PM2 Process Manager**: Standalone Mode on Node.js VPS/EC2 with Capistrano release directories (`/var/www/releases/<sha>` and symlink `/var/www/current`), zero-downtime `pm2 reload`, and local failure simulation.
  - **Containers & Orchestrators**: Docker Compose zero-downtime tag swapping and Kubernetes Argo Rollouts `AnalysisTemplate` integration.

## Hosted Service & Dashboard

- Hosted Dashboard: [`https://carf.indevs.in`](https://carf.indevs.in)
- Core API: [`https://carf.indevs.in/v1`](https://carf.indevs.in/v1)
- **[Dashboard & GitHub App Setup Guide](dashboard/README.md)**: GitHub App OAuth settings, Auth.js credentials, Neon DB migrations, and installation callbacks.

All rights reserved for CARF Team 2027
