-- updated_at otomatis
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ========== categories ==========
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 300),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index categories_name_key on public.categories (lower(name));

-- ========== products ==========
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique check (sku is null or char_length(sku) between 1 and 40),
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 500),
  category_id uuid not null references public.categories(id) on delete restrict,
  price integer not null check (price >= 0),          -- rupiah, bilangan bulat
  image_path text,
  is_active boolean not null default true,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create index products_name_idx on public.products (lower(name));

-- ========== product_variants ==========
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 60),
  price_delta integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id);

-- ========== dining_tables ==========
create type public.table_status as enum ('available','occupied','reserved','maintenance');

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  table_number text not null check (char_length(table_number) between 1 and 20),
  capacity integer not null check (capacity between 1 and 50),
  status public.table_status not null default 'available',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index dining_tables_number_key on public.dining_tables (lower(table_number));

-- ========== app_settings (satu baris) ==========
create table public.app_settings (
  id boolean primary key default true check (id),
  cafe_name text not null default 'CafeFlow',
  address text,
  phone text,
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  receipt_footer text,
  timezone text not null default 'Asia/Jakarta',
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (true);

-- triggers updated_at
create trigger categories_updated before update on public.categories
  for each row execute function public.set_updated_at();
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();
create trigger variants_updated before update on public.product_variants
  for each row execute function public.set_updated_at();
create trigger tables_updated before update on public.dining_tables
  for each row execute function public.set_updated_at();
create trigger settings_updated before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ========== RLS ==========
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.dining_tables enable row level security;
alter table public.app_settings enable row level security;

-- Menu: dibaca owner/manager/cashier, diubah owner/manager. Tidak ada policy DELETE (nonaktifkan, jangan hapus).
create policy "menu read categories" on public.categories for select
  using (public.get_my_role() in ('owner','manager','cashier'));
create policy "menu insert categories" on public.categories for insert
  with check (public.get_my_role() in ('owner','manager'));
create policy "menu update categories" on public.categories for update
  using (public.get_my_role() in ('owner','manager'))
  with check (public.get_my_role() in ('owner','manager'));

create policy "menu read products" on public.products for select
  using (public.get_my_role() in ('owner','manager','cashier'));
create policy "menu insert products" on public.products for insert
  with check (public.get_my_role() in ('owner','manager'));
create policy "menu update products" on public.products for update
  using (public.get_my_role() in ('owner','manager'))
  with check (public.get_my_role() in ('owner','manager'));

create policy "menu read variants" on public.product_variants for select
  using (public.get_my_role() in ('owner','manager','cashier'));
create policy "menu insert variants" on public.product_variants for insert
  with check (public.get_my_role() in ('owner','manager'));
create policy "menu update variants" on public.product_variants for update
  using (public.get_my_role() in ('owner','manager'))
  with check (public.get_my_role() in ('owner','manager'));

-- Meja: semua role aktif boleh baca (KDS perlu nomor meja), owner/manager yang mengubah
create policy "tables read" on public.dining_tables for select
  using (public.get_my_role() is not null);
create policy "tables insert" on public.dining_tables for insert
  with check (public.get_my_role() in ('owner','manager'));
create policy "tables update" on public.dining_tables for update
  using (public.get_my_role() in ('owner','manager'))
  with check (public.get_my_role() in ('owner','manager'));

-- Settings: semua role aktif baca, hanya owner mengubah
create policy "settings read" on public.app_settings for select
  using (public.get_my_role() is not null);
create policy "settings update" on public.app_settings for update
  using (public.get_my_role() = 'owner')
  with check (public.get_my_role() = 'owner');

-- ========== Storage: foto produk ==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "product images insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.get_my_role() in ('owner','manager'));
create policy "product images update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.get_my_role() in ('owner','manager'));
create policy "product images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.get_my_role() in ('owner','manager'));