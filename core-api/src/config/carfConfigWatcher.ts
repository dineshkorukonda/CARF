import { watch as fsWatch, type FSWatcher } from "node:fs";
import { loadCarfConfig } from "./carfConfig.js";
import type { CarfConfig } from "./carfConfigSchema.js";

const DEFAULT_DEBOUNCE_MS = 200;

export interface CarfConfigWatcherOptions {
  /** Directory containing .carf.yml. Defaults to process.cwd(), matching loadCarfConfig(). */
  repoRoot?: string;
  /** Called with the freshly reloaded config on a successful reload. */
  onReload: (config: CarfConfig | undefined) => void;
  /**
   * Called when a reload fails (malformed YAML / schema validation, per
   * InvalidCarfConfigError). The caller must keep serving whatever config it already has —
   * this module never calls onReload with a fallback/default value. Fail closed, matching
   * loadCarfConfig()'s own documented contract for the initial load.
   */
  onError: (error: unknown) => void;
  /** Coalesces rapid successive filesystem events (editors often fire several per save). */
  debounceMs?: number;
  /** Testable seam; defaults to node:fs's real `watch`. */
  watchFn?: typeof fsWatch;
  /** Testable seam; defaults to the real loadCarfConfig. */
  loadFn?: typeof loadCarfConfig;
}

export interface CarfConfigWatcherHandle {
  close(): void;
}

/**
 * Watches `repoRoot` for changes to `.carf.yml` and reloads it on change, so `.carf.yml`
 * edits are picked up without restarting the process (issue #57). Watches the directory
 * rather than the file directly -- editors that save via atomic rename (write to a temp
 * file, then rename over the original) change the file's inode, which a direct file watch
 * can silently stop tracking after the first save.
 */
export function watchCarfConfig(options: CarfConfigWatcherOptions): CarfConfigWatcherHandle {
  const repoRoot = options.repoRoot ?? process.cwd();
  const watchFn = options.watchFn ?? fsWatch;
  const loadFn = options.loadFn ?? loadCarfConfig;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function reload() {
    try {
      const config = loadFn(repoRoot);
      options.onReload(config);
    } catch (error) {
      options.onError(error);
    }
  }

  const watcher: FSWatcher = watchFn(repoRoot, (_eventType, filename) => {
    if (filename !== ".carf.yml") return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(reload, debounceMs);
  });

  return {
    close() {
      if (debounceTimer) clearTimeout(debounceTimer);
      watcher.close();
    },
  };
}
