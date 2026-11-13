-- شفق ميديا · تحديث ٥: المدير بيغيّر كلمة سر عضو الفريق أو العميل
-- شغّل هذا الملف لوحده في استعلام جديد (New query). آمن إذا انشغّل أكثر من مرة.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_set_password(p_user uuid, p_pass text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_manager() then raise exception 'not allowed'; end if;
  if length(coalesce(p_pass, '')) < 6 then raise exception 'كلمة السر 6 أحرف على الأقل'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'الحساب مو موجود'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_pass, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
end;
$$;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
