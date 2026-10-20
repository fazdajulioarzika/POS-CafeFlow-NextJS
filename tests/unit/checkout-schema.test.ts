import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/lib/validations/checkout";

const ID = "3b241101-e2bb-4255-8caf-4136c566a962";
const valid = {
  idempotency_key: ID,
  order_type: "takeaway",
  table_id: null,
  items: [{ product_id: ID, variant_id: null, quantity: 1, notes: null }],
  discount_type: "none",
  discount_value: 0,
  payment_method: "cash",
  tendered: 50000,
  reference: null,
};
const withChange = (patch: object) =>
  checkoutSchema.safeParse({ ...valid, ...patch });

describe("checkoutSchema", () => {
  it("payload valid diterima", () =>
    expect(checkoutSchema.safeParse(valid).success).toBe(true));

  it("dine-in wajib punya meja", () => {
    const r = withChange({ order_type: "dine_in", table_id: null });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toContain("table_id");
  });

  it("keranjang kosong ditolak", () =>
    expect(withChange({ items: [] }).success).toBe(false));

  it("jumlah di luar 1..99 ditolak", () => {
    for (const quantity of [0, 100, -1, 1.5]) {
      expect(
        withChange({ items: [{ ...valid.items[0], quantity }] }).success
      ).toBe(false);
    }
  });

  it("diskon negatif atau desimal ditolak", () => {
    expect(
      withChange({ discount_type: "amount", discount_value: -1 }).success
    ).toBe(false);
    expect(
      withChange({ discount_type: "amount", discount_value: 10.5 }).success
    ).toBe(false);
  });

  it("uang diterima harus bilangan bulat", () =>
    expect(withChange({ tendered: 50000.5 }).success).toBe(false));

  it("catatan lebih dari 200 karakter ditolak", () => {
    expect(
      withChange({ items: [{ ...valid.items[0], notes: "x".repeat(201) }] })
        .success
    ).toBe(false);
  });

  it("metode pembayaran tidak dikenal ditolak", () =>
    expect(withChange({ payment_method: "bitcoin" }).success).toBe(false));
});
