import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/datetime";
import { one } from "@/lib/relations";
import { auditActionLabel, auditGroups } from "@/lib/labels";
import { qs, rangeParams, rangeText, resolveRange } from "@/lib/range";
import { RangeFilter } from "@/components/layout/range-filter";

const PAGE_SIZE = 30;
type SP = {
  group?: string;
  range?: string;
  from?: string;
  to?: string;
  page?: string;
};

const chip = (on: boolean) =>
  `inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${
    on ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"
  }`;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const range = resolveRange(sp, "7d");
  const group = auditGroups.find((g) => g.key === sp.group)?.key;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const rp = rangeParams(range);

  const supabase = await createClient();
  let q = supabase
    .from("audit_logs")
    .select(
      "id, action, entity_type, entity_id, metadata, created_at, actor:profiles(full_name)",
      { count: "exact" }
    )
    .gte("created_at", range.fromIso)
    .lt("created_at", range.toIso)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (group) q = q.like("action", `${group}.%`);
  const { data: logs, count } = await q;

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (p: number) =>
    `/audit-logs?${qs({ group, ...rp, page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Periode: {rangeText(range)} · hanya dapat dibaca, tidak dapat diubah
          atau dihapus.
        </p>
      </div>

      <RangeFilter basePath="/audit-logs" range={range} extra={{ group }} />

      <nav aria-label="Jenis aksi" className="flex flex-wrap gap-2">
        <Link href={`/audit-logs?${qs({ ...rp })}`} className={chip(!group)}>
          Semua
        </Link>
        {auditGroups.map((g) => (
          <Link
            key={g.key}
            href={`/audit-logs?${qs({ group: g.key, ...rp })}`}
            className={chip(group === g.key)}
          >
            {g.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="p-3">Waktu</th>
              <th className="p-3">Pelaku</th>
              <th className="p-3">Aksi</th>
              <th className="p-3">Objek</th>
              <th className="p-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map((l) => (
              <tr key={l.id} className="border-t align-top">
                <td className="p-3 whitespace-nowrap">
                  {formatDateTime(l.created_at)}
                </td>
                <td className="p-3">
                  {one(l.actor)?.full_name || (
                    <span className="text-muted-foreground">
                      Sistem / tidak diketahui
                    </span>
                  )}
                </td>
                <td className="p-3 font-medium">
                  {auditActionLabel[l.action] ?? l.action}
                </td>
                <td className="p-3">
                  {l.entity_type}
                  {l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ""}
                </td>
                <td className="p-3">
                  <details>
                    <summary className="cursor-pointer text-xs underline">
                      Lihat
                    </summary>
                    <pre className="mt-1 max-w-md whitespace-pre-wrap break-all text-xs">
                      {JSON.stringify(l.metadata, null, 2)}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
            {!logs?.length && (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-muted-foreground"
                >
                  Tidak ada catatan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span>
          Halaman {page} dari {pages} · {count ?? 0} catatan
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={href(page - 1)}
              className="inline-flex h-8 items-center rounded-md border px-3"
            >
              Sebelumnya
            </Link>
          )}
          {page < pages && (
            <Link
              href={href(page + 1)}
              className="inline-flex h-8 items-center rounded-md border px-3"
            >
              Berikutnya
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
