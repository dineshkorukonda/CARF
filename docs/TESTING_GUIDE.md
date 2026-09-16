# CARF Testing & Deployment Playbook

This guide covers how to test, calibrate, and verify CARF (Change-Aware Rollback Framework) across different project architectures and deployment targets:

1. **Local / Self-Hosted Project vs Hosted CARF Service (`carf.indevs.in`)**
2. **Serverless Architectures (AWS Lambda, Vercel, Cloudflare Workers, SST)**
3. **PM2 Process Manager (Node.js VPS, EC2, Bare-Metal)**
4. **Containerized & Orchestrated Stacks (Docker Compose, Kubernetes, Argo Rollouts)**

---

## 1. Local / Self-Hosted vs Hosted CARF Project

### Option A: Testing on a Local / Self-Hosted Project

You can run CARF's `core-api` locally to test AST diff scoring and threshold calculation without setting up GitHub Webhooks or a public domain.

#### 1. Start `core-api` Locally
```bash
cd core-api
npm install
npm run dev
# Server listening on http://localhost:3000
```

#### 2. Query Commit Thresholds Locally
In local/self-hosted development, requests for commits without an active GitHub App tenant are treated as unauthenticated local queries and return 200 with default dynamic calibrations:
```bash
curl -s "http://localhost:3000/v1/threshold?commit=HEAD" | jq .
```
Response:
```json
{
  "commit": "HEAD",
  "finalThreshold": 0.05,
  "finalWindow": 900,
  "activeTypes": ["code"]
}
```

#### 3. Test Offline Tree-sitter AST & Diff Complexity Scoring
You can simulate classification of modified files and cyclomatic complexity directly:
```bash
curl -X POST "http://localhost:3000/v1/eval/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "files": ["src/index.ts", "prisma/schema.prisma"],
    "cyclomaticDelta": 4
  }' | jq .
```

---

### Option B: Testing on a Hosted Project (`carf.indevs.in`)

In production, CARF runs as a hosted multi-tenant service at **`https://carf.indevs.in`**.

