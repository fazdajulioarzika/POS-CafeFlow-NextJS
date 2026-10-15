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

  -- sudah di status tujuan (dua perangkat menekan tombol yang sama): abaikan
  if v_order.status = p_to then return; end if;

  if v_order.payment_status <> 'paid' then
    raise exception 'CF:Pesanan belum dibayar';
  end if;

  v_move := v_order.status::text || '>' || p_to::text;

  if v_move in ('placed>preparing', 'preparing>ready', 'ready>preparing') then
    if v_role not in ('owner','manager','kitchen') then raise exception 'CF:Tidak diizinkan'; end if;

  elsif v_move = 'ready>served' then
    if v_order.order_type <> 'dine_in' then raise exception 'CF:Takeaway tidak perlu diantar ke meja'; end if;
    if v_role not in ('owner','manager','cashier') then raise exception 'CF:Tidak diizinkan'; end if;

  elsif v_move = 'ready>completed' then
    if v_order.order_type <> 'takeaway' then raise exception 'CF:Tandai sudah diantar terlebih dahulu'; end if;
    if v_role not in ('owner','manager','cashier') then raise exception 'CF:Tidak diizinkan'; end if;

  elsif v_move = 'served>completed' then
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