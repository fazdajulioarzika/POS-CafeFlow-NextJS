import { describe, expect, it } from "vitest";
import { formatQty, toBase } from "@/lib/units";
import { ingredientNeeds, portionsFromStock } from "@/lib/recipe";

describe("toBase (konversi eksplisit)", () => {
  it("kg ke g dan l ke ml", () => {
    expect(toBase(1.5, "g", "kg")).toBe(1500);
    expect(toBase(2, "ml", "l")).toBe(2000);
  });
  it("tidak ada galat floating point", () => {
    expect(toBase(0.3, "g", "kg")).toBe(300);
  });
  it("satuan tidak kompatibel ditolak", () => {
    expect(toBase(1, "pcs", "kg")).toBeNull();
    expect(toBase(1, "ml", "kg")).toBeNull();
  });
});

describe("formatQty", () => {
  it("format Indonesia", () => {
    expect(formatQty(1500, "g")).toBe("1.500 g");
    expect(formatQty(2.5, "ml")).toBe("2,5 ml");
  });
});

describe("ingredientNeeds", () => {
  const recipes = [
    { product_id: "kopi", ingredient_id: "espresso", quantity_required: 18 },
    { product_id: "kopi", ingredient_id: "susu", quantity_required: 150 },
    { product_id: "latte", ingredient_id: "espresso", quantity_required: 18 },
    { product_id: "latte", ingredient_id: "susu", quantity_required: 200 },
  ];

  it("menjumlahkan kebutuhan per bahan dari beberapa produk", () => {
    const n = ingredientNeeds(
      [
        { product_id: "kopi", quantity: 2 },
        { product_id: "latte", quantity: 1 },
      ],
      recipes
    );
    expect(n.get("espresso")).toBe(54);
    expect(n.get("susu")).toBe(500);
  });

  it("produk tanpa resep tidak membutuhkan bahan", () => {
    expect(
      ingredientNeeds([{ product_id: "kentang", quantity: 3 }], recipes).size
    ).toBe(0);
  });
});

describe("portionsFromStock", () => {
  it("dibulatkan ke bawah", () => expect(portionsFromStock(1000, 150)).toBe(6));
  it("kebutuhan 0 tidak membagi nol", () =>
    expect(portionsFromStock(1000, 0)).toBe(0));
});
