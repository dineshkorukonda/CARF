/**
 * Minimal structural subset of the global `Response` type this package's GitHub clients
 * use. Real global `fetch()` satisfies this structurally, so the default parameter can
 * just be `fetch` -- tests inject a smaller fake. Mirrors
 * core-api/src/adapters/github/fetchTypes.ts's convention (duplicated, not shared --
 * this package has its own package.json/lockfile, no workspace linking the two).
 */
export interface MinimalFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<MinimalFetchResponse>;
