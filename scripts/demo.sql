-- ============================================================================
--  DEMO DATA — Dat xe Cong tac HTV  (project Supabase: htvxe)
--  Chay SAU seed.sql (can bang users + vehicles da co).
--  Dan toan bo vao Supabase -> SQL Editor -> Run.  An toan chay lai (idempotent):
--  tu xoa du lieu demo cu theo created_by='demo-seed' roi nap lai.
--
--  Moi moc thoi gian tinh theo now() nen demo luon "tuoi" bat ke chay ngay nao.
--  Dien vien (mat khau 123456):
--    admin            quan tri
--    nguyenbaolam     Truong ban "Ban Chuyen De"      -> /duyet
--    nguybadien       Truong ban "Ban CDL"            -> /duyet
--    huynhvantuan     To truong Doi xe (VP Dai)       -> /dieu-xe, /cong-to-met, /thong-ke
--    topho            To pho Doi xe (VP Dai)
--    laixe1..laixe4   Lai xe                          -> /chuyen-cua-toi
--    CaoAnhMinh-TGD   Ban TGD                         -> /thong-ke (xem)
--    leanhdung, huynhthiphuongthao   Nhan vien dat xe -> /cua-toi
-- ============================================================================

begin;

-- ---------- 0. Don du lieu demo cu ----------------------------------------
delete from odometer_events where booking_id in (select id from bookings where created_by = 'demo-seed');
delete from audit_log       where entity = 'trip_log' and entity_id in (select id::text from bookings where created_by = 'demo-seed');
delete from alert_acks      where kind = 'odo_gap';
delete from trip_logs         where booking_id in (select id from bookings where created_by = 'demo-seed');
delete from booking_dispatch  where booking_id in (select id from bookings where created_by = 'demo-seed');
delete from booking_approvals where booking_id in (select id from bookings where created_by = 'demo-seed');
delete from bookings where created_by = 'demo-seed';
delete from vehicles where plate_no = '51B-999.99';

-- ---------- 1. Xe demo ngung hoat dong (test loc + man Quan tri) ---------
insert into vehicles (name, plate_no, seats, current_odometer, note, is_active)
values ('Xe demo (ngung dung)', '51B-999.99', 4, 0, 'Chi de minh hoa trang thai ngung hoat dong', false);

-- ---------- 2. Don cong tac — phu moi trang thai ------------------------
--   Zace 50A-030.36 | Altis 50M-006.30 | Triton 50A-031.91 | Hiace 50A-031.67

insert into bookings
  (id, code, requester_username, don_vi_yeu_cau, start_time, end_time,
   diem_xuat_phat, diem_den, noi_dung, bien_tap, quay_phim, so_nguoi,
   is_phat_sinh, status, created_by, updated_by)
values
-- 01  NHAP (chu don tu sua / gui / huy)
 ('a0000000-0000-4000-8000-000000000001','HTV-2026-000001','huynhthiphuongthao','Ban Chuyên Đề',
  now() + interval '4 days', now() + interval '4 days' + interval '5 hours',
  'HTV','Củ Chi','Ghi hình phóng sự nông thôn mới','Huỳnh Thị Phương Thảo','Lê Anh Dũng',3,
  false,'nhap','demo-seed','demo-seed'),

-- 02  CHO BAN DUYET (Ban Chuyen De) -> nguyenbaolam thay o /duyet
 ('a0000000-0000-4000-8000-000000000002','HTV-2026-000002','leanhdung','Ban Chuyên Đề',
  now() + interval '1 day' + interval '2 hours', now() + interval '1 day' + interval '8 hours',
  'HTV','Sân bay Tân Sơn Nhất','Đón đoàn khách mời chương trình','Lê Anh Dũng',null,4,
  false,'cho_ban_duyet','demo-seed','demo-seed'),

-- 03  CHO BAN DUYET (Ban CDL) -> nguybadien thay o /duyet
 ('a0000000-0000-4000-8000-000000000003','HTV-2026-000003','transiquy','Ban CĐL',
  now() + interval '2 days' + interval '5 hours', null,
  'HTV','Long An','Khảo sát địa điểm quay',null,null,2,
  false,'cho_ban_duyet','demo-seed','demo-seed'),

