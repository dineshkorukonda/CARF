# GitHub App registration

CARF authenticates as a GitHub App, not a personal access token — installation tokens
are scoped to one repo/org, short-lived (~1 hour), and revocable independently of any
individual's credentials, which fits a multi-tenant deployment.

## Manifest / permissions

When registering the App (github.com/settings/apps/new, or via an App manifest flow),
configure:

**Repository permissions:**
| Permission | Access | Why |
|---|---|---|
| Contents | Read-only | Fetch before/after blob content for changed files (diff acquisition, #17) |
| Metadata | Read-only | Required baseline for any GitHub App |
| Pull requests | Read-only | Read PR base/head SHAs for `pull_request` events |

**Subscribe to events:**
- `push`
- `pull_request`

**Webhook:**
- URL: `https://<your-core-api-host>/webhooks/github`
- Secret: generate a random value, set as `GITHUB_WEBHOOK_SECRET`

## Credentials

After registration, set in `.env` (see `.env.example`):
- `GITHUB_APP_ID` — the App's numeric ID
- `GITHUB_APP_PRIVATE_KEY` — the App's generated private key (PEM), used to sign a
  short-lived App JWT that's exchanged for a per-installation access token
  (`src/adapters/github/installationTokenClient.ts`)
- `GITHUB_WEBHOOK_SECRET` — used to verify `X-Hub-Signature-256` on incoming webhooks
  (`src/adapters/github/webhookSignature.ts`)

No PAT is used anywhere in this module.

## Status

The signature verification, payload parsing, webhook route, and installation-token
caching/refresh logic in this directory are implemented and unit-tested against
interface-based mocks (`GitHubApiClient`, `InstallationTokenExchangeClient`,
`JwtSigner`). The concrete production implementations of those interfaces (real GitHub
REST calls, real RS256 JWT signing) are a deliberately separate follow-up — swapping
them in requires no changes to the tested logic above.
