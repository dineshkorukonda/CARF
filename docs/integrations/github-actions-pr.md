# Pull request workflows

CARF classifies PRs on `opened`, `synchronize`, `reopened`, `ready_for_review`, and
`edited` events. Enable the **Pull request** webhook subscription in your GitHub App
settings, grant **Pull requests: Read-only** and **Contents: Read-only**, and install
the app on the repository. Existing apps already subscribed require no new subscription.

In project setup, choose **Analyze changes from**: **Pushed commits**, **Pull requests**,
or **Commits and pull requests**. Change this later under project **Settings → Automatic
analysis**. The choice is saved to `.carf.yml`:

```yaml
analysisTrigger: pull_requests # commits | pull_requests | both
```

Projects without this field keep both event types enabled. The selection filters
automatic webhooks only; explicit history refresh and CI/on-demand commit-policy
requests remain available. PR events read configuration from the base branch, so a
PR cannot change its own analysis selection before merge. In a PR-only project,
push-triggered webhook deployment is also skipped; use the CI-managed deployment
path after merge for live rollout observation and rollback.

Classification covers the aggregate PR diff, using its common ancestor for before
content. The policy is stored under the PR head SHA and can be read from
`GET /v1/threshold?commit=<head-sha>` with an installation API key. PR webhooks only
classify; deployments and live rollback monitoring continue through the post-merge
push/CI path.

Add `CARF_API_URL` as a repository variable and `CARF_API_KEY` as a repository secret:

```yaml
name: CARF PR Policy
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review, edited]

permissions:
  contents: read

jobs:
  policy:
    # Fork PR workflows cannot access the installation secret.
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: dineshkorukonda/CARF/.github/actions/carf-threshold@main
        id: carf
        with:
          api-url: ${{ vars.CARF_API_URL }}
          api-key: ${{ secrets.CARF_API_KEY }}
      - name: Show policy
        env:
          THRESHOLD: ${{ steps.carf.outputs.final-threshold }}
          WINDOW: ${{ steps.carf.outputs.final-window }}
          TYPES: ${{ steps.carf.outputs.active-types }}
        run: |
          printf 'Threshold: %s\nWindow: %ss\nTypes: %s\n' "$THRESHOLD" "$WINDOW" "$TYPES"
```

Pin the action to a reviewed release SHA for production use. The action defaults to
`github.event.pull_request.head.sha` on PRs and `github.sha` on pushes; its `commit`
input overrides either. GitHub's PR `github.sha` normally identifies a synthetic
merge commit rather than the classified head ([GitHub documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)).

The action retries a missing policy for up to 25 seconds to allow webhook processing
to finish. Documentation-only changes may have no classification signal and no
policy. Set `fail-on-missing: "false"` to allow a missing result; otherwise the step
fails. A successful policy lookup confirms classification, not runtime health or
a risk acceptance decision. Use the outputs in your own pre-merge policy checks.

Storage remains SHA-based: commit and PR classification share the existing policy
record for a repository/head SHA. There is no separate PR history or per-base policy
version in this integration. Fork PRs are skipped by the example because GitHub does
not provide repository secrets to their workflows; do not switch to
`pull_request_target` and execute untrusted PR code to work around that restriction.
