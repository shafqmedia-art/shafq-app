-- شفق ميديا · تحديث ٤: إشعارات الجوال
-- شغّل هذا الملف لوحده في استعلام جديد (New query). آمن إذا انشغّل أكثر من مرة.

-- أجهزة كل شخص اللي وافق على الإشعارات
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;   -- ما حدا بيقرأها مباشرة، بس دالة الإشعارات

-- الجهاز بيسجّل حاله باسم الشخص اللي فايت حالياً
create or replace function public.save_push_sub(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_subs (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;
create or replace function public.delete_push_sub(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subs where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.save_push_sub(text, text, text) from public, anon;
revoke all on function public.delete_push_sub(text) from public, anon;
grant execute on function public.save_push_sub(text, text, text) to authenticated;
grant execute on function public.delete_push_sub(text) to authenticated;

-- مواعيد التحيات (بتوقيت دمشق) — غيّر الرقمين إذا بدك
insert into public.settings (key, value) values ('push_hours', '{"morning": 8, "evening": 21}'::jsonb)
on conflict (key) do nothing;