-- 04  BAN TU CHOI (+ booking_approvals tu_choi)
 ('a0000000-0000-4000-8000-000000000004','HTV-2026-000004','leanhdung','Ban Chuyên Đề',
  now() - interval '3 days', now() - interval '3 days' + interval '4 hours',
  'HTV','Vũng Tàu','Ghi hình chuyên đề du lịch biển','Lê Anh Dũng','Ngô Quang Trí',5,
  false,'ban_tu_choi','demo-seed','demo-seed'),

-- 05  CHO DOI XE (da Ban duyet) -> huynhvantuan thay o /dieu-xe
 ('a0000000-0000-4000-8000-000000000005','HTV-2026-000005','leanhdung','Ban Chuyên Đề',
  date_trunc('day', now()) + interval '2 days' + interval '8 hours',
  date_trunc('day', now()) + interval '2 days' + interval '11 hours',
  'HTV','Biên Hòa, Đồng Nai','Phỏng vấn nhân vật',null,null,3,
  false,'cho_doi_xe','demo-seed','demo-seed'),

-- 06  CHO DOI XE — DON PHAT SINH (bo qua buoc Ban), do Doi xe tao
 ('a0000000-0000-4000-8000-000000000006','HTV-2026-000006','topho','Văn Phòng Đài',
  now() + interval '6 hours', now() + interval '10 hours',
  'HTV','Quận 7','Đưa thiết bị hỗ trợ ghi hình gấp',null,null,2,
  true,'cho_doi_xe','demo-seed','demo-seed'),

-- 07  DOI XE TU CHOI (da Ban duyet, Doi xe tu choi, khong co dieu xe)
 ('a0000000-0000-4000-8000-000000000007','HTV-2026-000007','huynhthiphuongthao','Ban Chuyên Đề',
  now() - interval '1 day', now() - interval '1 day' + interval '6 hours',
  'HTV','Bến Tre','Ghi hình miệt vườn',null,null,4,
  false,'doi_xe_tu_choi','demo-seed','demo-seed'),

-- 08  DA DIEU XE (Zace + laixe1) — lai xe bam "Bat dau chuyen"
 ('a0000000-0000-4000-8000-000000000008','HTV-2026-000008','leanhdung','Ban Chuyên Đề',
  date_trunc('day', now()) + interval '2 days' + interval '6 hours',
  date_trunc('day', now()) + interval '2 days' + interval '12 hours',
  'HTV','Tây Ninh','Ghi hình lễ hội núi Bà','Lê Anh Dũng','Ngô Quang Trí',6,
  false,'da_dieu_xe','demo-seed','demo-seed'),

-- 09  DA DIEU XE (Altis + laixe2) — trung khung gio voi #08 de test "dang ban"
 ('a0000000-0000-4000-8000-000000000009','HTV-2026-000009','huynhthiphuongthao','Ban Chuyên Đề',
  date_trunc('day', now()) + interval '2 days' + interval '6 hours' + interval '30 minutes',
  date_trunc('day', now()) + interval '2 days' + interval '10 hours',
  'HTV','Quận 1','Quay phóng sự đô thị',null,null,2,
  false,'da_dieu_xe','demo-seed','demo-seed'),

-- 10  HOAN THANH  Zace T1  (120000 -> 120180)
 ('a0000000-0000-4000-8000-000000000010','HTV-2026-000010','leanhdung','Ban Chuyên Đề',
  now() - interval '9 days', now() - interval '9 days' + interval '5 hours',
  'HTV','Mỹ Tho, Tiền Giang','Ghi hình chuyên đề','Lê Anh Dũng',null,4,
  false,'hoan_thanh','demo-seed','demo-seed'),

-- 11  HOAN THANH  Zace T2  (120180 -> 120450)  [co dieu chinh km -> audit_log]
 ('a0000000-0000-4000-8000-000000000011','HTV-2026-000011','huynhthiphuongthao','Ban Chuyên Đề',
  now() - interval '7 days', now() - interval '7 days' + interval '8 hours',
  'HTV','Phan Thiết, Bình Thuận','Ghi hình du lịch',null,'Ngô Quang Trí',5,
  false,'hoan_thanh','demo-seed','demo-seed'),

-- 12  HOAN THANH  Zace T3  (120500 -> 121300 = 800 km > 400: vuot nguong)
--     km dau 120500 > km ve T2 120450 => CANH BAO km chay ngoai don (gap 50)
 ('a0000000-0000-4000-8000-000000000012','HTV-2026-000012','leanhdung','Ban Chuyên Đề',
  now() - interval '2 days', now() - interval '1 day',
  'HTV','Đà Lạt, Lâm Đồng','Ghi hình phóng sự dài ngày','Lê Anh Dũng','Ngô Quang Trí',6,
  false,'hoan_thanh','demo-seed','demo-seed'),

