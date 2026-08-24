/**
 * Minimal structural subset of the global `Response` type that
 * RealInstallationTokenExchangeClient/HttpGithubApiClient actually use. Real global
 * `fetch()` satisfies this structurally (it returns the full `Response`), so the
 * default parameter can just be `fetch` — tests inject a smaller fake without
 * implementing the entire `Response` interface.
 */
export interface MinimalFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<MinimalFetchResponse>;
