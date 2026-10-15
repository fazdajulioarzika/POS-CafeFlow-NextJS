export const UNITS = ["g", "ml", "pcs"] as const;
export type Unit = (typeof UNITS)[number];

export const unitLabel: Record<Unit, string> = {
  g: "Gram (g)",
  ml: "Mililiter (ml)",
  pcs: "Buah/porsi (pcs)",
};

// konversi eksplisit: satuan input → satuan dasar bahan
export const INPUT_UNITS: Record<Unit, { unit: string; factor: number }[]> = {
  g: [
    { unit: "g", factor: 1 },
    { unit: "kg", factor: 1000 },
  ],
  ml: [
    { unit: "ml", factor: 1 },
    { unit: "l", factor: 1000 },
  ],
  pcs: [{ unit: "pcs", factor: 1 }],
};

export function toBase(
  value: number,
  unit: Unit,
  inputUnit: string
): number | null {
  const u = INPUT_UNITS[unit].find((x) => x.unit === inputUnit);
  return u ? Math.round(value * u.factor * 1000) / 1000 : null;
}

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });
export const formatQty = (n: number, unit: string) => `${nf.format(n)} ${unit}`;
