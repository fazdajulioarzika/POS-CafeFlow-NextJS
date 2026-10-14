import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "@/components/categories/category-form";
import { ActionButton } from "@/components/layout/action-button";
import { toggleCategory } from "./actions";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, description, sort_order, is_active")
    .order("sort_order")
    .order("name");

  const editing = categories?.find((c) => c.id === edit) ?? null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Kategori</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">
          {editing ? `Edit: ${editing.name}` : "Tambah kategori"}
        </h2>
        <CategoryForm key={editing?.id ?? "new"} category={editing} />
      </section>

      <section className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="p-3">Urutan</th>
              <th className="p-3">Nama</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {categories?.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{c.sort_order}</td>
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.is_active ? "Aktif" : "Nonaktif"}</td>
                <td className="flex justify-end gap-2 p-3">
                  <Link
                    href={`/categories?edit=${c.id}`}
                    className="inline-flex h-8 items-center rounded-md border px-3 text-sm"
                  >
                    Edit
                  </Link>
                  <ActionButton
                    action={toggleCategory.bind(null, c.id, !c.is_active)}
                  >
                    {c.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </ActionButton>
                </td>
              </tr>
            ))}
            {!categories?.length && (
              <tr>
                <td
                  colSpan={4}
                  className="p-6 text-center text-muted-foreground"
                >
                  Belum ada kategori
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
