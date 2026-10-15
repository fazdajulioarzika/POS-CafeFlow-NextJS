create type public.stock_unit as enum ('g','ml','pcs');
create type public.movement_type as enum ('initial','purchase','sale','waste','adjustment');

-- ========== ingredients ==========
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  unit public.stock_unit not null,
  stock_quantity numeric(14,3) not null default 0 check (stock_quantity >= 0),
  minimum_stock numeric(14,3) not null default 0 check (minimum_stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ingredients_name_key on public.ingredients (lower(name));

-- ========== product_recipes ==========
create table public.product_recipes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity_required numeric(14,3) not null check (quantity_required > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, ingredient_id)
);
create index product_recipes_ingredient_idx on public.product_recipes (ingredient_id);

-- ========== inventory_movements ==========
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  movement_type public.movement_type not null,
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  stock_after numeric(14,3) not null check (stock_after >= 0),
  reason text check (char_length(reason) <= 200),
  order_id uuid references public.orders(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index inventory_movements_ing_idx on public.inventory_movements (ingredient_id, created_at desc);
-- satu pesanan hanya boleh mengurangi satu bahan satu kali
create unique index inventory_movements_sale_once
  on public.inventory_movements (order_id, ingredient_id) where movement_type = 'sale';

create trigger ingredients_updated before update on public.ingredients
  for each row execute function public.set_updated_at();
create trigger recipes_updated before update on public.product_recipes
  for each row execute function public.set_updated_at();

-- ========== RLS ==========
alter table public.ingredients enable row level security;
alter table public.product_recipes enable row level security;
alter table public.inventory_movements enable row level security;

create policy "ingredients read" on public.ingredients for select
  using (public.get_my_role() in ('owner','manager'));
create policy "ingredients update" on public.ingredients for update
  using (public.get_my_role() in ('owner','manager'))
  with check (public.get_my_role() in ('owner','manager'));
-- tidak ada policy INSERT/DELETE: bahan dibuat lewat create_ingredient()

-- browser tidak boleh mengubah stok_quantity atau unit secara langsung
revoke update on public.ingredients from anon, authenticated;
grant update (name, minimum_stock, is_active) on public.ingredients to authenticated;

create policy "recipes read" on public.product_recipes for select
  using (public.get_my_role() in ('owner','manager'));
create policy "recipes insert" on public.product_recipes for insert
  with check (public.get_my_role() in ('owner','manager'));
create policy "recipes update" on public.product_recipes for update
  using (public.get_my_role() in ('owner','manager'))
  with check (public.get_my_role() in ('owner','manager'));
create policy "recipes delete" on public.product_recipes for delete
  using (public.get_my_role() in ('owner','manager'));

create policy "movements read" on public.inventory_movements for select
  using (public.get_my_role() in ('owner','manager'));
-- mutasi hanya ditulis oleh fungsi/trigger security definer

-- ========== buat bahan (+ stok awal sebagai mutasi) ==========
create or replace function public.create_ingredient(
  p_name text, p_unit public.stock_unit, p_minimum numeric, p_initial numeric
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role := public.get_my_role();
  v_name text := trim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_uid is null or v_role is null or v_role not in ('owner','manager') then
    raise exception 'CF:Tidak diizinkan';
  end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'CF:Nama bahan 1-80 karakter'; end if;
  if p_minimum is null or p_minimum < 0 or p_minimum > 99999999 then raise exception 'CF:Stok minimum tidak valid'; end if;
  if p_initial is null or p_initial < 0 or p_initial > 99999999 then raise exception 'CF:Stok awal tidak valid'; end if;

  insert into public.ingredients (name, unit, minimum_stock, stock_quantity)
  values (v_name, p_unit, p_minimum, p_initial)
  returning id into v_id;

  if p_initial > 0 then
    insert into public.inventory_movements
      (ingredient_id, movement_type, quantity_delta, stock_after, reason, created_by)
    values (v_id, 'initial', p_initial, p_initial, 'Stok awal', v_uid);
  end if;

  return v_id;
exception when unique_violation then
  raise exception 'CF:Nama bahan sudah dipakai';
end $$;

-- ========== stok masuk / rusak / penyesuaian ==========
create or replace function public.record_stock_movement(
  p_ingredient_id uuid, p_type public.movement_type, p_quantity numeric, p_reason text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role := public.get_my_role();
  v_ing public.ingredients%rowtype;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 200), '');
  v_delta numeric;
  v_new numeric;
begin
  if v_uid is null or v_role is null or v_role not in ('owner','manager') then
    raise exception 'CF:Tidak diizinkan';
  end if;
  if p_type not in ('purchase','waste','adjustment') then raise exception 'CF:Jenis mutasi tidak valid'; end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > 99999999 then raise exception 'CF:Jumlah tidak valid'; end if;

  select * into v_ing from public.ingredients where id = p_ingredient_id for update;
  if not found then raise exception 'CF:Bahan tidak ditemukan'; end if;

  if p_type = 'purchase' then
    if p_quantity <= 0 then raise exception 'CF:Jumlah harus lebih dari 0'; end if;
    v_delta := p_quantity;
    v_reason := coalesce(v_reason, 'Stok masuk');

  elsif p_type = 'waste' then
    if p_quantity <= 0 then raise exception 'CF:Jumlah harus lebih dari 0'; end if;
    if v_reason is null then raise exception 'CF:Alasan wajib diisi'; end if;
    if v_ing.stock_quantity < p_quantity then raise exception 'CF:Jumlah melebihi stok yang ada'; end if;
    v_delta := -p_quantity;

  else -- adjustment: p_quantity = stok aktual hasil hitung
    if v_reason is null then raise exception 'CF:Alasan wajib diisi'; end if;
    v_delta := p_quantity - v_ing.stock_quantity;
    if v_delta = 0 then raise exception 'CF:Stok aktual sama dengan stok di sistem'; end if;
  end if;

  v_new := v_ing.stock_quantity + v_delta;
  update public.ingredients set stock_quantity = v_new where id = p_ingredient_id;

  insert into public.inventory_movements
    (ingredient_id, movement_type, quantity_delta, stock_after, reason, created_by)
  values (p_ingredient_id, p_type, v_delta, v_new, v_reason, v_uid);
end $$;

revoke all on function public.create_ingredient(text, public.stock_unit, numeric, numeric) from public, anon;
grant execute on function public.create_ingredient(text, public.stock_unit, numeric, numeric) to authenticated;
revoke all on function public.record_stock_movement(uuid, public.movement_type, numeric, text) from public, anon;
grant execute on function public.record_stock_movement(uuid, public.movement_type, numeric, text) to authenticated;

-- ========== pengurangan stok saat pesanan dibayar (sekali per pesanan) ==========
-- berjalan di transaksi checkout yang sama: stok kurang = seluruh checkout dibatalkan
create or replace function public.deduct_stock_for_order()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_after numeric;
  v_name text;
begin
  for r in
    select pr.ingredient_id, sum(pr.quantity_required * oi.quantity) as needed
      from public.order_items oi
      join public.product_recipes pr on pr.product_id = oi.product_id
     where oi.order_id = new.id
     group by pr.ingredient_id
     order by pr.ingredient_id            -- urutan tetap: mencegah deadlock antar checkout
  loop
    -- UPDATE bersyarat mengunci baris; checkout lain menunggu lalu mengevaluasi ulang stok
    update public.ingredients
       set stock_quantity = stock_quantity - r.needed
     where id = r.ingredient_id and stock_quantity >= r.needed
    returning stock_quantity, name into v_after, v_name;

    if not found then
      select name into v_name from public.ingredients where id = r.ingredient_id;
      raise exception 'CF:Stok bahan "%" tidak cukup', v_name;
    end if;

    insert into public.inventory_movements
      (ingredient_id, movement_type, quantity_delta, stock_after, reason, order_id, created_by)
    values
      (r.ingredient_id, 'sale', -r.needed, v_after, 'Penjualan ' || new.order_number, new.id, new.cashier_id);
  end loop;
  return new;
end $$;

create trigger orders_stock_deduct
  after update of payment_status on public.orders
  for each row
  when (old.payment_status is distinct from new.payment_status and new.payment_status = 'paid')
  execute function public.deduct_stock_for_order();