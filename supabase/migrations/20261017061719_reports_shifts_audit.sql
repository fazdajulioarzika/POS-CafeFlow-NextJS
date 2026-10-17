-- ========== audit_logs ==========
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

alter table public.audit_logs enable row level security;
-- hanya SELECT untuk owner; tidak ada policy tulis, jadi tidak ada yang bisa edit/hapus lewat API
create policy "audit read" on public.audit_logs for select
  using (public.get_my_role() = 'owner');

create or replace function public.write_audit(
  p_actor uuid, p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb
) returns void
language sql security definer set search_path = public
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;
revoke all on function public.write_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- ========== trigger audit ==========
create or replace function public.audit_product_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.price is distinct from old.price then
    perform public.write_audit(auth.uid(), 'product.price_changed', 'product', new.id::text,
      jsonb_build_object('name', new.name, 'old_price', old.price, 'new_price', new.price));
  end if;
  if new.is_active is distinct from old.is_active then
    perform public.write_audit(auth.uid(), 'product.active_changed', 'product', new.id::text,
      jsonb_build_object('name', new.name, 'is_active', new.is_active));
  end if;
  return new;
end $$;
create trigger products_audit after update on public.products
  for each row execute function public.audit_product_changes();

create or replace function public.audit_variant_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.price_delta is distinct from old.price_delta then
    perform public.write_audit(auth.uid(), 'variant.price_changed', 'variant', new.id::text,
      jsonb_build_object(
        'product', (select name from public.products where id = new.product_id),
        'variant', new.name, 'old_delta', old.price_delta, 'new_delta', new.price_delta));
  end if;
  return new;
end $$;
create trigger variants_audit after update on public.product_variants
  for each row execute function public.audit_variant_changes();

create or replace function public.audit_recipe_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_row public.product_recipes%rowtype;
  v_action text;
  v_old numeric;
  v_new numeric;
begin
  if tg_op = 'DELETE' then
    v_row := old; v_old := old.quantity_required; v_new := null; v_action := 'recipe.removed';
  elsif tg_op = 'INSERT' then
    v_row := new; v_old := null; v_new := new.quantity_required; v_action := 'recipe.added';
  else
    if new.quantity_required is not distinct from old.quantity_required then return new; end if;
    v_row := new; v_old := old.quantity_required; v_new := new.quantity_required; v_action := 'recipe.updated';
  end if;

  perform public.write_audit(auth.uid(), v_action, 'product', v_row.product_id::text,
    jsonb_build_object(
      'product', (select name from public.products where id = v_row.product_id),
      'ingredient', (select name from public.ingredients where id = v_row.ingredient_id),
      'old_quantity', v_old, 'new_quantity', v_new));

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger recipes_audit after insert or update or delete on public.product_recipes
  for each row execute function public.audit_recipe_changes();

create or replace function public.audit_stock_movement()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.movement_type in ('adjustment', 'waste') then
    perform public.write_audit(new.created_by, 'stock.' || new.movement_type::text, 'ingredient',
      new.ingredient_id::text,
      jsonb_build_object(
        'ingredient', (select name from public.ingredients where id = new.ingredient_id),
        'delta', new.quantity_delta, 'stock_after', new.stock_after, 'reason', new.reason));
  end if;
  return new;
end $$;
create trigger inventory_movements_audit after insert on public.inventory_movements
  for each row execute function public.audit_stock_movement();

create or replace function public.audit_profile_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    perform public.write_audit(auth.uid(), 'user.role_changed', 'user', new.id::text,
      jsonb_build_object('name', new.full_name, 'old_role', old.role, 'new_role', new.role));
  end if;
  if new.is_active is distinct from old.is_active then
    perform public.write_audit(auth.uid(), 'user.active_changed', 'user', new.id::text,
      jsonb_build_object('name', new.full_name, 'is_active', new.is_active));
  end if;
  return new;
end $$;
create trigger profiles_audit after update on public.profiles
  for each row execute function public.audit_profile_changes();

create or replace function public.audit_settings_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at') then
    perform public.write_audit(auth.uid(), 'settings.changed', 'settings', 'main',
      jsonb_build_object('old', to_jsonb(old) - 'updated_at', 'new', to_jsonb(new) - 'updated_at'));
  end if;
  return new;
end $$;
create trigger settings_audit after update on public.app_settings
  for each row execute function public.audit_settings_changes();

-- ========== shifts ==========
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'open' check (status in ('open','closed')),
  opening_cash integer not null check (opening_cash >= 0),
  closing_cash integer check (closing_cash >= 0),
  expected_cash integer,
  difference integer,
  note text check (char_length(note) <= 300),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index shifts_one_open_per_user on public.shifts (cashier_id) where status = 'open';
