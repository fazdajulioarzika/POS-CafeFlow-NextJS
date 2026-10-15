"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Maximize, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setOrderStatus } from "@/app/(dashboard)/orders/actions";
import { orderTypeLabel } from "@/lib/labels";
import { Button } from "@/components/ui/button";

export type Ticket = {
  order_id: string;
  order_number: string;
  order_type: "dine_in" | "takeaway";
  table_number: string | null;
  status: "placed" | "preparing" | "ready";
  items: {
    name: string;
    variant: string | null;
    quantity: number;
    notes: string | null;
  }[];
  created_at: string;
  started_at: string | null;
  ready_at: string | null;
};

type Conn = "connecting" | "online" | "offline";
type Move = "preparing" | "ready" | "served" | "completed";

const SELECT =
  "order_id, order_number, order_type, table_number, status, items, created_at, started_at, ready_at";
const LATE_WARN = 10; // menit
const LATE_ALERT = 20; // menit

const COLUMNS = [
  { status: "placed", title: "Baru" },
  { status: "preparing", title: "Disiapkan" },
  { status: "ready", title: "Siap" },
] as const;

const timeFmt = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export function KdsBoard({
  initial,
  canComplete,
}: {
  initial: Ticket[];
  canComplete: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const boardRef = useRef<HTMLDivElement>(null);

  const [tickets, setTickets] = useState<Ticket[]>(initial);
  const [conn, setConn] = useState<Conn>("connecting");
  const [syncFailed, setSyncFailed] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("kitchen_tickets")
      .select(SELECT)
      .in("status", ["placed", "preparing", "ready"])
      .order("created_at", { ascending: true });

    if (error) {
      setSyncFailed(true);
      return;
    }
    setSyncFailed(false);
    setTickets((data ?? []) as unknown as Ticket[]);
    setLastSync(Date.now());
  }, [supabase]);

  // jam untuk timer tunggu
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  // langganan realtime; sinkron ulang otomatis setiap (re)connect
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel("kds-tickets")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "kitchen_tickets" },
          () => {
            load();
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setConn("online");
            load();
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            setConn("offline");
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  // cadangan: saat tidak terhubung, polling tiap 10 detik
  useEffect(() => {
    if (conn === "online") return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [conn, load]);

  async function move(t: Ticket, to: Move) {
    setBusy(t.order_id);
    setActionError(null);

    // tampilan langsung berubah; server tetap yang menentukan
    setTickets((cur) =>
      to === "completed" || to === "served"
        ? cur.filter((x) => x.order_id !== t.order_id)
        : cur.map((x) => (x.order_id === t.order_id ? { ...x, status: to } : x))
    );

    const res = await setOrderStatus(t.order_id, to);
    if (!res.ok) setActionError(`${t.order_number}: ${res.error}`);
    await load();
    setBusy(null);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else boardRef.current?.requestFullscreen?.();
  }

  const minutesSince = (iso: string | null) =>
    iso && now
      ? Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
      : null;

  return (
    <div
      ref={boardRef}
      className="space-y-4 bg-background [&:fullscreen]:overflow-auto [&:fullscreen]:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Kitchen Display</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span
            role="status"
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium ${
              conn === "online"
                ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                : "border-red-500 bg-red-50 text-red-900"
            }`}
          >
            {conn === "online" ? (
              <Wifi className="h-4 w-4" aria-hidden />
            ) : (
              <WifiOff className="h-4 w-4" aria-hidden />
            )}
            {conn === "online"
              ? "Terhubung"
              : conn === "connecting"
              ? "Menghubungkan..."
              : "Terputus"}
          </span>
          {lastSync && (
            <span className="text-muted-foreground">
              Sinkron {timeFmt.format(new Date(lastSync))}
            </span>
          )}
          <Button type="button" variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-1 h-4 w-4" aria-hidden /> Sinkron ulang
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
          >
            <Maximize className="mr-1 h-4 w-4" aria-hidden /> Layar penuh
          </Button>
        </div>
      </div>

      {(conn === "offline" || syncFailed) && (
        <p
          role="alert"
          className="rounded-lg border border-red-500 bg-red-50 p-3 text-sm text-red-900"
        >
          Koneksi terputus, data mungkin tidak terbaru. Sistem mencoba
          menyambung kembali.
        </p>
      )}
      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-red-500 bg-red-50 p-3 text-sm text-red-900"
        >
          {actionError}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = tickets.filter((t) => t.status === col.status);
          return (
            <section
              key={col.status}
              aria-label={col.title}
              className="space-y-3"
            >
              <h2 className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-lg font-semibold">
                {col.title}
                <span className="rounded-md bg-card px-2 py-0.5 text-sm">
                  {list.length}
                </span>
              </h2>

              {list.map((t) => (
                <TicketCard
                  key={t.order_id}
                  t={t}
                  mins={minutesSince(
                    t.status === "ready" ? t.ready_at : t.created_at
                  )}
                  busy={busy === t.order_id}
                  canComplete={canComplete}
                  onMove={(to) => move(t, to)}
                />
              ))}

              {list.length === 0 && (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Tidak ada pesanan
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TicketCard({
  t,
  mins,
  busy,
  canComplete,
  onMove,
}: {
  t: Ticket;
  mins: number | null;
  busy: boolean;
  canComplete: boolean;
  onMove: (to: Move) => void;
}) {
  const level =
    t.status === "ready" || mins === null
      ? "ok"
      : mins >= LATE_ALERT
      ? "alert"
      : mins >= LATE_WARN
      ? "warn"
      : "ok";

  const border =
    level === "alert"
      ? "border-red-500"
      : level === "warn"
      ? "border-amber-500"
      : "border-border";

  const shortNo = t.order_number.split("-").pop();

  return (
    <article
      aria-label={`Pesanan ${t.order_number}`}
      className={`space-y-3 rounded-xl border-2 bg-card p-4 ${border}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="text-2xl font-bold">#{shortNo}</div>
          <div className="text-xs text-muted-foreground">{t.order_number}</div>
        </div>
        <div className="text-right text-sm">
          <div className="inline-flex items-center gap-1">
            <Clock className="h-4 w-4" aria-hidden />
            {timeFmt.format(new Date(t.created_at))}
          </div>
          {mins !== null && (
            <div className="font-medium">
              {t.status === "ready" ? `Siap ${mins} mnt lalu` : `${mins} mnt`}
            </div>
          )}
          {level === "alert" && (
            <div className="font-bold text-red-700">Terlambat</div>
          )}
          {level === "warn" && (
            <div className="font-bold text-amber-700">Agak lama</div>
          )}
        </div>
      </header>

      <div className="text-lg font-semibold">
        {orderTypeLabel[t.order_type]}
        {t.table_number && ` · Meja ${t.table_number}`}
      </div>

      <ul className="space-y-2 border-t pt-3">
        {t.items.map((it, i) => (
          <li key={i} className="text-base">
            <span className="mr-2 inline-block min-w-9 rounded bg-secondary px-1.5 text-center font-bold">
              {it.quantity}×
            </span>
            <span className="font-medium">{it.name}</span>
            {it.variant && <span> ({it.variant})</span>}
            {it.notes && (
              <div className="ml-11 text-sm font-semibold text-destructive">
                Catatan: {it.notes}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-2 pt-1">
        {t.status === "placed" && (
          <Button
            type="button"
            className="h-14 w-full text-base"
            disabled={busy}
            onClick={() => onMove("preparing")}
          >
            Mulai siapkan
          </Button>
        )}
        {t.status === "preparing" && (
          <Button
            type="button"
            className="h-14 w-full text-base"
            disabled={busy}
            onClick={() => onMove("ready")}
          >
            Tandai siap
          </Button>
        )}
        {t.status === "ready" && (
          <>
            {canComplete ? (
              t.order_type === "dine_in" ? (
                <Button
                  type="button"
                  className="h-14 w-full text-base"
                  disabled={busy}
                  onClick={() => onMove("served")}
                >
                  Sudah diantar ke meja
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-14 w-full text-base"
                  disabled={busy}
                  onClick={() => onMove("completed")}
                >
                  Serahkan ke pelanggan
                </Button>
              )
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Menunggu diantar oleh kasir
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              disabled={busy}
              onClick={() => onMove("preparing")}
            >
              Kembalikan ke Disiapkan
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