-- 13  HOAN THANH  Altis T1  (85000 -> 85120)
 ('a0000000-0000-4000-8000-000000000013','HTV-2026-000013','huynhthiphuongthao','Ban Chuyên Đề',
  now() - interval '6 days', now() - interval '6 days' + interval '3 hours',
  'HTV','Quận 3','Phỏng vấn ngắn',null,null,2,
  false,'hoan_thanh','demo-seed','demo-seed'),

-- 14  HOAN THANH  Altis T2 (85200 -> 85300) km dau 85200 > 85120 => gap 80 (CANH BAO, chua "biet")
 ('a0000000-0000-4000-8000-000000000014','HTV-2026-000014','leanhdung','Ban Chuyên Đề',
  now() - interval '1 day', now() - interval '1 day' + interval '3 hours' + interval '30 minutes',
  'HTV','Quận Bình Thạnh','Ghi hình sự kiện',null,null,3,
  false,'hoan_thanh','demo-seed','demo-seed'),

-- 15  HOAN THANH — DON PHAT SINH  Triton + laixe3  (60000 -> 60240)
 ('a0000000-0000-4000-8000-000000000015','HTV-2026-000015','topho','Văn Phòng Đài',
  now() - interval '1 day' - interval '2 hours', now() - interval '1 day' + interval '3 hours',
  'HTV','Quận 12','Hỗ trợ vận chuyển thiết bị phát sinh',null,null,2,
  true,'hoan_thanh','demo-seed','demo-seed'),

-- 16  HOAN THANH  Hiace + laixe4 (150000 -> 150420 = 420 km > 400) [co dieu chinh km]
 ('a0000000-0000-4000-8000-000000000016','HTV-2026-000016','huynhthiphuongthao','Ban Chuyên Đề',
  now() - interval '5 days', now() - interval '5 days' + interval '13 hours',
  'HTV','Nha Trang, Khánh Hòa','Ghi hình đoàn công tác lớn','Huỳnh Thị Phương Thảo','Ngô Quang Trí',15,
  false,'hoan_thanh','demo-seed','demo-seed'),

-- 17  DANG CHAY (moi) — Triton + laixe3 — lai xe bam "Dong chuyen"
 ('a0000000-0000-4000-8000-000000000017','HTV-2026-000017','leanhdung','Ban Chuyên Đề',
  now() - interval '3 hours', now() + interval '3 hours',
  'HTV','Quận 5','Ghi hình chương trình trực tiếp',null,null,3,
  false,'dang_chay','demo-seed','demo-seed'),

-- 18  DANG CHAY (QUA GIO) — Hiace + laixe4 — banner "chua dong / QUA GIO"
 ('a0000000-0000-4000-8000-000000000018','HTV-2026-000018','huynhthiphuongthao','Ban Chuyên Đề',
  now() - interval '26 hours', now() - interval '18 hours',
  'HTV','Cần Thơ','Ghi hình miền Tây (chưa đóng chuyến)',null,'Ngô Quang Trí',8,
  false,'dang_chay','demo-seed','demo-seed'),

-- 19  DA HUY
 ('a0000000-0000-4000-8000-000000000019','HTV-2026-000019','leanhdung','Ban Chuyên Đề',
  now() + interval '3 days', now() + interval '3 days' + interval '4 hours',
  'HTV','Quận 10','Đơn tạo nhầm — đã hủy',null,null,2,
  false,'huy','demo-seed','demo-seed'),

-- ===== Nhan vien tin tuc (daominhkhoi / "TT Tin Tức") gui 3 yeu cau =====
-- 20  CHO BAN DUYET — LuongVuPhong (chu quan) CHUA duyet  -> thay o /duyet
 ('a0000000-0000-4000-8000-000000000020','HTV-2026-000020','daominhkhoi','TT Tin Tức',
  now() + interval '1 day' + interval '4 hours', now() + interval '1 day' + interval '9 hours',
  'HTV','UBND TP Thủ Đức','Ghi hình họp báo tình hình kinh tế','Đào Minh Khôi','Đỗ Quang Trường',3,
  false,'cho_ban_duyet','demo-seed','demo-seed'),

