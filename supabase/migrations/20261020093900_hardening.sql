-- 1. akun baru tidak aktif sampai owner mengaktifkannya
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, is_active)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), false);
  return new;
end $$;

-- 2. Server Action Owner (service role) boleh mencatat audit
grant execute on function public.write_audit(uuid, text, text, text, jsonb) to service_role;