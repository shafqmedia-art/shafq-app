-- نظام شفق: تحديث قاعدة البيانات للخطوة الثانية
-- (المشاريع، الدرون، خط المحتوى، فريلانس، المؤثرون، المحتملون، الطلبات، الأوراق، المعدات، المواعيد)
-- طريقة التشغيل: Supabase > SQL Editor > New query > الصق الملف كاملاً > Run
-- يُشغَّل مرة واحدة بعد schema.sql. لا يحذف ولا يغيّر أي بيانات موجودة.

create table public.items (
  id uuid primary key,
  kind text not null,
  status text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index items_kind on public.items (kind);

alter table public.moves add column item_id uuid references public.items(id) on delete set null;

alter table public.items enable row level security;
create policy mgr_items on public.items for all to authenticated using (public.is_manager()) with check (public.is_manager());
grant select, insert, update, delete on public.items to authenticated;
revoke all on public.items from anon;