1. **Sign In / Create Account**: Visit [`https://carf.indevs.in/login`](https://carf.indevs.in/login).
2. **Connect GitHub App**: Navigate to **GitHub Integration** (`/dashboard/installations`) and install the CARF GitHub App on your target repositories.
3. **Add `.carf.yml`**: Use the **1-Click Repository Protection Wizard** on the dashboard, or commit `.carf.yml` to your default branch.
4. **Push a Commit**: Push a test commit (or pull request). CARF immediately captures the push webhook, analyzes the Tree-sitter AST diff, and outputs the dynamic risk score on the **Live Rollout Status** page (`/dashboard/status/<installationId>`).

---

## 2. Serverless Projects (AWS Lambda, Vercel, Cloudflare Workers, SST)

### Why Serverless Uses CARF Augment Mode
Serverless environments do not have persistent daemon processes, long-running Docker containers, or PM2 process managers. Runtimes scale to zero and are managed by cloud providers (AWS, Cloudflare, Vercel).

Therefore, CARF operates in **Augment Mode** (`mode: augment`):
- CARF provides an API (`GET /v1/threshold?commit=$SHA`) that dynamically calibrates your error budget and observation window.
- Your CI/CD deployment pipeline (GitHub Actions) queries CARF, shifts canary traffic (e.g. AWS Lambda Alias 10% routing), monitors error rates, and executes an automated rollback if the dynamic budget is breached.

### 1. Configure `.carf.yml` for Serverless
Place `.carf.yml` in your repository root:
```yaml
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5         # 0.5% base error rate tolerance for low-risk changes
  max_tolerance_pct: 4.0          # Up to 4.0% tolerance for cosmetic / test refactors
  observation_window_seconds: 180 # 3-minute canary soak period

rules:
  - name: serverless-handlers
    pattern: "src/handlers/**/*.{ts,js,py}"
    weight: 1.5
  - name: infrastructure-as-code
    pattern: "**/{serverless,sst,template,wrangler}.{yml,yaml,json,toml,ts}"
    weight: 2.0
  - name: tests-and-docs
    pattern: "**/*.{test,spec}.*"
    weight: 0.1
```

### 2. GitHub Actions Serverless CI/CD Pipeline
Create `.github/workflows/deploy.yml`:
```yaml
name: Serverless Deploy & Dynamic Canary Verification
on:
  push:
    branches: [main]

jobs:
  canary-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 1. Fetch CARF dynamic risk threshold
      - name: Fetch CARF Dynamic Threshold
        id: carf
        uses: ./.github/actions/carf-threshold
        with:
          api-url: https://carf.indevs.in
          commit: ${{ github.sha }}
          fail-on-missing: false

      - name: Show Risk Calibration
        run: |
          echo "Dynamic Threshold: ${{ steps.carf.outputs.final-threshold || '0.01' }}"
          echo "Observation Window: ${{ steps.carf.outputs.final-window || '180' }}s"
          echo "Contributing Change Types: ${{ steps.carf.outputs.active-types }}"

      # 2. Deploy Serverless Canary (e.g. AWS Lambda 10% traffic or Vercel preview)
      - name: Deploy Serverless Canary
        run: |
          echo "Deploying ${{ github.sha }} with canary traffic weighting..."
          # AWS Lambda Example:
          # aws lambda update-alias --function-name my-api --name live \
          #   --routing-config '{"AdditionalVersionWeights": {"2": 0.1}}'
          #
          # Vercel Example:
          # vercel deploy --prebuilt

      # 3. Observe Canary Error Telemetry
      - name: Canary Observation Window
        run: |
          WINDOW=${{ steps.carf.outputs.final-window || '180' }}
          THRESHOLD=${{ steps.carf.outputs.final-threshold || '0.01' }}
          echo "Soaking canary for ${WINDOW}s against tolerance ${THRESHOLD}..."
          # Fetch CloudWatch / Datadog / Sentry 5xx error rate:
          # ERROR_RATE=$(curl -s "https://telemetry.internal/error-rate")
          # if (( $(echo "$ERROR_RATE > $THRESHOLD" | bc -l) )); then
          #   echo "CRITICAL: Error rate $ERROR_RATE exceeded dynamic threshold $THRESHOLD"
          #   exit 1
          # fi

      # 4. Instant Rollback on Breach
      - name: Automated Serverless Rollback on Breach
        if: failure()
        run: |
          echo "🚨 CARF threshold breached! Reverting serverless traffic..."
          # AWS Lambda rollback:
          # aws lambda update-alias --function-name my-api --name live --routing-config '{"AdditionalVersionWeights": {}}'
          #
          # Vercel rollback:
          # vercel rollback
```

---

## 3. PM2 Projects (Node.js VPS, EC2, Bare-Metal)

### Why PM2 Uses CARF Standalone Mode
On a Linux server or virtual machine running PM2, CARF runs in **Standalone Mode** (`mode: standalone`, `adapter.kind: pm2`).
CARF uses the immutable release directory pattern (Capistrano-style):
- `/var/www/releases/<sha>` — contains code for that specific commit SHA.
- `/var/www/current` — atomic symlink pointing to the currently active release.
- `pm2 start /var/www/current/dist/index.js --name "api-server"` — PM2 resolves code through the symlink.

### 1. Configure `.carf.yml` for PM2
```yaml
version: "1.0"
mode: standalone
adapter:
  kind: pm2
  target: api-server # Must match PM2 process name in 'pm2 jlist' or ecosystem.config.js
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 2.5
  observation_window_seconds: 120
```

### 2. How CARF Monitors & Rolls Back PM2
1. **Health Polling**: CARF calls `pm2 jlist` every polling interval.
2. **Error Rate**: `errorRate = (processes with status !== "online") / (total processes named target)`.
3. **Atomic Rollback**: If `errorRate > finalThreshold`, CARF executes:
   ```bash
   test -d /var/www/releases/<baseSha> && ln -sfn /var/www/releases/<baseSha> /var/www/current
   pm2 reload <target>
   ```
   Because it uses `pm2 reload` (rather than `restart`), clustered worker processes are cycled one-by-one with **zero downtime**.

### 3. Step-by-Step Hands-On PM2 Failure Simulation
You can test this right now on any machine with PM2 installed:

#### Step A: Create Sample Releases & Start PM2
```bash
# Setup directories
mkdir -p /var/www/releases/sha-stable /var/www/releases/sha-buggy

# Stable v1 app
cat << 'EOF' > /var/www/releases/sha-stable/app.js
console.log("v1 Stable App Running");
setInterval(() => {}, 1000);
EOF

# Symlink to stable release
ln -sfn /var/www/releases/sha-stable /var/www/current

# Start with PM2 in cluster mode
pm2 start /var/www/current/app.js --name "api-server" -i 2
```

#### Step B: Simulate Deploying a Crashing Release
```bash
# Buggy v2 app that crashes on start
cat << 'EOF' > /var/www/releases/sha-buggy/app.js
console.log("v2 Buggy App Starting...");
process.exit(1);
EOF

# Deploy v2
ln -sfn /var/www/releases/sha-buggy /var/www/current
pm2 reload api-server
```

#### Step C: Verify Rollback Execution
When CARF inspects `pm2 jlist`, it detects the process failing and triggers rollback:
```bash
# CARF repoints symlink back to stable SHA:
ln -sfn /var/www/releases/sha-stable /var/www/current
pm2 reload api-server

# Verify current symlink and status
ls -la /var/www/current
pm2 status api-server
```

---

## 4. Containers & Orchestrators (Docker Compose & Kubernetes)

### Docker Compose
- **Pattern**: Zero-downtime container replacement by parameterizing image tags with `IMAGE_TAG`.
- **`.carf.yml`**:
  ```yaml
  version: "1.0"
  mode: standalone
  adapter:
    kind: dockerCompose
    target: web
  ```
- **Rollback Action**: `IMAGE_TAG=<baseSha> docker compose up -d web`

### Kubernetes & Argo Rollouts
- **Pattern**: Progressive canary traffic stepping (e.g. 20% -> 40% -> 80% -> 100%).
- **Argo Rollouts `AnalysisTemplate`**:
  ```yaml
  apiVersion: argoproj.io/v1alpha1
  kind: AnalysisTemplate
  metadata:
    name: carf-dynamic-tolerance
  spec:
    metrics:
    - name: carf-threshold
      web:
        url: "https://carf.indevs.in/v1/threshold?commit={{args.commit}}"
        jsonPath: "{$.finalThreshold}"
  ```
- **Rollback Action**: If metric breaches the dynamic threshold, Argo Rollouts automatically halts and restores previous ReplicaSet.

---

## Summary of Testing Options

| Target Architecture | Mode | Test Seam | Rollback Mechanism |
| :--- | :--- | :--- | :--- |
| **Local Dev** | Standalone / Augment | Local `core-api` (`/v1/threshold`, `/v1/eval/simulate`) | Direct cURL / CLI test |
| **Hosted Cloud** | Standalone / Augment | `https://carf.indevs.in` via GitHub App | Live webhook diff scoring & status UI |
| **Serverless (Lambda/Vercel)** | **Augment** | CI/CD (`.github/actions/carf-threshold` + soak) | Revert alias traffic weight or `vercel rollback` |
| **PM2 (Node.js VPS)** | **Standalone** | `pm2 jlist` health check | Symlink repoint + `pm2 reload <target>` |
| **Docker Compose** | **Standalone** | `docker compose ps --format json` | `IMAGE_TAG=<baseSha> docker compose up -d` |
| **Kubernetes / Argo** | **Augment** | Argo Rollouts AnalysisTemplate | Argo Rollout automatic abort & restore |
