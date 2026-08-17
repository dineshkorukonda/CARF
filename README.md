# CARF — Change-Aware Rollback Framework

CARF (Change-Aware Rollback Framework) is a framework-agnostic decision layer and sidecar protocol for progressive delivery pipelines (such as Argo Rollouts, Flagger, and standalone deployment scripts) that replaces static rollback thresholds with dynamic, risk-calibrated error tolerances computed from commit diffs via deterministic file-path classification and Tree-sitter AST structural complexity parsing.
