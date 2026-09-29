-- Stocko Phase 4: role-targeted realtime notifications.
-- Demand -> Store Keeper. Low feedback (<3 stars) -> Manager + Admin.

alter table public.notifications enable row level security;

drop policy if exists stocko_notifications_read_own on public.notifications;
create policy stocko_notifications_read_own on public.notifications
for select to authenticated
using (user_id in (select id from public.users where auth_id = auth.uid() or id = auth.uid()));

drop policy if exists stocko_notifications_update_own on public.notifications;
create policy stocko_notifications_update_own on public.notifications
for update to authenticated
using (user_id in (select id from public.users where auth_id = auth.uid() or id = auth.uid()))
with check (user_id in (select id from public.users where auth_id = auth.uid() or id = auth.uid()));

create or replace function public.stocko_notify_new_demand()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(user_id,branch_id,type,title,message,link,read)
  select u.id,new.branch_id,'demand_created','New Demand',
         format('%s created a new demand%s',coalesce(new.created_by_name,new.department,'Staff'),case when new.department is not null then ' · '||new.department else '' end),
         '/demands',false
  from public.users u
  where u.branch_id=new.branch_id and lower(coalesce(u.status,'active'))='active'
    and lower(coalesce(u.role,'')) in ('store keeper','storekeeper');
  return new;
end $$;

drop trigger if exists trg_stocko_notify_new_demand on public.requests;
create trigger trg_stocko_notify_new_demand after insert on public.requests
for each row execute function public.stocko_notify_new_demand();

create or replace function public.stocko_notify_new_complaint()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  -- Low feedback is urgent and rings Manager/Admin. Normal feedback/complaints remain visible without urgent sound rules.
  insert into public.notifications(user_id,branch_id,type,title,message,link,read)
  select u.id,new.branch_id,
         case when new.entry_type='feedback' and coalesce(new.rating,5)<3 then 'customer_low_rating' else 'customer_feedback' end,
         case when new.entry_type='feedback' and coalesce(new.rating,5)<3 then 'Urgent Customer Feedback' when new.entry_type='feedback' then 'New Customer Feedback' else 'New Customer Complaint' end,
         case when new.rating is not null then format('%s-star feedback · %s',new.rating,left(coalesce(new.description,'Customer feedback'),180)) else left(coalesce(new.description,'New customer complaint'),180) end,
         '/complaints',false
  from public.users u
  where u.branch_id=new.branch_id and lower(coalesce(u.status,'active'))='active'
    and lower(coalesce(u.role,'')) in ('manager','admin');
  return new;
end $$;

drop trigger if exists trg_stocko_notify_new_complaint on public.customer_complaints;
create trigger trg_stocko_notify_new_complaint after insert on public.customer_complaints
for each row execute function public.stocko_notify_new_complaint();

-- Ensure Supabase Realtime can deliver notification INSERT events.
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
