type Timestamp = Date | string | null | undefined;

/** One explicit zone for labels and calendar buckets; null is the SSR placeholder. */
export function createDashboardDates(timeZone: string | null) {
  const formatter = (options: Intl.DateTimeFormatOptions) => timeZone
    ? new Intl.DateTimeFormat("en-GB", { ...options, timeZone }) : null;
  const date = formatter({ day: "2-digit", month: "short", year: "numeric" });
  const time = formatter({ hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short" });
  const dateTime = formatter({ day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short" });
  const calendar = formatter({ year: "numeric", month: "2-digit", day: "2-digit" });
  const parse = (value: Timestamp) => {
    if (!value) return null;
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
  };
  const format = (value: Timestamp, target: Intl.DateTimeFormat | null) => {
    const parsed = parse(value);
    return parsed && target ? target.format(parsed) : "—";
  };
  const dayKey = (value: Timestamp): string => {
    const parsed = parse(value);
    if (!parsed || !calendar) return "";
    const parts = calendar.formatToParts(parsed);
    return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)!.value).join("-");
  };
  return {
    timeZone,
    date: (value: Timestamp) => format(value, date),
    time: (value: Timestamp) => format(value, time),
    dateTime: (value: Timestamp) => format(value, dateTime),
    dayKey,
    recentDays: (count: number, now = new Date()): string[] => {
      const today = dayKey(now);
      if (!today) return [];
      // Calendar arithmetic, independent of DST and the machine's local zone.
      const anchor = new Date(`${today}T00:00:00Z`);
      return Array.from({ length: count }, (_, index) => {
        const day = new Date(anchor);
        day.setUTCDate(day.getUTCDate() - (count - 1 - index));
        return day.toISOString().slice(0, 10);
      });
    },
  };
}
