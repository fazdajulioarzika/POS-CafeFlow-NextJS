import Link from "next/link";
import { PRESETS, qs, type DateRange } from "@/lib/range";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const chip = (on: boolean) =>
  `inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${
    on ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"
  }`;

export function RangeFilter({
  basePath,
  range,
  extra = {},
}: {
  basePath: string;
  range: DateRange;
  extra?: Record<string, string | undefined>;
}) {
  return (
    <div className="space-y-3 print:hidden">
      <nav aria-label="Periode" className="flex flex-wrap gap-2">
        {PRESETS.filter((p) => p.key !== "custom").map((p) => (
          <Link
            key={p.key}
            href={`${basePath}?${qs({ ...extra, range: p.key })}`}
            aria-current={range.preset === p.key ? "page" : undefined}
            className={chip(range.preset === p.key)}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <form
        method="get"
        action={basePath}
        className="flex flex-wrap items-end gap-2"
      >
        {Object.entries(extra).map(([k, v]) =>
          v ? <input key={k} type="hidden" name={k} value={v} /> : null
        )}
        <input type="hidden" name="range" value="custom" />
        <label className="space-y-1 text-sm">
          <span className="block">Dari</span>
          <Input
            type="date"
            name="from"
            defaultValue={range.from}
            required
            className="w-auto"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block">Sampai</span>
          <Input
            type="date"
            name="to"
            defaultValue={range.to}
            required
            className="w-auto"
          />
        </label>
        <Button type="submit" variant="outline">
          Terapkan
        </Button>
      </form>
    </div>
  );
}
