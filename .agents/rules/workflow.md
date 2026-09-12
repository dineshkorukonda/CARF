# Git & Pull Request Workflow Rules

## 1. Branching & Lifecycle
- **Never push directly to main.**
- All development, fixes, and documentation MUST be done on isolated branches (e.g. `feat/...`, `fix/...`, `docs/...`) and merged into `main` via Pull Request.
- **Check PR & CI status first:** Before making subsequent commits or proposing further changes, verify the current PR state (`gh pr view <number>` or `gh pr status`). Never push commits to an already closed/merged PR. If a PR is closed or merged, start a new branch from latest `main`.

## 2. Commits & Naming
- All commit messages must strictly follow **Semantic Commit Conventions** (e.g. `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- All Pull Request titles must also be semantic (e.g. `feat(dashboard): ...`, `fix(core-api): ...`).

## 3. Pull Request Standards & Format
- **Assignee:** All pull requests MUST be assigned to `@dineshkorukonda`.
- **Labels:** Ensure appropriate labels are applied to every PR (e.g. `area:dashboard`, `area:adapters`, `backend`, `bug`, `enhancement`, `documentation`, `priority:*`, etc.).
- **PR Description Format:** Every PR description MUST follow this structured format:
  1. **Summary of Changes**: Concise overview of what was implemented or resolved.
  2. **Reasoning & Context**: Technical rationale, root cause analysis, or design decisions.
  3. **Verification & Steps to Test**: Exact, reproducible step-by-step instructions to test and verify the changes (commands, URLs, expectations).
  4. **CI & Automated Checks Status**: Confirm local tests, lint, and typechecks pass before requesting review.

## 4. CI & Verification Gates
- Always run local unit tests, typechecks, and linting (`npm test`, `npm run typecheck`, `npm run lint`) prior to opening or updating a PR.
- Monitor automated GitHub Actions checks (`gh pr checks <number>`) and ensure all CI pipelines pass.

