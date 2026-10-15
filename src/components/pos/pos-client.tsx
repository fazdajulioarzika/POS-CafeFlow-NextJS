"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkout } from "@/app/(dashboard)/pos/actions";
import { formatRupiah } from "@/lib/money";
import { productImageUrl } from "@/lib/storage";
import { uuid } from "@/lib/uuid";
import { statusLabel } from "@/components/tables/table-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  price: number;
  image_path: string | null;
  category_id: string;
  is_available: boolean;
};
type Variant = {
  id: string;
  product_id: string;
  name: string;
  price_delta: number;
};
type DiningTable = {
  id: string;
  table_number: string;
  capacity: number;
  status: string;
};
type Line = {
  key: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  notes: string;
};
type Method = "cash" | "qris" | "bank_transfer" | "other";

const selectCls =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";
const chipCls = (on: boolean) =>
  `rounded-full border px-3 py-1 text-sm ${
    on ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"
  }`;

export function PosClient({
  categories,
  products,
  variants,
  tables,
  taxPercent,
  canDiscount,
}: {
  categories: Category[];
  products: Product[];
  variants: Variant[];
  tables: DiningTable[];
  taxPercent: number;
  canDiscount: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [key, setKey] = useState(() => uuid()); // idempotency key per percobaan checkout
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [picker, setPicker] = useState<Product | null>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [tableId, setTableId] = useState("");
  const [discountType, setDiscountType] = useState<
    "none" | "amount" | "percent"
  >("none");
  const [discountValue, setDiscountValue] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const variantsByProduct = useMemo(() => {
    const m = new Map<string, Variant[]>();
    variants.forEach((v) =>
      m.set(v.product_id, [...(m.get(v.product_id) ?? []), v])
    );
    return m;
  }, [variants]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (cat === "all" || p.category_id === cat) &&
        (!s || p.name.toLowerCase().includes(s))
    );
  }, [products, cat, q]);

  // ---- hitungan di bawah hanya estimasi tampilan; server menghitung ulang ----
  const subtotal = cart.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const discNum = Math.max(0, Number(discountValue || 0));
  const discount =
    discountType === "amount"
      ? Math.min(discNum, subtotal)
      : discountType === "percent"
      ? Math.floor((subtotal * Math.min(discNum, 100)) / 100)
      : 0;
  const tax = Math.round(((subtotal - discount) * taxPercent) / 100);
  const total = subtotal - discount + tax;
  const tenderedNum = Number(tendered || 0);
  const change = tenderedNum - total;
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);

  function addLine(p: Product, v: Variant | null) {
    const k = `${p.id}:${v?.id ?? ""}`;
    setCart((prev) => {
      const i = prev.findIndex((l) => l.key === k);
      if (i >= 0) {
        return prev.map((l, j) =>
          j === i ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l
        );
      }
      return [
        ...prev,
        {
          key: k,
          product_id: p.id,
          variant_id: v?.id ?? null,
          name: p.name,
          variant_name: v?.name ?? null,
          unit_price: p.price + (v?.price_delta ?? 0),
          quantity: 1,
          notes: "",
        },
      ];
    });
    setPicker(null);
  }

  function onPick(p: Product) {
    if (!p.is_available) return;
    if ((variantsByProduct.get(p.id) ?? []).length > 0) setPicker(p);
    else addLine(p, null);
  }

  const changeQty = (k: string, d: number) =>
    setCart((prev) =>
      prev
        .map((l) =>
          l.key === k ? { ...l, quantity: Math.min(99, l.quantity + d) } : l
        )
        .filter((l) => l.quantity > 0)
    );
  const setNotes = (k: string, notes: string) =>
    setCart((prev) => prev.map((l) => (l.key === k ? { ...l, notes } : l)));

  function submit() {
    setError(null);
    if (!cart.length) return setError("Keranjang kosong");
    if (orderType === "dine_in" && !tableId)
      return setError("Pilih meja untuk dine-in");
    if (method === "cash" && tenderedNum < total)
      return setError("Uang diterima kurang dari total");

    start(async () => {
      const res = await checkout({
        idempotency_key: key,
        order_type: orderType,
        table_id: orderType === "dine_in" ? tableId || null : null,
        items: cart.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id,
          quantity: l.quantity,
          notes: l.notes.trim() || null,
        })),
        discount_type: canDiscount ? discountType : "none",
        discount_value: canDiscount && discountType !== "none" ? discNum : 0,
        payment_method: method,
        tendered: method === "cash" ? tenderedNum : null,
        reference: method === "cash" ? null : reference.trim() || null,
      });

      if (res.ok) {
        setCart([]);
        setKey(uuid());
        setCartOpen(false);
        router.push(`/receipt/${res.orderId}`);
      } else {
        setError(res.error);
      }
    });
  }

  // label dibungkus <label> (bukan id) karena panel dirender di desktop dan overlay mobile
  const cartPanel = (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pesanan</h2>

      {cart.length === 0 && (
        <p className="text-sm text-muted-foreground">Belum ada item.</p>
      )}

      <ul className="space-y-3">
        {cart.map((l) => (
          <li key={l.key} className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex justify-between gap-2 text-sm">
              <div>
                <div className="font-medium">{l.name}</div>
                {l.variant_name && (
                  <div className="text-xs text-muted-foreground">
                    {l.variant_name}
                  </div>
                )}
              </div>
              <div className="shrink-0">
                {formatRupiah(l.unit_price * l.quantity)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Kurangi ${l.name}`}
                onClick={() => changeQty(l.key, -1)}
              >
                −
              </Button>
              <span className="w-6 text-center text-sm" aria-live="polite">
                {l.quantity}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Tambah ${l.name}`}
                onClick={() => changeQty(l.key, 1)}
              >
                +
              </Button>
              <Input
                value={l.notes}
                onChange={(e) => setNotes(l.key, e.target.value)}
                placeholder="Catatan"
                maxLength={200}
                aria-label={`Catatan ${l.name}`}
                className="h-8 flex-1 text-xs"
              />
            </div>
          </li>
        ))}
      </ul>

      <div
        className="grid grid-cols-2 gap-2"
        role="group"
        aria-label="Tipe layanan"
      >
        {(["dine_in", "takeaway"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={orderType === t}
            onClick={() => setOrderType(t)}
            className={`rounded-md border px-3 py-2 text-sm ${
              orderType === t ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            {t === "dine_in" ? "Dine-in" : "Takeaway"}
          </button>
        ))}
      </div>

      {orderType === "dine_in" && (
        <label className="block space-y-1 text-sm">
          <span>Meja</span>
          <select
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            className={selectCls}
          >
            <option value="">Pilih meja</option>
            {tables.map((t) => (
              <option
                key={t.id}
                value={t.id}
                disabled={t.status !== "available"}
              >
                {t.table_number} · {t.capacity} kursi · {statusLabel[t.status]}
              </option>
            ))}
          </select>
        </label>
      )}

      {canDiscount && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1 text-sm">
            <span>Diskon</span>
            <select
              value={discountType}
              onChange={(e) =>
                setDiscountType(e.target.value as "none" | "amount" | "percent")
              }
              className={selectCls}
            >
              <option value="none">Tidak ada</option>
              <option value="amount">Nominal (Rp)</option>
              <option value="percent">Persen (%)</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Nilai</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={discountValue}
              disabled={discountType === "none"}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </label>
        </div>
      )}

      <label className="block space-y-1 text-sm">
        <span>Metode pembayaran</span>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as Method)}
          className={selectCls}
        >
          <option value="cash">Tunai</option>
          <option value="qris">QRIS (manual)</option>
          <option value="bank_transfer">Transfer bank</option>
          <option value="other">Lainnya</option>
        </select>
      </label>

      {method === "cash" ? (
        <div className="space-y-2">
          <label className="block space-y-1 text-sm">
            <span>Uang diterima (Rp)</span>
            <Input
              type="text"
              inputMode="numeric"
              min={0}
              step={1}
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTendered(String(total))}
            >
              Uang pas
            </Button>
            {[50000, 100000].map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTendered(String(n))}
              >
                {formatRupiah(n)}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <label className="block space-y-1 text-sm">
          <span>Referensi (opsional)</span>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={100}
          />
        </label>
      )}

      <dl className="space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{formatRupiah(subtotal)}</dd>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <dt>Diskon</dt>
            <dd>-{formatRupiah(discount)}</dd>
          </div>
        )}
        {taxPercent > 0 && (
          <div className="flex justify-between">
            <dt>Pajak ({taxPercent}%)</dt>
            <dd>{formatRupiah(tax)}</dd>
          </div>
        )}
        <div className="flex justify-between text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatRupiah(total)}</dd>
        </div>
        {method === "cash" && tendered !== "" && (
          <div className="flex justify-between">
            <dt>{change >= 0 ? "Kembalian" : "Kurang"}</dt>
            <dd>{formatRupiah(Math.abs(change))}</dd>
          </div>
        )}
      </dl>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="button"
        className="h-11 w-full text-base"
        disabled={pending || cart.length === 0}
        onClick={submit}
      >
        {pending ? "Memproses..." : `Bayar ${formatRupiah(total)}`}
      </Button>
    </div>
  );

  return (
    <div className="grid gap-6 pb-20 lg:grid-cols-[1fr_380px] lg:pb-0">
      {/* ===== katalog ===== */}
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">POS</h1>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari produk"
          aria-label="Cari produk"
          className="max-w-sm"
        />

        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Kategori"
        >
          <button
            type="button"
            aria-pressed={cat === "all"}
            onClick={() => setCat("all")}
            className={chipCls(cat === "all")}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={cat === c.id}
              onClick={() => setCat(c.id)}
              className={chipCls(cat === c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => {
            const img = productImageUrl(p.image_path);
            return (
              <button
                key={p.id}
                type="button"
                disabled={!p.is_available}
                onClick={() => onPick(p)}
                className="space-y-2 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt=""
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-lg bg-secondary" />
                )}
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-sm text-muted-foreground">
                  {p.is_available ? formatRupiah(p.price) : "Habis"}
                </div>
              </button>
            );
          })}
          {visible.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              Tidak ada produk.
            </p>
          )}
        </div>
      </section>

      {/* ===== keranjang desktop ===== */}
      <aside className="hidden lg:sticky lg:top-6 lg:px-2 lg:block lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cartPanel}
      </aside>

      {/* ===== keranjang mobile/tablet kecil ===== */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card p-3 lg:hidden">
        <Button
          type="button"
          className="h-11 w-full"
          onClick={() => setCartOpen(true)}
        >
          Keranjang ({itemCount}) · {formatRupiah(total)}
        </Button>
      </div>
      {cartOpen && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-background p-4 lg:hidden">
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCartOpen(false)}
            >
              Tutup
            </Button>
          </div>
          {cartPanel}
        </div>
      )}

      {/* ===== pilih varian ===== */}
      {picker && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Pilih varian ${picker.name}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setPicker(null)}
        >
          <div
            className="w-full max-w-sm space-y-3 rounded-xl bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold">{picker.name}</h2>
            {(variantsByProduct.get(picker.id) ?? []).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => addLine(picker, v)}
                className="flex w-full justify-between rounded-lg border px-3 py-3 text-sm hover:bg-secondary"
              >
                <span>{v.name}</span>
                <span>{formatRupiah(picker.price + v.price_delta)}</span>
              </button>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setPicker(null)}
            >
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
