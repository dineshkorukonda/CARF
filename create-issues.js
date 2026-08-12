const https = require('https');

const issues = [
  // Phase 1
  {
    title: 'Phase 1: feat(classifier): implement AST parsing and diff analysis',
    body: 'Currently, CARF classifies changes based purely on file paths. We need to implement AST inspection to quantify code changes.\n- Integrate an AST parser (e.g., Babel for JS/TS).\n- Fetch unified Git diffs for the deployment commit.\n- Analyze the diff and AST to calculate a "change complexity score".\n- Update the classification logic to use this score for determining sensitivity.'
  },
  {
    title: 'Phase 1: feat(collector): integrate Prometheus and Datadog telemetry',
    body: 'The current polling mechanism needs to integrate with real-world observability tools.\n- Create a `PrometheusAdapter` to query PromQL for error rates and latency.\n- Create a `DatadogAdapter` to query Datadog monitors/metrics.\n- Standardize the telemetry stream into CARF\'s decision engine.'
  },
  {
    title: 'Phase 1: feat(engine): dynamic error variance calculation based on change vectors',
    body: 'Instead of static thresholds, the decision engine should dynamically adjust the acceptable error ceiling.\n- Combine the AST complexity score and the component type (infra, config, code, dependency).\n- Synthesize an adaptive observation window and threshold (e.g., high complexity config = tighter window, lower error tolerance).'
  },
  // Phase 2
  {
    title: 'Phase 2: feat(executor): implement Kubernetes rollback adapter',
    body: 'Extend the rollback execution layer to support Kubernetes.\n- Create a `KubernetesAdapter` in `src/executor/`.\n- Implement zero-downtime rollback using the Kubernetes API (equivalent to `kubectl rollout undo`).\n- Ensure rollback execution triggers in < 500ms.'
  },
  {
    title: 'Phase 2: feat(executor): implement GitOps rollback adapter',
    body: 'Support declarative GitOps workflows.\n- Create a `GitOpsAdapter`.\n- Implement logic to automatically generate a `git revert` commit for the offending release.\n- Push the revert commit to the target repository to let ArgoCD/Flux naturally sync the rollback.'
  },
  {
    title: 'Phase 2: feat(api): custom vector sensitivity rules configuration',
    body: 'Allow users to define their own vector sensitivities.\n- Add API endpoints to CRUD sensitivity vectors for a specific project.\n- Update the Decision Engine to fetch and respect user-defined vectors instead of hardcoded defaults.'
  }
];

const token = process.env.GITHUB_TOKEN || process.argv[2];
const repo = 'dineshkorukonda/CARF';

if (!token) {
  console.error('Error: Please provide a GitHub token via GITHUB_TOKEN environment variable or as a CLI argument.');
  console.log('Usage: node create-issues.js <YOUR_GITHUB_TOKEN>');
  process.exit(1);
}

console.log('Creating issues in ' + repo + '...');

async function createIssue(issue) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      title: issue.title,
      body: issue.body
    });

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${repo}/issues`,
      method: 'POST',
      headers: {
        'User-Agent': 'Node.js',
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) {
          const parsed = JSON.parse(body);
          console.log(`\u2714 Created: ${issue.title} (${parsed.html_url})`);
          resolve();
        } else {
          console.error(`\u2716 Failed to create: ${issue.title}`);
          console.error(`Status: ${res.statusCode} ${res.statusMessage}`);
          console.error(body);
          reject(new Error('Failed to create issue'));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function run() {
  for (const issue of issues) {
    try {
      await createIssue(issue);
      // Wait a moment to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(err);
    }
  }
}

run();