-- 21  CHO DOI XE — LuongVuPhong DA DUYET, chua dieu xe
 ('a0000000-0000-4000-8000-000000000021','HTV-2026-000021','daominhkhoi','TT Tin Tức',
  now() + interval '2 days' + interval '3 hours', now() + interval '2 days' + interval '7 hours',
  'HTV','Chợ Bến Thành, Quận 1','Ghi hình phóng sự thị trường Tết',null,'Đỗ Thanh Phong',2,
  false,'cho_doi_xe','demo-seed','demo-seed'),

-- 22  DA DIEU XE — LuongVuPhong DA DUYET + Doi xe da dieu xe (Triton + laixe3)
 ('a0000000-0000-4000-8000-000000000022','HTV-2026-000022','daominhkhoi','TT Tin Tức',
  date_trunc('day', now()) + interval '3 days' + interval '7 hours',
  date_trunc('day', now()) + interval '3 days' + interval '12 hours',
  'HTV','Khu Công nghệ cao, TP Thủ Đức','Ghi hình phóng sự doanh nghiệp','Đào Minh Khôi','Đỗ Quang Trường',4,
  false,'da_dieu_xe','demo-seed','demo-seed');

-- ---------- 3. Duyet cua Ban -------------------------------------------------
insert into booking_approvals (booking_id, approver_username, quyet_dinh, ghi_chu, decided_at, updated_by) values
 ('a0000000-0000-4000-8000-000000000004','nguyenbaolam','tu_choi','Không bố trí được lịch, đề nghị dời tuần sau', now() - interval '4 days','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000005','nguyenbaolam','duyet', null, now() - interval '6 hours','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000007','nguyenbaolam','duyet', 'Đồng ý', now() - interval '2 days','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000008','nguyenbaolam','duyet', null, now() - interval '5 hours','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000009','nguyenbaolam','duyet', null, now() - interval '5 hours','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000010','nguyenbaolam','duyet', null, now() - interval '10 days','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000011','nguyenbaolam','duyet', null, now() - interval '8 days','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000012','nguyenbaolam','duyet', null, now() - interval '3 days','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000013','nguyenbaolam','duyet', null, now() - interval '7 days','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000014','nguyenbaolam','duyet', null, now() - interval '2 days','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000016','nguyenbaolam','duyet', null, now() - interval '6 days','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000017','nguyenbaolam','duyet', null, now() - interval '5 hours','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000018','nguyenbaolam','duyet', null, now() - interval '30 hours','nguyenbaolam'),
 ('a0000000-0000-4000-8000-000000000021','LuongVuPhong','duyet', 'Chủ quản duyệt', now() - interval '3 hours','LuongVuPhong'),
 ('a0000000-0000-4000-8000-000000000022','LuongVuPhong','duyet', 'Chủ quản duyệt', now() - interval '20 hours','LuongVuPhong');

-- ---------- 4. Dieu xe (Doi xe) -----------------------------------------
insert into booking_dispatch (booking_id, vehicle_id, driver_username, ghi_chu_doi_xe, dispatched_by, dispatched_at, updated_by) values
 ('a0000000-0000-4000-8000-000000000008',(select id from vehicles where plate_no='50A-030.36'),'laixe1','Xuất phát sớm','huynhvantuan', now() - interval '4 hours','huynhvantuan'),
 ('a0000000-0000-4000-8000-000000000009',(select id from vehicles where plate_no='50M-006.30'),'laixe2',null,'huynhvantuan', now() - interval '4 hours','huynhvantuan'),
 ('a0000000-0000-4000-8000-000000000010',(select id from vehicles where plate_no='50A-030.36'),'laixe1',null,'huynhvantuan', now() - interval '9 days','huynhvantuan'),
 ('a0000000-0000-4000-8000-000000000011',(select id from vehicles where plate_no='50A-030.36'),'laixe1',null,'topho', now() - interval '7 days','topho'),
 ('a0000000-0000-4000-8000-000000000012',(select id from vehicles where plate_no='50A-030.36'),'laixe1','Đi Đà Lạt 2 ngày','huynhvantuan', now() - interval '3 days','huynhvantuan'),
 ('a0000000-0000-4000-8000-000000000013',(select id from vehicles where plate_no='50M-006.30'),'laixe2',null,'huynhvantuan', now() - interval '6 days','huynhvantuan'),
 ('a0000000-0000-4000-8000-000000000014',(select id from vehicles where plate_no='50M-006.30'),'laixe2',null,'topho', now() - interval '2 days','topho'),
 ('a0000000-0000-4000-8000-000000000015',(select id from vehicles where plate_no='50A-031.91'),'laixe3','Đơn phát sinh','topho', now() - interval '1 day' - interval '3 hours','topho'),
 ('a0000000-0000-4000-8000-000000000016',(select id from vehicles where plate_no='50A-031.67'),'laixe4','Đoàn 15 người','huynhvantuan', now() - interval '5 days','huynhvantuan'),
 ('a0000000-0000-4000-8000-000000000017',(select id from vehicles where plate_no='50A-031.91'),'laixe3',null,'huynhvantuan', now() - interval '3 hours','huynhvantuan'),
 ('a0000000-0000-4000-8000-000000000018',(select id from vehicles where plate_no='50A-031.67'),'laixe4',null,'huynhvantuan', now() - interval '26 hours','huynhvantuan'),
 ('a0000000-0000-4000-8000-000000000022',(select id from vehicles where plate_no='50A-031.91'),'laixe3','Đón tại cổng chính','huynhvantuan', now() - interval '18 hours','huynhvantuan');

