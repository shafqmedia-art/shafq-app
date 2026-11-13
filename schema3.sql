-- شفق ميديا · تحديث ٣: بوابة العميل
-- شغّل هذا الملف لوحده في استعلام جديد (New query) بعد schema.sql و schema2.sql.
-- آمن إذا انشغّل أكثر من مرة.

-- ١) حساب من نوع «عميل» + ربطه بعميله + الجنس
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('manager','member','client'));
alter table public.profiles add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.profiles add column if not exists gender text default 'm';

-- ٢) الدفعة: عن شو + رقم الوصل
alter table public.moves add column if not exists service text;
alter table public.moves add column if not exists receipt text;

-- ٣) العميل أو عضو الفريق ما بيقدر يغيّر دوره أو العميل المربوط فيه
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_manager() then
    new.role := old.role; new.contract := old.contract; new.active := old.active;
    new.kind := old.kind; new.login_phone := old.login_phone; new.id := old.id;
    new.client_id := old.client_id;
  end if;
  return new;
end;
$$;

-- ٤) البوابة: العميل يقرأ بياناته هو فقط، بدون أسماء الفريق وبدون الملاحظات الداخلية
create or replace function public.client_portal() returns json
language plpgsql stable security definer set search_path = public as $$
declare cid uuid; out json;
begin
  select p.client_id into cid from public.profiles p
   where p.id = auth.uid() and p.role = 'client' and coalesce(p.active, true);
  if cid is null then raise exception 'not a client'; end if;
  select json_build_object(
    'client', (select json_build_object('name', c.name, 'kind', c.kind, 'value', c.value, 'months', c.months, 'start_date', c.start_date)
                 from public.clients c where c.id = cid),
    'payments', coalesce((select json_agg(json_build_object('date', m.date, 'service', m.service, 'usd', m.usd, 'amount', m.amount, 'cur', m.cur, 'receipt', m.receipt) order by m.date)
                 from public.moves m where m.client_id = cid and m.dir = 'in' and not coalesce(m.is_void, false)), '[]'::json),
    'posts', coalesce((select json_agg(json_build_object('name', i.data->>'name', 'type', i.data->>'type', 'date', i.data->>'date', 'time', i.data->>'time', 'status', i.status) order by i.data->>'date')
                 from public.items i where i.kind = 'post' and i.data->>'client_id' = cid::text), '[]'::json),
    'phone', coalesce((select s.value #>> '{}' from public.settings s where s.key = 'shafq_phone'),
                      (select p.phone from public.profiles p where p.role = 'manager' order by p.created_at limit 1), '')
  ) into out;
  return out;
end;
$$;
revoke all on function public.client_portal() from public, anon;
grant execute on function public.client_portal() to authenticated;
