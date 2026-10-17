const jakartaFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
}); // YYYY-MM-DD
const dayFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export const todayJakarta = () => jakartaFmt.format(new Date());

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const isDate = (s?: string) =>
  !!s &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export const formatDay = (d: string) =>
  dayFmt.format(new Date(`${d}T00:00:00Z`));
export const rangeText = (r: { from: string; to: string }) =>
  r.from === r.to
    ? formatDay(r.from)
    : `${formatDay(r.from)} – ${formatDay(r.to)}`;

export const PRESETS = [
  { key: "today", label: "Hari ini" },
  { key: "yesterday", label: "Kemarin" },
  { key: "7d", label: "7 hari terakhir" },
  { key: "month", label: "Bulan ini" },
  { key: "custom", label: "Rentang khusus" },
] as const;
export type PresetKey = (typeof PRESETS)[number]["key"];

export type DateRange = {
  preset: PresetKey;
  from: string; // YYYY-MM-DD (inklusif)
  to: string; // YYYY-MM-DD (inklusif)
  fromIso: string;
  toIso: string; // eksklusif
};

export function resolveRange(
  sp: { range?: string; from?: string; to?: string },
  fallback: PresetKey = "today"
): DateRange {
  const today = todayJakarta();
  let preset: PresetKey =
    PRESETS.find((p) => p.key === sp.range)?.key ?? fallback;
  let from = today;
  let to = today;

  if (preset === "custom") {
    if (isDate(sp.from) && isDate(sp.to)) {
      from = sp.from as string;
      to = sp.to as string;
    } else {
      preset = fallback === "custom" ? "today" : fallback;
    }
  }
  if (preset === "yesterday") {
    from = addDays(today, -1);
    to = from;
  } else if (preset === "7d") {
    from = addDays(today, -6);
  } else if (preset === "month") {
    from = `${today.slice(0, 8)}01`;
  }

  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }
  if (addDays(from, 366) < to) from = addDays(to, -366); // batasi maksimal ~1 tahun

  return {
    preset,
    from,
    to,
    fromIso: new Date(`${from}T00:00:00+07:00`).toISOString(),
    toIso: new Date(`${addDays(to, 1)}T00:00:00+07:00`).toISOString(),
  };
}

export function qs(params: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  return p.toString();
}

// parameter periode untuk dipertahankan di link (tab, pagination, ekspor)
export const rangeParams = (r: DateRange) => ({
  range: r.preset,
  from: r.preset === "custom" ? r.from : undefined,
  to: r.preset === "custom" ? r.to : undefined,
});