-- ---------- 5. Nhat ky chuyen ---------------------------------------------
insert into trip_logs (booking_id, driver_username, odo_start, gio_xuat_ben, odo_end, gio_ket_thuc, so_km, ghi_chu_lai_xe, da_dong_chuyen, updated_by) values
 ('a0000000-0000-4000-8000-000000000010','laixe1',120000, now() - interval '9 days', 120180, now() - interval '9 days' + interval '5 hours', 180, null, true,'laixe1'),
 ('a0000000-0000-4000-8000-000000000011','laixe1',120180, now() - interval '7 days', 120450, now() - interval '7 days' + interval '8 hours', 270, 'Đường đèo, chạy chậm', true,'laixe1'),
 ('a0000000-0000-4000-8000-000000000012','laixe1',120500, now() - interval '2 days', 121300, now() - interval '1 day', 800, 'Đi Đà Lạt về', true,'laixe1'),
 ('a0000000-0000-4000-8000-000000000013','laixe2', 85000, now() - interval '6 days', 85120, now() - interval '6 days' + interval '3 hours', 120, null, true,'laixe2'),
 ('a0000000-0000-4000-8000-000000000014','laixe2', 85200, now() - interval '1 day', 85300, now() - interval '1 day' + interval '3 hours' + interval '30 minutes', 100, null, true,'laixe2'),
 ('a0000000-0000-4000-8000-000000000015','laixe3', 60000, now() - interval '1 day' - interval '2 hours', 60240, now() - interval '1 day' + interval '3 hours', 240, 'Phát sinh', true,'laixe3'),
 ('a0000000-0000-4000-8000-000000000016','laixe4',150000, now() - interval '5 days', 150420, now() - interval '5 days' + interval '13 hours', 420, 'Đoàn đông, dừng nhiều', true,'laixe4'),
 ('a0000000-0000-4000-8000-000000000017','laixe3', 60240, now() - interval '2 hours', null, null, null, null, false,'laixe3'),
 ('a0000000-0000-4000-8000-000000000018','laixe4',150420, now() - interval '25 hours', null, null, null, null, false,'laixe4');

