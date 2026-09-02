CREATE TABLE "alert_acks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"acked_by" text NOT NULL,
	"note" text,
	"acked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"by_username" text,
	"at_time" timestamp with time zone DEFAULT now() NOT NULL,
	"diff" text
);
--> statement-breakpoint
CREATE TABLE "booking_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"approver_username" text NOT NULL,
	"quyet_dinh" text NOT NULL,
	"ghi_chu" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "booking_approvals_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "booking_dispatch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"driver_username" text NOT NULL,
	"ghi_chu_doi_xe" text,
	"dispatched_by" text NOT NULL,
	"dispatched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "booking_dispatch_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"requester_username" text NOT NULL,
	"don_vi_yeu_cau" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"diem_xuat_phat" text DEFAULT 'HTV' NOT NULL,
	"diem_den" text NOT NULL,
	"noi_dung" text NOT NULL,
	"bien_tap" text,
	"quay_phim" text,
	"so_nguoi" integer,
	"is_phat_sinh" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'cho_ban_duyet' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "bookings_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "odometer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"booking_id" uuid,
	"loai" text NOT NULL,
	"odo_value" integer NOT NULL,
	"at_time" timestamp with time zone DEFAULT now() NOT NULL,
	"by_username" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trip_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"driver_username" text NOT NULL,
	"odo_start" integer,
	"gio_xuat_ben" timestamp with time zone,
	"odo_end" integer,
	"gio_ket_thuc" timestamp with time zone,
	"so_km" integer,
	"ghi_chu_lai_xe" text,
	"da_dong_chuyen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "trip_logs_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"full_name" text NOT NULL,
	"ds_ban" text,
	"ds_phong" text,
	"ds_to" text,
	"role" text DEFAULT 'nhan_vien' NOT NULL,
	"job_title" text,
	"email" text,
	"phone" text,
	"password_hash" text NOT NULL,
	"is_driver" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"plate_no" text NOT NULL,
	"seats" integer NOT NULL,
	"current_odometer" integer DEFAULT 0 NOT NULL,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "vehicles_plate_no_unique" UNIQUE("plate_no")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "alert_kind_ref_idx" ON "alert_acks" USING btree ("kind","ref_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "dispatch_vehicle_idx" ON "booking_dispatch" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "dispatch_driver_idx" ON "booking_dispatch" USING btree ("driver_username");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_start_time_idx" ON "bookings" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "bookings_don_vi_idx" ON "bookings" USING btree ("don_vi_yeu_cau");--> statement-breakpoint
CREATE INDEX "odo_vehicle_time_idx" ON "odometer_events" USING btree ("vehicle_id","at_time");--> statement-breakpoint
CREATE INDEX "users_ds_ban_idx" ON "users" USING btree ("ds_ban");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");