create type public.user_role as enum ('owner','manager','cashier','kitchen');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'cashier',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create function public.get_my_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and is_active $$;

create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

create policy "staff read all" on public.profiles
  for select using (public.get_my_role() in ('owner','manager'));

create policy "owner update" on public.profiles
  for update using (public.get_my_role() = 'owner')
  with check (public.get_my_role() = 'owner');

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();