create index shifts_opened_idx on public.shifts (opened_at desc);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete restrict,
  type text not null check (type in ('in','out')),
  amount integer not null check (amount > 0),
  reason text not null check (char_length(reason) between 1 and 200),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index cash_movements_shift_idx on public.cash_movements (shift_id);

alter table public.payments add column shift_id uuid references public.shifts(id) on delete restrict;
create index payments_shift_idx on public.payments (shift_id);

alter table public.shifts enable row level security;
alter table public.cash_movements enable row level security;

create policy "shifts read" on public.shifts for select using (
  public.get_my_role() in ('owner','manager')
  or (public.get_my_role() = 'cashier' and cashier_id = auth.uid())
);
create policy "cash movements read" on public.cash_movements for select using (
  exists (select 1 from public.shifts s where s.id = cash_movements.shift_id)
);
-- tidak ada policy tulis: semua lewat fungsi

-- pembayaran dikaitkan ke shift terbuka milik pemrosesnya; tunai wajib punya shift
create or replace function public.attach_shift_to_payment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_shift uuid;
begin
  -- FOR SHARE: menunggu bila shift sedang ditutup, lalu status dievaluasi ulang
  select id into v_shift from public.shifts
   where cashier_id = new.processed_by and status = 'open' for share;

  if new.method = 'cash' and v_shift is null then
    raise exception 'CF:Buka shift terlebih dahulu untuk menerima pembayaran tunai';
  end if;
  new.shift_id := v_shift;
  return new;
end $$;
create trigger payments_attach_shift before insert on public.payments
  for each row execute function public.attach_shift_to_payment();

