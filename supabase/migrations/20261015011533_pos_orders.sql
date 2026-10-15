-- ========== enum ==========
create type public.order_type as enum ('dine_in','takeaway');
create type public.order_status as enum ('draft','placed','preparing','ready','completed','cancelled');
create type public.order_payment_status as enum ('unpaid','paid','refunded');
create type public.payment_method as enum ('cash','qris','bank_transfer','other');
create type public.payment_record_status as enum ('paid','failed','refunded');

-- ========== penomoran harian ==========
create table public.order_counters (
  day date primary key,
  last_value integer not null default 0
);
alter table public.order_counters enable row level security; -- tanpa policy: hanya fungsi security definer

-- ========== orders ==========
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  idempotency_key uuid not null unique,
  order_type public.order_type not null,
  table_id uuid references public.dining_tables(id) on delete restrict,
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  status public.order_status not null default 'placed',
  payment_status public.order_payment_status not null default 'unpaid',
  subtotal integer not null default 0 check (subtotal >= 0),
  discount_type text not null default 'none' check (discount_type in ('none','amount','percent')),
  discount_value integer not null default 0 check (discount_value >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  tax_amount integer not null default 0 check (tax_amount >= 0),
  total_amount integer not null default 0 check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (order_type <> 'dine_in' or table_id is not null)
);
create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_cashier_idx on public.orders (cashier_id);
create index orders_table_idx on public.orders (table_id);

create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

-- ========== order_items (snapshot) ==========
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  position integer not null,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  product_name text not null,
  variant_name text,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99),
  notes text check (char_length(notes) <= 200),
  line_total integer not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);

-- ========== payments ==========
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  method public.payment_method not null,
  amount integer not null check (amount >= 0),
  tendered integer not null check (tendered >= 0),
  change_amount integer not null default 0 check (change_amount >= 0),
  status public.payment_record_status not null default 'paid',
  reference text check (char_length(reference) <= 100),
  processed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);

-- ========== RLS: hanya SELECT; semua tulis lewat fungsi ==========
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

create policy "orders read" on public.orders for select using (
  public.get_my_role() in ('owner','manager')
  or (public.get_my_role() = 'cashier' and cashier_id = auth.uid())
);

-- subquery ke orders ikut terkena RLS si pemanggil, jadi cakupannya otomatis sama
create policy "order_items read" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_items.order_id)
);
create policy "payments read" on public.payments for select using (
  exists (select 1 from public.orders o where o.id = payments.order_id)
);

