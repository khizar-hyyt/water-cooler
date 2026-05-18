/** HTTP header sent by the app so server midnight/carry uses the household calendar day. */
export const TZ_HEADER = "x-aquashift-tz";

/** Resolve calendar timezone: request header → env → browser → UTC. */
export function resolveTimeZone(request?: Request | null): string {
  if (request) {
    const fromHeader = request.headers.get(TZ_HEADER)?.trim();
    if (fromHeader) return fromHeader;
  }
  const fromEnv = process.env.NEXT_PUBLIC_AQUASHIFT_TZ?.trim();
  if (fromEnv) return fromEnv;
  if (typeof Intl !== "undefined") {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      /* fall through */
    }
  }
  return "UTC";
}

/** YYYY-MM-DD for a specific IANA timezone (e.g. Asia/Karachi). */
export function calendarToday(timeZone?: string): string {
  const tz = timeZone ?? resolveTimeZone();
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}
