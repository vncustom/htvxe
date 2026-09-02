-- ============================================================================
--  XOA TOAN BO DU LIEU DEMO  (chay truoc khi ban giao production)
--  Dan vao Supabase -> SQL Editor -> Run.  Khong dung toi bang users.
--  Sau khi chay: DB chi con 367 user + 4 xe that, cac bang nghiep vu rong.
-- ============================================================================

begin;

-- 1) Xoa cac bang con cua don demo (id don demo: a0000000-0000-4000-8000-0000000000xx)
delete from odometer_events  where booking_id::text like 'a0000000-0000-4000-8000-0000000000%';
delete from trip_logs        where booking_id::text like 'a0000000-0000-4000-8000-0000000000%';
delete from booking_dispatch where booking_id::text like 'a0000000-0000-4000-8000-0000000000%';
delete from booking_approvals where booking_id::text like 'a0000000-0000-4000-8000-0000000000%';

-- 2) Nhat ky thao tac + canh bao do demo tao
delete from audit_log  where entity = 'trip_log'
  and entity_id like 'a0000000-0000-4000-8000-0000000000%';
delete from alert_acks where kind = 'odo_gap'
  and ref_id  like 'a0000000-0000-4000-8000-0000000000%';

-- 3) Cac don demo
delete from bookings where created_by = 'demo-seed'
   or id::text like 'a0000000-0000-4000-8000-0000000000%';

-- 4) Xe ao demo
delete from vehicles where plate_no = '51B-999.99';

-- 5) Tra so km 4 xe that ve 0 (hoac sua thanh so cong-to-met thuc te cua tung xe)
update vehicles set current_odometer = 0, updated_by = null
 where plate_no in ('50A-030.36','50M-006.30','50A-031.91','50A-031.67');

commit;

-- ---------- Kiem tra: tat ca phai = 0 ----------------------------------------
select 'bookings'          as bang, count(*) from bookings
union all select 'booking_approvals', count(*) from booking_approvals
union all select 'booking_dispatch',  count(*) from booking_dispatch
union all select 'trip_logs',         count(*) from trip_logs
union all select 'odometer_events',   count(*) from odometer_events
union all select 'alert_acks',        count(*) from alert_acks
union all select 'audit_log',         count(*) from audit_log
union all select 'vehicles (con lai)', count(*) from vehicles
union all select 'users (giu nguyen)', count(*) from users;