-- ========== checkout atomik ==========
create or replace function public.create_order_checkout(
  p_idempotency_key uuid,
  p_order_type public.order_type,
  p_table_id uuid,
  p_items jsonb,
  p_discount_type text,
  p_discount_value integer,
  p_payment_method public.payment_method,
  p_tendered integer,
  p_reference text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role := public.get_my_role();
  v_existing uuid;
  v_table_id uuid;
  v_table public.dining_tables%rowtype;
  v_order_id uuid;
  v_day date;
  v_seq integer;
  v_number text;
  v_item jsonb;
  v_pos integer := 0;
  v_product public.products%rowtype;
  v_variant_id uuid;
  v_variant_name text;
  v_variant_delta integer;
  v_variant_active boolean;
  v_qty integer;
  v_notes text;
  v_unit integer;
  v_line bigint;
  v_subtotal bigint := 0;
  v_discount integer := 0;
  v_discount_value integer := 0;
  v_tax_pct numeric := 0;
  v_tax integer;
  v_total integer;
  v_tendered integer;
  v_change integer := 0;
begin
  -- 1. otorisasi
  if v_uid is null or v_role is null or v_role not in ('owner','manager','cashier') then
    raise exception 'CF:Tidak diizinkan';
  end if;

  -- 2. idempotensi: retry mengembalikan pesanan yang sama
  select id into v_existing from public.orders
   where idempotency_key = p_idempotency_key and cashier_id = v_uid;
  if v_existing is not null then return v_existing; end if;

  -- 3. validasi dasar
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'CF:Keranjang kosong atau tidak valid';
  end if;

  if p_discount_type not in ('none','amount','percent') then
    raise exception 'CF:Jenis diskon tidak valid';
  end if;
  if p_discount_type <> 'none' then
    if v_role = 'cashier' then raise exception 'CF:Cashier tidak boleh memberi diskon'; end if;
    if p_discount_value is null or p_discount_value < 0 then raise exception 'CF:Nilai diskon tidak valid'; end if;
    v_discount_value := p_discount_value;
  end if;

  -- 4. meja (dikunci agar dua checkout tidak memakai meja yang sama)
  if p_order_type = 'dine_in' then
    if p_table_id is null then raise exception 'CF:Pilih meja untuk dine-in'; end if;
    select * into v_table from public.dining_tables where id = p_table_id for update;
    if not found or not v_table.is_active then raise exception 'CF:Meja tidak valid'; end if;
    if v_table.status <> 'available' then
      raise exception 'CF:Meja % sedang tidak tersedia', v_table.table_number;
    end if;
    v_table_id := v_table.id;
  end if;

  select coalesce(tax_percent, 0) into v_tax_pct from public.app_settings where id = true;

  -- 5. nomor pesanan: CF-YYYYMMDD-0001 (hari Asia/Jakarta)
  v_day := (now() at time zone 'Asia/Jakarta')::date;
  insert into public.order_counters (day, last_value) values (v_day, 1)
  on conflict (day) do update set last_value = public.order_counters.last_value + 1
  returning last_value into v_seq;
  v_number := 'CF-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  insert into public.orders (order_number, idempotency_key, order_type, table_id, cashier_id, status)
  values (v_number, p_idempotency_key, p_order_type, v_table_id, v_uid, 'placed')
  returning id into v_order_id;

  -- 6. item: harga diambil dari database, bukan dari browser
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'CF:Jumlah item tidak valid';
    end if;
    v_notes := nullif(left(trim(coalesce(v_item->>'notes','')), 200), '');

    select * into v_product from public.products where id = (v_item->>'product_id')::uuid;
    if not found or not v_product.is_active or not v_product.is_available
       or not exists (select 1 from public.categories c where c.id = v_product.category_id and c.is_active) then
      raise exception 'CF:Produk "%" tidak tersedia', coalesce(v_product.name, '?');
    end if;

    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
    v_variant_name := null;
    v_variant_delta := 0;
    if v_variant_id is not null then
      select name, price_delta, is_active
        into v_variant_name, v_variant_delta, v_variant_active
        from public.product_variants
       where id = v_variant_id and product_id = v_product.id;
      if not found or not v_variant_active then
        raise exception 'CF:Varian produk "%" tidak tersedia', v_product.name;
      end if;
    end if;

    v_unit := v_product.price + v_variant_delta;
    if v_unit < 0 then raise exception 'CF:Harga tidak valid'; end if;
    v_line := v_unit::bigint * v_qty;
    v_subtotal := v_subtotal + v_line;
    v_pos := v_pos + 1;

    insert into public.order_items
      (order_id, position, product_id, variant_id, product_name, variant_name,
       unit_price, quantity, notes, line_total)
    values
      (v_order_id, v_pos, v_product.id, v_variant_id, v_product.name, v_variant_name,
       v_unit, v_qty, v_notes, v_line::integer);
  end loop;

  if v_subtotal > 1000000000 then raise exception 'CF:Total terlalu besar'; end if;

  -- 7. diskon, pajak, total
  if p_discount_type = 'amount' then
    if v_discount_value > v_subtotal then raise exception 'CF:Diskon melebihi subtotal'; end if;
    v_discount := v_discount_value;
  elsif p_discount_type = 'percent' then
    if v_discount_value > 100 then raise exception 'CF:Diskon persen maksimal 100'; end if;
    v_discount := floor(v_subtotal * v_discount_value / 100.0)::integer;
  end if;

  v_tax := round((v_subtotal - v_discount) * v_tax_pct / 100.0)::integer;
  v_total := v_subtotal::integer - v_discount + v_tax;

  -- 8. pembayaran
  if p_payment_method = 'cash' then
    if p_tendered is null or p_tendered < v_total then
      raise exception 'CF:Uang diterima kurang dari total';
    end if;
    v_tendered := p_tendered;
    v_change := p_tendered - v_total;
  else
    v_tendered := v_total;
  end if;

  insert into public.payments (order_id, method, amount, tendered, change_amount, status, reference, processed_by)
  values (v_order_id, p_payment_method, v_total, v_tendered, v_change, 'paid',
          nullif(left(trim(coalesce(p_reference,'')), 100), ''), v_uid);

  update public.orders set
    subtotal = v_subtotal::integer,
    discount_type = p_discount_type,
    discount_value = v_discount_value,
    discount_amount = v_discount,
    tax_percent = v_tax_pct,
    tax_amount = v_tax,
    total_amount = v_total,
    payment_status = 'paid'
  where id = v_order_id;

  if v_table_id is not null then
    update public.dining_tables set status = 'occupied' where id = v_table_id;
  end if;

  return v_order_id;
end $$;

revoke all on function public.create_order_checkout(
  uuid, public.order_type, uuid, jsonb, text, integer, public.payment_method, integer, text
) from public, anon;
grant execute on function public.create_order_checkout(
  uuid, public.order_type, uuid, jsonb, text, integer, public.payment_method, integer, text
) to authenticated;