-- ========== kitchen_tickets: data minimal untuk dapur ==========
create table public.kitchen_tickets (
  order_id uuid primary key references public.orders(id) on delete restrict,
  order_number text not null,
  order_type public.order_type not null,
  table_number text,
  status public.order_status not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  started_at timestamptz,
  ready_at timestamptz
);
create index kitchen_tickets_status_idx on public.kitchen_tickets (status, created_at);

alter table public.kitchen_tickets enable row level security;
-- hanya SELECT; semua tulis lewat trigger/fungsi security definer
create policy "kitchen tickets read" on public.kitchen_tickets for select
  using (public.get_my_role() in ('owner','manager','kitchen'));

-- ========== trigger: buat dan sinkronkan tiket dari orders ==========
create or replace function public.sync_kitchen_ticket()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.payment_status <> 'paid' and new.payment_status = 'paid'
     and new.status in ('placed','preparing','ready') then
    insert into public.kitchen_tickets
      (order_id, order_number, order_type, table_number, status, items, created_at)
    values (
      new.id, new.order_number, new.order_type,
      (select table_number from public.dining_tables where id = new.table_id),
      new.status,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('name', i.product_name, 'variant', i.variant_name,
                             'quantity', i.quantity, 'notes', i.notes)
          order by i.position)
        from public.order_items i where i.order_id = new.id
      ), '[]'::jsonb),
      new.created_at
    )
    on conflict (order_id) do nothing;

  elsif old.status is distinct from new.status then
    update public.kitchen_tickets set
      status = new.status,
      started_at = case when new.status = 'preparing'
                        then coalesce(started_at, now()) else started_at end,
      ready_at = case when new.status = 'ready' then now()
                      when new.status = 'preparing' then null
                      else ready_at end
    where order_id = new.id;
  end if;
  return new;
end $$;

create trigger orders_kitchen_sync
  after update on public.orders
  for each row execute function public.sync_kitchen_ticket();

-- isi tiket untuk pesanan Fase 3 yang masih aktif
insert into public.kitchen_tickets
  (order_id, order_number, order_type, table_number, status, items, created_at)
select o.id, o.order_number, o.order_type, t.table_number, o.status,
  coalesce((
    select jsonb_agg(
      jsonb_build_object('name', i.product_name, 'variant', i.variant_name,
                         'quantity', i.quantity, 'notes', i.notes)
      order by i.position)
    from public.order_items i where i.order_id = o.id
  ), '[]'::jsonb),
  o.created_at
from public.orders o
left join public.dining_tables t on t.id = o.table_id
where o.payment_status = 'paid' and o.status in ('placed','preparing','ready')
on conflict (order_id) do nothing;

-- ========== ubah status pesanan (satu-satunya jalur) ==========
create or replace function public.set_order_status(p_order_id uuid, p_to public.order_status)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role := public.get_my_role();
  v_order public.orders%rowtype;
  v_move text;
begin
  if v_uid is null or v_role is null then raise exception 'CF:Tidak diizinkan'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'CF:Pesanan tidak ditemukan'; end if;

  if v_role = 'cashier' and v_order.cashier_id <> v_uid then
    raise exception 'CF:Tidak diizinkan';
  end if;

  -- sudah di status tujuan (mis. dua tablet menekan tombol yang sama): abaikan
  if v_order.status = p_to then return; end if;

  if v_order.payment_status <> 'paid' then
    raise exception 'CF:Pesanan belum dibayar';
  end if;

  v_move := v_order.status::text || '>' || p_to::text;

  if v_move in ('placed>preparing', 'preparing>ready', 'ready>preparing') then
    if v_role not in ('owner','manager','kitchen') then raise exception 'CF:Tidak diizinkan'; end if;
  elsif v_move = 'ready>completed' then
    if v_role not in ('owner','manager','cashier') then raise exception 'CF:Tidak diizinkan'; end if;
  else
    raise exception 'CF:Perubahan status tidak diizinkan';
  end if;

  update public.orders set status = p_to where id = p_order_id;

  -- selesai: lepas meja (hanya jika masih "terisi")
  if p_to = 'completed' and v_order.table_id is not null then
    update public.dining_tables set status = 'available'
     where id = v_order.table_id and status = 'occupied';
  end if;
end $$;

revoke all on function public.set_order_status(uuid, public.order_status) from public, anon;
grant execute on function public.set_order_status(uuid, public.order_status) to authenticated;

-- ========== Realtime ==========
alter publication supabase_realtime add table public.kitchen_tickets, public.dining_tables, public.orders;