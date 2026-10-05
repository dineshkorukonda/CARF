"use client";

import { useMemo, useSyncExternalStore } from "react";
import { createDashboardDates } from "./dashboardDates";

const subscribe = () => () => {};
const serverSnapshot = () => null;
let browserTimeZone: string | undefined;
const browserSnapshot = () => browserTimeZone ??= new Intl.DateTimeFormat().resolvedOptions().timeZone;

/** SSR and initial hydration agree; dates appear only once the browser zone is known. */
export function useDashboardDates() {
  const timeZone = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
  return useMemo(() => createDashboardDates(timeZone), [timeZone]);
}
