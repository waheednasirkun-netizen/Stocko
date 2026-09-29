-- Phase 8: 1-3 star customer feedback alerts Admin, Manager and Chief.
-- Frontend maps customer_low_rating to the loud emergency-style alarm.
create or replace function public.stocko_notify_new_complaint()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.notifications(user_id,branch_id,type,title,message,link,read)
  select u.id,new.branch_id,
         case when new.entry_type='feedback' and coalesce(new.rating,5)<=3 then 'customer_low_rating' else 'customer_feedback' end,
         case when new.entry_type='feedback' and coalesce(new.rating,5)<=3 then 'Urgent Customer Feedback' else 'New Customer Feedback' end,
         case when new.entry_type='feedback' and coalesce(new.rating,5)<=3
              then coalesce(new.rating::text,'?') || '-star feedback received. Please review immediately.'
              else 'New customer feedback received.' end,
         '/complaints',false
  from public.users u
  where u.branch_id=new.branch_id
    and lower(coalesce(u.status,'active'))='active'
    and lower(coalesce(u.role,'')) in ('admin','manager','chief');
  return new;
end $$;

-- Keep the existing trigger pointed at the updated function.
drop trigger if exists trg_stocko_notify_new_complaint on public.customer_complaints;
create trigger trg_stocko_notify_new_complaint
after insert on public.customer_complaints
for each row execute function public.stocko_notify_new_complaint();
