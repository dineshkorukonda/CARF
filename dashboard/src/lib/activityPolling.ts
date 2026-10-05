/** Requests are scheduled after completion, so slow responses cannot overlap. */
export function startActivityPolling<T>(options: {
  fetchSnapshot(signal: AbortSignal): Promise<T>;
  onSnapshot(snapshot: T): void;
  onError(): void;
  delay(snapshot: T): number;
  isVisible(): boolean;
}) {
  let stopped = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  const refresh = async () => {
    clearTimeout(timer);
    if (stopped || inFlight || !options.isVisible()) return;
    inFlight = true;
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 15_000);
    let delay = 10_000;
    try {
      const snapshot = await options.fetchSnapshot(controller.signal);
      if (!stopped) {
        options.onSnapshot(snapshot);
        delay = options.delay(snapshot);
      }
    } catch {
      if (!stopped) options.onError();
    } finally {
      clearTimeout(timeout);
      inFlight = false;
      if (!stopped && options.isVisible()) timer = setTimeout(() => void refresh(), delay);
    }
  };
  void refresh();
  return {
    refresh: () => void refresh(),
    stop: () => { stopped = true; clearTimeout(timer); controller?.abort(); },
  };
}
