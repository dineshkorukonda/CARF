import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchCarfConfig } from "../../src/config/carfConfigWatcher.js";
import { InvalidCarfConfigError } from "../../src/config/carfConfig.js";

// Minimal fake for fs.watch: an EventEmitter with the { close() } shape fs.FSWatcher
// exposes, plus a helper to fire a change event the way the real watcher would.
function fakeWatchFn() {
  const emitter = new EventEmitter() as EventEmitter & { close: ReturnType<typeof vi.fn> };
  emitter.close = vi.fn();
  const watchFn = vi.fn().mockImplementation((_path: string, listener: (eventType: string, filename: string | null) => void) => {
    emitter.on("change", listener);
    return emitter;
  });
  return { watchFn, emitter };
}

describe("watchCarfConfig", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reloads and calls onReload when .carf.yml changes", async () => {
    const { watchFn, emitter } = fakeWatchFn();
    const newConfig = { mode: "standalone" as const };
    const loadFn = vi.fn().mockReturnValue(newConfig);
    const onReload = vi.fn();
    const onError = vi.fn();

    watchCarfConfig({ repoRoot: "/repo", watchFn, loadFn, onReload, onError });
    emitter.emit("change", "change", ".carf.yml");
    await vi.runAllTimersAsync();

    expect(loadFn).toHaveBeenCalledWith("/repo");
    expect(onReload).toHaveBeenCalledWith(newConfig);
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores changes to files other than .carf.yml", async () => {
    const { watchFn, emitter } = fakeWatchFn();
    const loadFn = vi.fn();
    const onReload = vi.fn();
    const onError = vi.fn();

    watchCarfConfig({ repoRoot: "/repo", watchFn, loadFn, onReload, onError });
    emitter.emit("change", "change", "unrelated.txt");
    await vi.runAllTimersAsync();

    expect(loadFn).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
  });

  it("keeps the last-known-good config and reports the error on a malformed reload (fail closed)", async () => {
    const { watchFn, emitter } = fakeWatchFn();
    const error = new InvalidCarfConfigError("/repo/.carf.yml", "bad schema");
    const loadFn = vi.fn().mockImplementation(() => {
      throw error;
    });
    const onReload = vi.fn();
    const onError = vi.fn();

    watchCarfConfig({ repoRoot: "/repo", watchFn, loadFn, onReload, onError });
    emitter.emit("change", "change", ".carf.yml");
    await vi.runAllTimersAsync();

    expect(onReload).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("debounces rapid successive change events into a single reload", async () => {
    const { watchFn, emitter } = fakeWatchFn();
    const loadFn = vi.fn().mockReturnValue(undefined);
    const onReload = vi.fn();
    const onError = vi.fn();

    watchCarfConfig({ repoRoot: "/repo", watchFn, loadFn, onReload, onError, debounceMs: 200 });
    emitter.emit("change", "change", ".carf.yml");
    emitter.emit("change", "change", ".carf.yml");
    emitter.emit("change", "change", ".carf.yml");
    await vi.runAllTimersAsync();

    expect(loadFn).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("close() stops the underlying watcher and cancels a pending debounced reload", async () => {
    const { watchFn, emitter } = fakeWatchFn();
    const loadFn = vi.fn().mockReturnValue(undefined);
    const onReload = vi.fn();
    const onError = vi.fn();

    const handle = watchCarfConfig({ repoRoot: "/repo", watchFn, loadFn, onReload, onError, debounceMs: 200 });
    emitter.emit("change", "change", ".carf.yml");
    handle.close();
    await vi.runAllTimersAsync();

    expect(loadFn).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
    expect(emitter.close).toHaveBeenCalledTimes(1);
  });
});
