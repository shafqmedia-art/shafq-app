-- نظام شفق: قاعدة البيانات للخطوة الأولى (Supabase / PostgreSQL)
-- طريقة التشغيل: Supabase > SQL Editor > New query > الصق الملف كاملاً > Run
-- يُشغَّل مرة واحدة على مشروع فارغ.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  login_phone text unique,
  role text not null default 'member' check (role in ('manager','member')),
  title text,
  kind text,
  contract numeric not null default 0,
  email text, city text, insta text, bio text, photo text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key,
  name text not null,
  kind text not null default 'page',
  value numeric not null default 0,
  months numeric not null default 0,
  start_date date,
  notes text,
  roles jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key,
  title text not null,
  user_id uuid references public.profiles(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  due date not null,
  done boolean not null default false,
  done_at date,
  created_at timestamptz not null default now()
);

create table public.moves (
  id uuid primary key,
  date date not null,
  dir text not null check (dir in ('in','out')),
  cat text not null,
  amount numeric not null check (amount > 0),
  cur text not null check (cur in ('USD','SYP')),
  rate numeric not null default 1,
  usd numeric not null,
  note text,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  is_void boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.debts (
  id uuid primary key,
  dir text not null check (dir in ('owe','owed')),
  party text not null,
  usd numeric not null check (usd > 0),
  due date,
  settled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.rates (
  day date primary key,
  rate numeric not null check (rate > 0)
);

create table public.settings (
  key text primary key,
  value jsonb not null
);

-- ---------- دوال الصلاحيات ----------
create function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager' and active);
$$;

create function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

-- هل يوجد مدير؟ تُستعمل قبل الدخول لإظهار شاشة الإعداد أول مرة فقط.
create function public.has_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where role = 'manager');
$$;

-- إنشاء حساب المدير: تعمل مرة واحدة فقط، عندما لا يوجد أي مدير.
create function public.bootstrap_manager(p_name text, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.profiles where role = 'manager') then raise exception 'manager already exists'; end if;
  insert into public.profiles (id, name, phone, login_phone, role, title, active)
  values (auth.uid(), p_name, p_phone, regexp_replace(p_phone, '[^0-9]', '', 'g'), 'manager', 'المدير', true);
end;
$$;

-- عضو الفريق يعدّل بياناته الشخصية فقط، لا صلاحيته ولا عقده.
create function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_manager() then
    new.role := old.role; new.contract := old.contract; new.active := old.active;
    new.kind := old.kind; new.login_phone := old.login_phone; new.id := old.id;
  end if;
  return new;
end;
$$;
create trigger guard_profile before update on public.profiles for each row execute function public.guard_profile();

-- عضو الفريق يؤشر على مهمته كمنجزة فقط، لا يغيّر نصها ولا موعدها.
create function public.guard_task() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_manager() then
    new.title := old.title; new.user_id := old.user_id; new.client_id := old.client_id;
    new.client_name := old.client_name; new.due := old.due; new.id := old.id;
  end if;
  return new;
end;
$$;
create trigger guard_task before update on public.tasks for each row execute function public.guard_task();

-- ---------- الصلاحيات على الجداول ----------
alter table public.profiles enable row level security;
alter table public.clients  enable row level security;
alter table public.tasks    enable row level security;
alter table public.moves    enable row level security;
alter table public.debts    enable row level security;
alter table public.rates    enable row level security;
alter table public.settings enable row level security;

-- المدير: كل شيء
create policy mgr_profiles on public.profiles for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy mgr_clients  on public.clients  for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy mgr_tasks    on public.tasks    for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy mgr_moves    on public.moves    for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy mgr_debts    on public.debts    for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy mgr_rates    on public.rates    for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy mgr_settings on public.settings for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- عضو الفريق: ملفه، مهامه، وما دُفع له
create policy self_profile_read   on public.profiles for select to authenticated using (id = auth.uid());
create policy self_profile_update on public.profiles for update to authenticated using (id = auth.uid() and public.is_active()) with check (id = auth.uid());
create policy own_tasks_read      on public.tasks for select to authenticated using (user_id = auth.uid() and public.is_active());
create policy own_tasks_update    on public.tasks for update to authenticated using (user_id = auth.uid() and public.is_active()) with check (user_id = auth.uid());
create policy own_pay_read        on public.moves for select to authenticated using (user_id = auth.uid() and dir = 'out' and public.is_active());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public;
grant execute on function public.has_manager() to anon, authenticated;
grant execute on function public.is_manager(), public.is_active(), public.bootstrap_manager(text, text) to authenticated;
