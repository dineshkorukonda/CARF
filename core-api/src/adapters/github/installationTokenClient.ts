export interface InstallationTokenExchangeClient {
  /** Exchanges a signed App JWT for a short-lived installation access token. */
  createInstallationToken(installationId: string, appJwt: string): Promise<{ token: string; expiresAt: string }>;
}

export interface JwtSigner {
  /** Signs a short-lived (~10 min) App JWT from the App ID + private key. */
  sign(appId: string, privateKey: string): string;
}

// Refresh a bit before actual expiry so an in-flight request never gets handed a token
// that expires mid-call.
const REFRESH_BUFFER_MS = 60_000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Exchanges the GitHub App's private key for short-lived, per-installation access
 * tokens — scoped, revocable, and never a bare PAT. Tokens are cached in-memory until
 * near expiry, then refreshed transparently on the next call.
 */
export class InstallationTokenClient {
  private readonly cache = new Map<string, CachedToken>();

  constructor(
    private readonly exchangeClient: InstallationTokenExchangeClient,
    private readonly jwtSigner: JwtSigner,
    private readonly appId: string,
    private readonly privateKey: string
  ) {}

  async getInstallationToken(installationId: string): Promise<string> {
    const cached = this.cache.get(installationId);
    if (cached && cached.expiresAt - REFRESH_BUFFER_MS > Date.now()) {
      return cached.token;
    }

    const appJwt = this.jwtSigner.sign(this.appId, this.privateKey);
    const { token, expiresAt } = await this.exchangeClient.createInstallationToken(installationId, appJwt);
    this.cache.set(installationId, { token, expiresAt: Date.parse(expiresAt) });
    return token;
  }
}
