// relasi many-to-one kadang bertipe array di Supabase; ambil satu objeknya
export function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}