-- ---------- 6. Su kien cong-to-met --------------------------------------
insert into odometer_events (vehicle_id, booking_id, loai, odo_value, at_time, by_username) values
 ((select id from vehicles where plate_no='50A-030.36'),'a0000000-0000-4000-8000-000000000010','start',120000, now() - interval '9 days','laixe1'),
 ((select id from vehicles where plate_no='50A-030.36'),'a0000000-0000-4000-8000-000000000010','end',  120180, now() - interval '9 days' + interval '5 hours','laixe1'),
 ((select id from vehicles where plate_no='50A-030.36'),'a0000000-0000-4000-8000-000000000011','start',120180, now() - interval '7 days','laixe1'),
 ((select id from vehicles where plate_no='50A-030.36'),'a0000000-0000-4000-8000-000000000011','end',  120450, now() - interval '7 days' + interval '8 hours','laixe1'),
 ((select id from vehicles where plate_no='50A-030.36'),'a0000000-0000-4000-8000-000000000012','start',120500, now() - interval '2 days','laixe1'),
 ((select id from vehicles where plate_no='50A-030.36'),'a0000000-0000-4000-8000-000000000012','end',  121300, now() - interval '1 day','laixe1'),
 ((select id from vehicles where plate_no='50M-006.30'),'a0000000-0000-4000-8000-000000000013','start', 85000, now() - interval '6 days','laixe2'),
 ((select id from vehicles where plate_no='50M-006.30'),'a0000000-0000-4000-8000-000000000013','end',   85120, now() - interval '6 days' + interval '3 hours','laixe2'),
 ((select id from vehicles where plate_no='50M-006.30'),'a0000000-0000-4000-8000-000000000014','start', 85200, now() - interval '1 day','laixe2'),
 ((select id from vehicles where plate_no='50M-006.30'),'a0000000-0000-4000-8000-000000000014','end',   85300, now() - interval '1 day' + interval '3 hours' + interval '30 minutes','laixe2'),
 ((select id from vehicles where plate_no='50A-031.91'),'a0000000-0000-4000-8000-000000000015','start', 60000, now() - interval '1 day' - interval '2 hours','laixe3'),
 ((select id from vehicles where plate_no='50A-031.91'),'a0000000-0000-4000-8000-000000000015','end',   60240, now() - interval '1 day' + interval '3 hours','laixe3'),
 ((select id from vehicles where plate_no='50A-031.67'),'a0000000-0000-4000-8000-000000000016','start',150000, now() - interval '5 days','laixe4'),
 ((select id from vehicles where plate_no='50A-031.67'),'a0000000-0000-4000-8000-000000000016','end',  150420, now() - interval '5 days' + interval '13 hours','laixe4'),
 ((select id from vehicles where plate_no='50A-031.91'),'a0000000-0000-4000-8000-000000000017','start', 60240, now() - interval '2 hours','laixe3'),
 ((select id from vehicles where plate_no='50A-031.67'),'a0000000-0000-4000-8000-000000000018','start',150420, now() - interval '25 hours','laixe4');

-- ---------- 7. Canh bao "da biet" (alert_acks) -------------------------
-- Gap tren Zace truoc chuyen HTV-2026-000012: danh dau DA BIET
-- (an khoi danh sach mac dinh, xem lai bang /cong-to-met?daxem=1)
insert into alert_acks (kind, ref_id, acked_by, note)
values ('odo_gap','a0000000-0000-4000-8000-000000000012','huynhvantuan','Đã đối chiếu sổ xe, tài xế quên ghi 1 chặng nội bộ');
-- Gap tren Altis truoc HTV-2026-000014: KHONG ack -> hien thi do, co nut "Biet roi"

-- ---------- 8. Nhat ky thao tac (audit_log) — Doi xe dieu chinh km -----
insert into audit_log (entity, entity_id, action, by_username, diff) values
 ('trip_log','a0000000-0000-4000-8000-000000000011','dieu_chinh_km','huynhvantuan',
  '{"before":{"odoStart":120180,"odoEnd":120440,"soKm":260},"after":{"odoStart":120180,"odoEnd":120450,"soKm":270},"lyDo":"Tai xe ghi thieu 10km"}'),
 ('trip_log','a0000000-0000-4000-8000-000000000016','dieu_chinh_km','huynhvantuan',
  '{"before":{"odoStart":150000,"odoEnd":150400,"soKm":400},"after":{"odoStart":150000,"odoEnd":150420,"soKm":420},"lyDo":"Doi chieu lai dong ho"}');

-- ---------- 9. Dong bo so km hien tai cua xe --------------------------
update vehicles set current_odometer = 121300, updated_by = 'demo-seed' where plate_no = '50A-030.36';
update vehicles set current_odometer =  85300, updated_by = 'demo-seed' where plate_no = '50M-006.30';
update vehicles set current_odometer =  60240, updated_by = 'demo-seed' where plate_no = '50A-031.91';
update vehicles set current_odometer = 150420, updated_by = 'demo-seed' where plate_no = '50A-031.67';

commit;

-- ---------- Kiem tra nhanh --------------------------------------------
select status, count(*) from bookings where created_by = 'demo-seed' group by status order by status;
select 'trips' as loai, count(*) from trip_logs where booking_id in (select id from bookings where created_by='demo-seed')
union all select 'dispatch', count(*) from booking_dispatch where booking_id in (select id from bookings where created_by='demo-seed')
union all select 'approvals', count(*) from booking_approvals where booking_id in (select id from bookings where created_by='demo-seed')
union all select 'odo_events', count(*) from odometer_events where booking_id in (select id from bookings where created_by='demo-seed');
