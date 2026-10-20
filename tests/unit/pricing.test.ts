import { describe, expect, it } from "vitest";
import { cashChange, computeTotals } from "@/lib/pricing";

const base = { discountType: "none" as const, discountValue: 0, taxPercent: 0 };

describe("computeTotals", () => {
  it("tanpa diskon dan pajak: total = subtotal", () => {
    expect(computeTotals({ ...base, subtotal: 50000 })).toEqual({
      subtotal: 50000,
      discount: 0,
      tax: 0,
      total: 50000,
    });
  });

  it("diskon nominal", () => {
    const t = computeTotals({
      ...base,
      subtotal: 50000,
      discountType: "amount",
      discountValue: 7000,
    });
    expect(t.discount).toBe(7000);
    expect(t.total).toBe(43000);
  });

  it("diskon nominal tidak melebihi subtotal", () => {
    expect(
      computeTotals({
        ...base,
        subtotal: 10000,
        discountType: "amount",
        discountValue: 99999,
      }).total
    ).toBe(0);
  });

  it("diskon persen dibulatkan ke bawah", () => {
    const t = computeTotals({
      ...base,
      subtotal: 33333,
      discountType: "percent",
      discountValue: 10,
    });
    expect(t.discount).toBe(3333);
  });

  it("diskon persen dibatasi 100%", () => {
    expect(
      computeTotals({
        ...base,
        subtotal: 20000,
        discountType: "percent",
        discountValue: 500,
      }).total
    ).toBe(0);
  });

  it("pajak dihitung setelah diskon", () => {
    const t = computeTotals({
      subtotal: 50000,
      discountType: "percent",
      discountValue: 10,
      taxPercent: 11,
    });
    expect(t.discount).toBe(5000);
    expect(t.tax).toBe(4950); // 11% dari 45.000
    expect(t.total).toBe(49950);
  });

  it("pajak dibulatkan half-up seperti SQL round()", () => {
    expect(computeTotals({ ...base, subtotal: 1005, taxPercent: 10 }).tax).toBe(
      101
    ); // 100,5
    expect(computeTotals({ ...base, subtotal: 1004, taxPercent: 10 }).tax).toBe(
      100
    ); // 100,4
  });

  it("persen pajak desimal", () => {
    expect(
      computeTotals({ ...base, subtotal: 20000, taxPercent: 2.5 }).tax
    ).toBe(500);
  });
});

describe("cashChange", () => {
  it("kembalian dan kekurangan", () => {
    expect(cashChange(43000, 50000)).toBe(7000);
    expect(cashChange(43000, 40000)).toBe(-3000);
  });
});
