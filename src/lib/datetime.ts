const fmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export const formatDateTime = (iso: string) => fmt.format(new Date(iso));

// rentang satu hari (Asia/Jakarta, UTC+7 tanpa DST) dari "YYYY-MM-DD"
export function jakartaDayRange(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = new Date(`${date}T00:00:00+07:00`);
  if (Number.isNaN(start.getTime())) return null;
  return {
    from: start.toISOString(),
    to: new Date(start.getTime() + 86_400_000).toISOString(),
  };
}
