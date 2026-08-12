$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')

$issues = @(
    @{
        title = "Phase 1: feat(classifier): implement AST parsing and diff analysis"
        body = "Currently, CARF classifies changes based purely on file paths. We need to implement AST inspection to quantify code changes.`n- Integrate an AST parser (e.g., Babel for JS/TS).`n- Fetch unified Git diffs for the deployment commit.`n- Analyze the diff and AST to calculate a `"change complexity score`".`n- Update the classification logic to use this score for determining sensitivity."
    },
    @{
        title = "Phase 1: feat(collector): integrate Prometheus and Datadog telemetry"
        body = "The current polling mechanism needs to integrate with real-world observability tools.`n- Create a ``PrometheusAdapter`` to query PromQL for error rates and latency.`n- Create a ``DatadogAdapter`` to query Datadog monitors/metrics.`n- Standardize the telemetry stream into CARF's decision engine."
    },
    @{
        title = "Phase 1: feat(engine): dynamic error variance calculation based on change vectors"
        body = "Instead of static thresholds, the decision engine should dynamically adjust the acceptable error ceiling.`n- Combine the AST complexity score and the component type (infra, config, code, dependency).`n- Synthesize an adaptive observation window and threshold (e.g., high complexity config = tighter window, lower error tolerance)."
    },
    @{
        title = "Phase 2: feat(executor): implement Kubernetes rollback adapter"
        body = "Extend the rollback execution layer to support Kubernetes.`n- Create a ``KubernetesAdapter`` in ``src/executor/``.`n- Implement zero-downtime rollback using the Kubernetes API (equivalent to ``kubectl rollout undo``).`n- Ensure rollback execution triggers in < 500ms."
    },
    @{
        title = "Phase 2: feat(executor): implement GitOps rollback adapter"
        body = "Support declarative GitOps workflows.`n- Create a ``GitOpsAdapter``.`n- Implement logic to automatically generate a ``git revert`` commit for the offending release.`n- Push the revert commit to the target repository to let ArgoCD/Flux naturally sync the rollback."
    },
    @{
        title = "Phase 2: feat(api): custom vector sensitivity rules configuration"
        body = "Allow users to define their own vector sensitivities.`n- Add API endpoints to CRUD sensitivity vectors for a specific project.`n- Update the Decision Engine to fetch and respect user-defined vectors instead of hardcoded defaults."
    }
)

foreach ($issue in $issues) {
    Write-Host "Creating issue: $($issue.title)"
    gh issue create --title $issue.title --body $issue.body
    Start-Sleep -Seconds 2
}

Write-Host "All issues created successfully."
