# CARF — Change-Aware Rollback Framework

CARF dynamically computes risk-calibrated error-rate thresholds and soak durations from commit diffs, replacing one-size-fits-all static rollback thresholds.

Pull request updates also classify the full PR diff before merge. See the [PR workflow guide](docs/integrations/github-actions-pr.md) to fetch the policy in GitHub Actions using the PR head SHA.

## How It Works

1. **Commit Analysis**: Evaluates diffs using deterministic file-path classification and Tree-sitter AST structural complexity parsing.
2. **Dynamic Thresholds**: Produces risk-adjusted error-rate thresholds and soak times for each deployment.
3. **Deployment Modes**:
   - **Augment Mode**: External deployment pipelines query `GET /v1/threshold?commit=<sha>` to gate rollouts.
   - **Standalone Mode**: Monitors health directly during soak windows and executes automated rollbacks (supported runtime: PM2).

## Repository Structure

- [`core-api`](core-api/) — Fastify backend service, threshold calculation engine, and webhook handler.
- [`dashboard`](dashboard/) — Next.js web console for tracking commits and deployment pipelines.
- [`agent`](agent/) — Colocated PM2 monitoring agent daemon.

## Hosted Service

- **Dashboard**: [carf.indevs.in](https://carf.indevs.in)
- **Core API**: [carf.indevs.in/v1](https://carf.indevs.in/v1)
- **Setup Guide**: See [Dashboard Setup](dashboard/README.md) for GitHub App OAuth, Auth.js credentials, and database migrations.

---
© 2027 CARF Team