-- ========== refunds ==========
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  method public.payment_method not null,
  amount integer not null check (amount >= 0),
  reason text not null check (char_length(reason) between 3 and 200),
  refunded_by uuid not null references public.profiles(id) on delete restrict,
  shift_id uuid references public.shifts(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index refunds_shift_idx on public.refunds (shift_id);

alter table public.refunds enable row level security;
create policy "refunds read" on public.refunds for select using (
  exists (select 1 from public.orders o where o.id = refunds.order_id)
);

-- ========== ringkasan shift ==========
create or replace function public.shift_summary(p_shift_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role := public.get_my_role();
  v_shift public.shifts%rowtype;
  v_cash_sales bigint;
  v_cash_in bigint;
  v_cash_out bigint;
  v_cash_refunds bigint;
  v_by jsonb;
begin
  if v_uid is null or v_role is null then raise exception 'CF:Tidak diizinkan'; end if;

  select * into v_shift from public.shifts where id = p_shift_id;
  if not found then raise exception 'CF:Shift tidak ditemukan'; end if;
  if v_role not in ('owner','manager') and v_shift.cashier_id <> v_uid then
    raise exception 'CF:Tidak diizinkan';
  end if;

  select coalesce(sum(amount), 0) into v_cash_sales from public.payments
   where shift_id = p_shift_id and method = 'cash' and status in ('paid','refunded');

  select coalesce(sum(amount) filter (where type = 'in'), 0),
         coalesce(sum(amount) filter (where type = 'out'), 0)
    into v_cash_in, v_cash_out
    from public.cash_movements where shift_id = p_shift_id;

  select coalesce(sum(amount), 0) into v_cash_refunds from public.refunds
   where shift_id = p_shift_id and method = 'cash';

  select coalesce(jsonb_agg(jsonb_build_object('method', x.method, 'count', x.cnt, 'total', x.tot)
                            order by x.method), '[]'::jsonb)
    into v_by
    from (select method, count(*) as cnt, sum(amount) as tot
            from public.payments
           where shift_id = p_shift_id and status in ('paid','refunded')
           group by method) x;

  return jsonb_build_object(
    'opening', v_shift.opening_cash,
    'cash_sales', v_cash_sales,
    'cash_in', v_cash_in,
    'cash_out', v_cash_out,
    'cash_refunds', v_cash_refunds,
    'expected', v_shift.opening_cash + v_cash_sales + v_cash_in - v_cash_out - v_cash_refunds,
    'by_method', v_by
  );
end $$;

create or replace function public.open_shift(p_opening integer)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role := public.get_my_role();
  v_id uuid;
begin
  if v_uid is null or v_role is null or v_role not in ('owner','manager','cashier') then
    raise exception 'CF:Tidak diizinkan';
  end if;
  if p_opening is null or p_opening < 0 or p_opening > 1000000000 then
    raise exception 'CF:Kas awal tidak valid';
  end if;

  insert into public.shifts (cashier_id, opening_cash) values (v_uid, p_opening)
  returning id into v_id;

  perform public.write_audit(v_uid, 'shift.opened', 'shift', v_id::text,
    jsonb_build_object('opening_cash', p_opening));
  return v_id;
exception when unique_violation then
  raise exception 'CF:Anda masih memiliki shift yang terbuka';
end $$;

create or replace function public.add_cash_movement(p_type text, p_amount integer, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role := public.get_my_role();
  v_shift uuid;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if v_uid is null or v_role is null or v_role not in ('owner','manager','cashier') then
    raise exception 'CF:Tidak diizinkan';
  end if;
  if p_type not in ('in','out') then raise exception 'CF:Jenis kas tidak valid'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000000 then raise exception 'CF:Jumlah tidak valid'; end if;
  if char_length(v_reason) not between 1 and 200 then raise exception 'CF:Alasan wajib diisi (maks 200 karakter)'; end if;

  select id into v_shift from public.shifts where cashier_id = v_uid and status = 'open' for update;
  if v_shift is null then raise exception 'CF:Buka shift terlebih dahulu'; end if;

  insert into public.cash_movements (shift_id, type, amount, reason, created_by)
  values (v_shift, p_type, p_amount, v_reason, v_uid);

  perform public.write_audit(v_uid, 'shift.cash_' || p_type, 'shift', v_shift::text,
    jsonb_build_object('amount', p_amount, 'reason', v_reason));
end $$;

create or replace function public.close_shift(p_closing integer, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role := public.get_my_role();
  v_shift public.shifts%rowtype;
  v_expected integer;
  v_diff integer;
  v_note text := nullif(left(trim(coalesce(p_note, '')), 300), '');
begin
  if v_uid is null or v_role is null or v_role not in ('owner','manager','cashier') then
    raise exception 'CF:Tidak diizinkan';
  end if;
  if p_closing is null or p_closing < 0 or p_closing > 1000000000 then
    raise exception 'CF:Kas aktual tidak valid';
  end if;

  select * into v_shift from public.shifts where cashier_id = v_uid and status = 'open' for update;
  if not found then raise exception 'CF:Tidak ada shift yang terbuka'; end if;

  v_expected := (public.shift_summary(v_shift.id) ->> 'expected')::integer;
  v_diff := p_closing - v_expected;
  if v_diff <> 0 and v_note is null then
    raise exception 'CF:Catatan wajib diisi jika ada selisih kas';
  end if;

  update public.shifts set
    status = 'closed', closing_cash = p_closing, expected_cash = v_expected,
    difference = v_diff, note = v_note, closed_at = now()
  where id = v_shift.id;

  perform public.write_audit(v_uid, 'shift.closed', 'shift', v_shift.id::text,
    jsonb_build_object('opening_cash', v_shift.opening_cash, 'expected', v_expected,
                       'closing', p_closing, 'difference', v_diff, 'note', v_note));
end $$;

-- ========== refund / pembatalan pesanan ==========
create or replace function public.refund_order(p_order_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role := public.get_my_role();
  v_reason text := trim(coalesce(p_reason, ''));
  v_order public.orders%rowtype;
  v_pay public.payments%rowtype;
  v_shift uuid;
begin
  if v_uid is null or v_role is null or v_role not in ('owner','manager') then
    raise exception 'CF:Tidak diizinkan';
  end if;
  if char_length(v_reason) not between 3 and 200 then raise exception 'CF:Alasan 3-200 karakter'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'CF:Pesanan tidak ditemukan'; end if;
  if v_order.payment_status <> 'paid' or v_order.status = 'cancelled' then
    raise exception 'CF:Pesanan ini tidak dapat direfund';
  end if;

  select * into v_pay from public.payments
   where order_id = p_order_id and status = 'paid'
   order by created_at limit 1 for update;
  if not found then raise exception 'CF:Data pembayaran tidak ditemukan'; end if;

  select id into v_shift from public.shifts where cashier_id = v_uid and status = 'open' for share;
  if v_pay.method = 'cash' and v_shift is null then
    raise exception 'CF:Buka shift terlebih dahulu untuk refund tunai';
  end if;

  insert into public.refunds (order_id, payment_id, method, amount, reason, refunded_by, shift_id)
  values (p_order_id, v_pay.id, v_pay.method, v_pay.amount, v_reason, v_uid, v_shift);

  update public.payments set status = 'refunded' where id = v_pay.id;
  update public.orders set status = 'cancelled', payment_status = 'refunded' where id = p_order_id;

  -- pesanan yang masih aktif: lepas mejanya (stok TIDAK dikembalikan otomatis)
  if v_order.table_id is not null and v_order.status in ('placed','preparing','ready','served') then
    update public.dining_tables set status = 'available'
     where id = v_order.table_id and status = 'occupied';
  end if;

  perform public.write_audit(v_uid, 'order.refunded', 'order', p_order_id::text,
    jsonb_build_object('order_number', v_order.order_number, 'amount', v_pay.amount,
                       'method', v_pay.method, 'previous_status', v_order.status,
                       'reason', v_reason, 'stock_restored', false));
end $$;

-- ========== fungsi laporan (security invoker: RLS pemanggil tetap berlaku) ==========
create or replace function public.report_summary(p_from timestamptz, p_to timestamptz)
returns table (
  net_sales bigint, transactions bigint, avg_value bigint,
  discount_total bigint, tax_total bigint, refund_count bigint, refund_total bigint
)
language sql stable
as $$
  select
    coalesce(sum(total_amount) filter (where payment_status = 'paid'), 0)::bigint,
    (count(*) filter (where payment_status = 'paid'))::bigint,
    coalesce(round(avg(total_amount) filter (where payment_status = 'paid')), 0)::bigint,
    coalesce(sum(discount_amount) filter (where payment_status = 'paid'), 0)::bigint,
    coalesce(sum(tax_amount) filter (where payment_status = 'paid'), 0)::bigint,
    (count(*) filter (where payment_status = 'refunded'))::bigint,
    coalesce(sum(total_amount) filter (where payment_status = 'refunded'), 0)::bigint
  from public.orders
  where created_at >= p_from and created_at < p_to;
$$;

create or replace function public.report_daily(p_from timestamptz, p_to timestamptz)
returns table (day date, net_sales bigint, transactions bigint)
language sql stable
as $$
  select (o.created_at at time zone 'Asia/Jakarta')::date,
         sum(o.total_amount)::bigint,
         count(*)::bigint
    from public.orders o
   where o.payment_status = 'paid' and o.created_at >= p_from and o.created_at < p_to
   group by 1
   order by 1;
$$;

create or replace function public.report_top_products(p_from timestamptz, p_to timestamptz, p_limit integer)
returns table (product_id uuid, product_name text, category_name text, quantity bigint, revenue bigint)
language sql stable
as $$
  select oi.product_id,
         max(oi.product_name),
         coalesce(max(c.name), '-'),
         sum(oi.quantity)::bigint,
         sum(oi.line_total)::bigint
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
   where o.payment_status = 'paid' and o.created_at >= p_from and o.created_at < p_to
   group by oi.product_id
   order by 4 desc, 5 desc
   limit greatest(1, least(coalesce(p_limit, 10), 500));
$$;

create or replace function public.report_payment_methods(p_from timestamptz, p_to timestamptz)
returns table (method public.payment_method, transactions bigint, total bigint)
language sql stable
as $$
  select pay.method, count(*)::bigint, sum(pay.amount)::bigint
    from public.payments pay
    join public.orders o on o.id = pay.order_id
   where o.payment_status = 'paid' and pay.status = 'paid'
     and o.created_at >= p_from and o.created_at < p_to
   group by pay.method
   order by 3 desc;
$$;

create or replace function public.report_ingredient_usage(p_from timestamptz, p_to timestamptz)
returns table (ingredient_id uuid, name text, unit text, used numeric)
language sql stable
as $$
  select i.id, i.name, i.unit::text, sum(-m.quantity_delta)
    from public.inventory_movements m
    join public.ingredients i on i.id = m.ingredient_id
   where m.movement_type = 'sale' and m.created_at >= p_from and m.created_at < p_to
   group by i.id, i.name, i.unit
   order by 4 desc;
$$;

-- ========== hak eksekusi ==========
revoke all on function public.shift_summary(uuid) from public, anon;
revoke all on function public.open_shift(integer) from public, anon;
revoke all on function public.add_cash_movement(text, integer, text) from public, anon;
revoke all on function public.close_shift(integer, text) from public, anon;
revoke all on function public.refund_order(uuid, text) from public, anon;
revoke all on function public.report_summary(timestamptz, timestamptz) from public, anon;
revoke all on function public.report_daily(timestamptz, timestamptz) from public, anon;
revoke all on function public.report_top_products(timestamptz, timestamptz, integer) from public, anon;
revoke all on function public.report_payment_methods(timestamptz, timestamptz) from public, anon;
revoke all on function public.report_ingredient_usage(timestamptz, timestamptz) from public, anon;

grant execute on function public.shift_summary(uuid) to authenticated;
grant execute on function public.open_shift(integer) to authenticated;
grant execute on function public.add_cash_movement(text, integer, text) to authenticated;
grant execute on function public.close_shift(integer, text) to authenticated;
grant execute on function public.refund_order(uuid, text) to authenticated;
grant execute on function public.report_summary(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_daily(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_top_products(timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.report_payment_methods(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_ingredient_usage(timestamptz, timestamptz) to authenticated;